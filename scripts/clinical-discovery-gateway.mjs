#!/usr/bin/env node
/** Authenticated, bounded loopback gateway for Clinical Discovery. Publishing a tunnel is a separate operator action. */
import { createServer } from "node:http";
import { createHash, timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const MAX_BODY = 64_000;
const MAX_RESPONSE = 64_000;
const MAX_TOKENS = 512;
const BODY_TIMEOUT_MS = 2_000;
const UPSTREAM_TIMEOUT_MS = 10_000;
const errorWithStatus = (message, status) => Object.assign(new Error(message), { status });

/** Reject invalid budgets; valid large budgets are capped rather than passed through. */
export function tokenBudget(value) {
  if (value === undefined) return MAX_TOKENS;
  if (!Number.isSafeInteger(value) || value <= 0) throw errorWithStatus("invalid token budget", 400);
  return Math.min(value, MAX_TOKENS);
}

/** Count bytes while reading, cancelling the upstream before buffering an oversized body. */
export async function boundedResponseText(response, limit = MAX_RESPONSE) {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > limit) {
    void response.body?.cancel().catch(() => {});
    throw errorWithStatus("upstream too large", 502);
  }
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return text + decoder.decode();
      size += value.byteLength;
      if (size > limit) {
        void reader.cancel().catch(() => {});
        throw errorWithStatus("upstream too large", 502);
      }
      text += decoder.decode(value, { stream: true });
    }
  } finally { reader.releaseLock(); }
}

/** A slow/incomplete upload must not hold one of the inference slots indefinitely. */
export function readBody(req, timeoutMs = BODY_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    const cleanup = () => {
      clearTimeout(timer);
      req.off("data", onData); req.off("end", onEnd); req.off("error", onError); req.off("aborted", onAborted);
    };
    const fail = error => { cleanup(); req.pause(); reject(error); };
    const onData = chunk => {
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += bytes.byteLength;
      if (size > MAX_BODY) return fail(errorWithStatus("request too large", 413));
      chunks.push(bytes);
    };
    const onEnd = () => { cleanup(); resolve(Buffer.concat(chunks).toString("utf8")); };
    const onError = () => fail(errorWithStatus("request disconnected", 400));
    const onAborted = () => fail(errorWithStatus("request disconnected", 400));
    const timer = setTimeout(() => fail(errorWithStatus("request timeout", 408)), timeoutMs);
    req.on("data", onData); req.once("end", onEnd); req.once("error", onError); req.once("aborted", onAborted);
  });
}

const defaultLog = (status, ms, note = "") => console.log(`${new Date().toISOString()} ${status} ${ms}ms${note ? ` ${note}` : ""}`);
const send = (res, status, body, req) => {
  if (res.destroyed || res.writableEnded) return;
  if (req) {
    // Finish the error response, then close the unread upload instead of keeping it alive.
    res.once("finish", () => req.destroy());
  }
  res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store", ...(req ? { Connection: "close" } : {}) });
  res.end(JSON.stringify(body));
};

/** Exported for isolated transport-boundary tests; importing this file starts no server or model. */
export function createGatewayHandler({ model, key, upstream, fetchImpl = globalThis.fetch,
  bodyTimeoutMs = BODY_TIMEOUT_MS, upstreamTimeoutMs = UPSTREAM_TIMEOUT_MS, logger = defaultLog }) {
  if (!model || typeof key !== "string" || key.length < 32) throw new Error("model and gateway key of at least 32 characters are required");
  const digest = s => createHash("sha256").update(s).digest();
  const expected = digest(`Bearer ${key}`);
  const authorized = header => typeof header === "string" && timingSafeEqual(digest(header), expected);
  let active = 0;
  let windowStart = Date.now();
  let windowCount = 0;
  return async (req, res) => {
    const started = Date.now();
    if (req.method !== "POST" || req.url !== "/v1/chat/completions") { send(res, 404, { error: "not_found" }); return logger(404, 0); }
    if (!authorized(req.headers.authorization)) { send(res, 401, { error: "unauthorized" }); return logger(401, 0); }
    if (Date.now() - windowStart > 60_000) { windowStart = Date.now(); windowCount = 0; }
    if (active >= 4 || ++windowCount > 120) { send(res, 429, { error: "busy" }); return logger(429, 0); }
    active++;
    const controller = new AbortController();
    const disconnected = () => controller.abort();
    const closed = () => { if (!res.writableEnded) disconnected(); };
    req.once("aborted", disconnected); res.once("close", closed);
    let timer;
    try {
      let input;
      try { input = JSON.parse(await readBody(req, bodyTimeoutMs)); }
      catch (e) { send(res, e.status ?? 400, { error: "invalid_request" }, req); return logger(e.status ?? 400, Date.now() - started); }
      if (!input || input.model !== model || !Array.isArray(input.messages) || input.stream) {
        send(res, 400, { error: "invalid_request" }); return logger(400, Date.now() - started);
      }
      let max_tokens;
      try { max_tokens = tokenBudget(input.max_tokens); }
      catch { send(res, 400, { error: "invalid_request" }); return logger(400, Date.now() - started); }
      const body = { model, messages: input.messages, stream: false,
        temperature: typeof input.temperature === "number" && Number.isFinite(input.temperature) ? input.temperature : 0,
        max_tokens, ...(input.response_format ? { response_format: input.response_format } : {}) };
      if (controller.signal.aborted) return;
      timer = setTimeout(() => controller.abort(), upstreamTimeoutMs);
      const response = await fetchImpl(`${upstream}/v1/chat/completions`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
        redirect: "error", signal: controller.signal,
      });
      if (!response.ok) {
        void response.body?.cancel().catch(() => {});
        send(res, 502, { error: "upstream_error" }); return logger(502, Date.now() - started);
      }
      const text = await boundedResponseText(response);
      if (!res.destroyed && !res.writableEnded) {
        res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
        res.end(text);
      }
      logger(200, Date.now() - started);
    } catch (e) {
      send(res, 502, { error: e.message === "upstream too large" ? "upstream_too_large" : "upstream_unavailable" });
      logger(502, Date.now() - started, controller.signal.aborted ? "cancelled" : "unavailable");
    } finally {
      clearTimeout(timer); controller.abort();
      req.off("aborted", disconnected); res.off("close", closed);
      active--;
    }
  };
}

async function main() {
  const port = Number(process.env.CLINICAL_DISCOVERY_GATEWAY_PORT ?? 8788);
  const upstream = process.env.CLINICAL_DISCOVERY_GATEWAY_UPSTREAM ?? "http://127.0.0.1:11434";
  const model = process.env.CLINICAL_DISCOVERY_GATEWAY_MODEL;
  const keyFile = process.env.CLINICAL_DISCOVERY_GATEWAY_KEY_FILE;
  if (!model || !keyFile) throw new Error("CLINICAL_DISCOVERY_GATEWAY_MODEL and CLINICAL_DISCOVERY_GATEWAY_KEY_FILE are required");
  const key = readFileSync(keyFile.replace(/^~(?=\/)/, process.env.HOME ?? ""), "utf8").trim();
  const handler = createGatewayHandler({ model, key, upstream });
  // Cold loading can take longer than inference; it remains explicitly bounded.
  const warm = await fetch(`${upstream}/api/generate`, { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, prompt: "", keep_alive: -1 }), redirect: "error", signal: AbortSignal.timeout(120_000) });
  if (!warm.ok) throw new Error(`could not load model: HTTP ${warm.status}`);
  await boundedResponseText(warm);
  const server = createServer(handler);
  server.listen(port, "127.0.0.1", () => console.log(`gateway on 127.0.0.1:${port} → ${upstream} model=${model}`));
  for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, async () => {
    server.close(); server.closeAllConnections();
    await fetch(`${upstream}/api/generate`, { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, keep_alive: 0 }), redirect: "error", signal: AbortSignal.timeout(3_000) }).catch(() => {});
    process.exit(0);
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
