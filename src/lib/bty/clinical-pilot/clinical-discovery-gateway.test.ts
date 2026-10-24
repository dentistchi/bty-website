import { afterEach, describe, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { boundedResponseText, createGatewayHandler, readBody, tokenBudget } from "../../../../scripts/clinical-discovery-gateway.mjs";

const KEY = "fixture-key-for-isolated-tests-only-123456";
const MODEL = "fixture-model";
const input = { model: MODEL, messages: [{ role: "user", content: "fixture question" }], max_tokens: 256 };
const req = () => Object.assign(new PassThrough(), { method: "POST", url: "/v1/chat/completions", headers: { authorization: `Bearer ${KEY}` } });
const response = () => {
  const events = new EventEmitter();
  const res = Object.assign(events, {
    destroyed: false, writableEnded: false, statusCode: 0, body: "", headers: {} as object,
    writeHead(status: number, headers: object) { this.statusCode = status; this.headers = headers; },
    end(body: string) { this.body = body; this.writableEnded = true; events.emit("finish"); },
  });
  return res;
};
const handler = (fetchImpl: ReturnType<typeof vi.fn>, options = {}) => createGatewayHandler({
  model: MODEL, key: KEY, upstream: "http://unused.invalid", fetchImpl, logger: vi.fn(), ...options,
});
const call = async (handle: ReturnType<typeof createGatewayHandler>, data: object) => {
  const request = req(); const res = response();
  const done = handle(request, res);
  request.end(JSON.stringify(data));
  await done;
  return res;
};
afterEach(() => vi.useRealTimers());

describe("Clinical Discovery gateway transport bounds", () => {
  it("defaults or caps only positive integer token budgets", () => {
    expect(tokenBudget(undefined)).toBe(512);
    expect(tokenBudget(256)).toBe(256);
    expect(tokenBudget(4096)).toBe(512);
    for (const value of [-1, 0, 1.5, "256", null, NaN, Infinity]) expect(() => tokenBudget(value)).toThrow();
  });

  it("rejects invalid tokens before forwarding any request", async () => {
    const fetchImpl = vi.fn();
    const handle = handler(fetchImpl);
    for (const max_tokens of [-1, 1.5, 0, "256"]) {
      expect((await call(handle, { ...input, max_tokens })).statusCode).toBe(400);
    }
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("counts UTF-8 bytes rather than JavaScript character length", async () => {
    const cancel = vi.fn();
    const stream = new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode("한".repeat(30_000))); }, cancel });
    await expect(boundedResponseText(new Response(stream))).rejects.toThrow("upstream too large");
    expect(cancel).toHaveBeenCalled();
  });

  it("cancels a growing response at the byte boundary without draining it", async () => {
    const cancel = vi.fn(); let emitted = 0;
    const stream = new ReadableStream({
      pull(controller) { emitted += 16_000; controller.enqueue(new Uint8Array(16_000)); }, cancel,
    }, { highWaterMark: 0 });
    await expect(boundedResponseText(new Response(stream))).rejects.toThrow("upstream too large");
    expect(emitted).toBe(80_000);
    expect(cancel).toHaveBeenCalled();
  });

  it("rejects oversized declared responses before pulling their body", async () => {
    const pull = vi.fn(); const cancel = vi.fn();
    const stream = new ReadableStream({ pull, cancel }, { highWaterMark: 0 });
    await expect(boundedResponseText(new Response(stream, { headers: { "content-length": "64001" } }))).rejects.toThrow();
    expect(pull).not.toHaveBeenCalled();
    expect(cancel).toHaveBeenCalled();
  });

  it("decodes split UTF-8 bytes correctly within the bound", async () => {
    const bytes = new TextEncoder().encode("한글");
    const stream = new ReadableStream({ start(controller) {
      controller.enqueue(bytes.slice(0, 1)); controller.enqueue(bytes.slice(1)); controller.close();
    } });
    expect(await boundedResponseText(new Response(stream))).toBe("한글");
  });

  it("bounds incomplete uploads and removes its stream listeners", async () => {
    vi.useFakeTimers();
    const request = req();
    const pending = readBody(request, 20).catch(error => error);
    request.write("{");
    await vi.advanceTimersByTimeAsync(21);
    expect((await pending).status).toBe(408);
    for (const event of ["data", "end", "error", "aborted"]) expect(request.listenerCount(event)).toBe(0);
    request.destroy();
  });

  it("releases all four occupied upload slots after their deadline", async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn(async () => new Response("{}"));
    const handle = handler(fetchImpl, { bodyTimeoutMs: 20 });
    const requests = Array.from({ length: 4 }, () => req());
    const results = requests.map(() => response());
    const pending = requests.map((request, i) => handle(request, results[i]));
    requests.forEach(request => request.write("{"));
    const busy = await call(handle, input);
    expect(busy.statusCode).toBe(429);
    await vi.advanceTimersByTimeAsync(21);
    await Promise.all(pending);
    expect(results.every(res => res.statusCode === 408)).toBe(true);
    expect((await call(handle, input)).statusCode).toBe(200);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("aborts upstream inference when the waiting client disconnects", async () => {
    let upstreamSignal: AbortSignal | undefined;
    const fetchImpl = vi.fn((_url: unknown, init: { signal: AbortSignal }) => {
      upstreamSignal = init.signal;
      return new Promise<Response>((_resolve, reject) => {
        init.signal.addEventListener("abort", () => reject(new Error("cancelled")), { once: true });
      });
    });
    const handle = handler(fetchImpl);
    const request = req(); const res = response();
    const pending = handle(request, res);
    request.end(JSON.stringify(input));
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledOnce());
    res.destroyed = true; res.emit("close");
    await pending;
    expect(upstreamSignal?.aborted).toBe(true);
    expect(res.statusCode).toBe(0);
  });

  it("enforces auth/path/model and forwards only bounded allowed fields", async () => {
    const fetchImpl = vi.fn(async () => new Response("{}")); const handle = handler(fetchImpl);
    const request = req(); const res = response(); request.headers.authorization = "Bearer wrong";
    await handle(request, res); expect(res.statusCode).toBe(401); request.destroy();
    expect((await call(handle, { ...input, model: "other" })).statusCode).toBe(400);
    const request2 = req(); const res2 = response(); request2.url = "/api/generate";
    await handle(request2, res2); expect(res2.statusCode).toBe(404); request2.destroy();
    expect((await call(handle, { ...input, max_tokens: 900, keep_alive: -1, secret: "never-forward" })).statusCode).toBe(200);
    const calls = fetchImpl.mock.calls as unknown as [unknown, { body: string }][];
    const forwarded = JSON.parse(calls[0][1].body);
    expect(forwarded.max_tokens).toBe(512);
    expect(forwarded).not.toHaveProperty("keep_alive");
    expect(forwarded).not.toHaveProperty("secret");
  });
});
