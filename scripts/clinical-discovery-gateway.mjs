#!/usr/bin/env node
/**
 * CLINICAL DISCOVERY — authenticated gateway in front of a Mac-local Ollama (operator-run).
 *
 * A deployed Worker cannot reach the Mac's 127.0.0.1. This process stays on loopback and is
 * published over HTTPS by a tunnel (e.g. `cloudflared tunnel --url http://127.0.0.1:8788`).
 * It is NOT an open model proxy:
 *   - every request needs `Authorization: Bearer <key>` (constant-time compare), else 401;
 *   - only POST /v1/chat/completions, only the one allowed model, non-streaming;
 *   - only the fields the discovery adapter sends are forwarded; max_tokens is capped;
 *   - request/response size, concurrency and per-minute volume are bounded;
 *   - bodies are never logged — one line per request: time, status, latency.
 * The model is kept loaded so a request fits the adapter's 4-second limit.
 *
 *   CLINICAL_DISCOVERY_GATEWAY_KEY_FILE=~/.config/bty/clinical-discovery-gateway.key \
 *   CLINICAL_DISCOVERY_GATEWAY_MODEL=qwen3-coder-next:q4_K_M node scripts/clinical-discovery-gateway.mjs
 */
import { createServer } from "node:http";
import { createHash, timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";

const PORT = Number(process.env.CLINICAL_DISCOVERY_GATEWAY_PORT ?? 8788);
const UPSTREAM = process.env.CLINICAL_DISCOVERY_GATEWAY_UPSTREAM ?? "http://127.0.0.1:11434";
const MODEL = process.env.CLINICAL_DISCOVERY_GATEWAY_MODEL;
const KEY_FILE = process.env.CLINICAL_DISCOVERY_GATEWAY_KEY_FILE;
const MAX_BODY = 64_000;
const MAX_RESPONSE = 64_000;
const MAX_TOKENS = 512;
const MAX_CONCURRENT = 4;
const MAX_PER_MINUTE = 120;
const UPSTREAM_TIMEOUT_MS = 10_000;

if (!MODEL) throw new Error("CLINICAL_DISCOVERY_GATEWAY_MODEL is required");
if (!KEY_FILE) throw new Error("CLINICAL_DISCOVERY_GATEWAY_KEY_FILE is required");
const key = readFileSync(KEY_FILE.replace(/^~(?=\/)/, process.env.HOME), "utf8").trim();
if (key.length < 32) throw new Error("gateway key must be at least 32 characters");
const digest = (s) => createHash("sha256").update(s).digest();
const expected = digest(`Bearer ${key}`);
const authorized = (header) => typeof header === "string" && timingSafeEqual(digest(header), expected);

let active = 0;
let windowStart = Date.now();
let windowCount = 0;
const log = (status, ms, note = "") => console.log(`${new Date().toISOString()} ${status} ${ms}ms${note ? ` ${note}` : ""}`);
const send = (res, status, body) => {
  res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  res.end(JSON.stringify(body));
};

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) throw Object.assign(new Error("too large"), { status: 413 });
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function keepLoaded() {
  // keep_alive -1: Ollama keeps the model resident until unloaded on shutdown.
  const r = await fetch(`${UPSTREAM}/api/generate`, { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: MODEL, prompt: "", keep_alive: -1 }) });
  if (!r.ok) throw new Error(`could not load ${MODEL}: HTTP ${r.status}`);
  await r.arrayBuffer();
}

const server = createServer(async (req, res) => {
  const started = Date.now();
  if (req.method !== "POST" || req.url !== "/v1/chat/completions") { send(res, 404, { error: "not_found" }); return log(404, 0); }
  if (!authorized(req.headers.authorization)) { send(res, 401, { error: "unauthorized" }); return log(401, 0); }
  if (Date.now() - windowStart > 60_000) { windowStart = Date.now(); windowCount = 0; }
  if (active >= MAX_CONCURRENT || ++windowCount > MAX_PER_MINUTE) { send(res, 429, { error: "busy" }); return log(429, 0); }
  active++;
  try {
    let input;
    try { input = JSON.parse(await readBody(req)); } catch (e) { send(res, e.status ?? 400, { error: "invalid_request" }); return log(e.status ?? 400, Date.now() - started); }
    if (!input || input.model !== MODEL || !Array.isArray(input.messages) || input.stream) { send(res, 400, { error: "invalid_request" }); return log(400, Date.now() - started); }
    const body = { model: MODEL, messages: input.messages, stream: false, temperature: typeof input.temperature === "number" ? input.temperature : 0,
      max_tokens: Math.min(Number(input.max_tokens) || MAX_TOKENS, MAX_TOKENS), ...(input.response_format ? { response_format: input.response_format } : {}) };
    const upstream = await fetch(`${UPSTREAM}/v1/chat/completions`, { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body), signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS) });
    const text = await upstream.text();
    if (text.length > MAX_RESPONSE) { send(res, 502, { error: "upstream_too_large" }); return log(502, Date.now() - started); }
    res.writeHead(upstream.ok ? 200 : 502, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    res.end(upstream.ok ? text : JSON.stringify({ error: "upstream_error" }));
    log(upstream.ok ? 200 : 502, Date.now() - started);
  } catch (e) {
    send(res, 502, { error: "upstream_unavailable" });
    log(502, Date.now() - started, e?.name === "TimeoutError" ? "timeout" : "unavailable");
  } finally { active--; }
});

await keepLoaded();
server.listen(PORT, "127.0.0.1", () => console.log(`gateway on 127.0.0.1:${PORT} → ${UPSTREAM} model=${MODEL}`));
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, async () => {
  server.close();
  await fetch(`${UPSTREAM}/api/generate`, { method: "POST", body: JSON.stringify({ model: MODEL, keep_alive: 0 }) }).catch(() => {});
  process.exit(0);
});
