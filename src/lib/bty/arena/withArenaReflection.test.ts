/**
 * Unit tests for Arena handler reflection wrapper (server-only).
 * No business/XP logic change; tests pass-through and merge conditions.
 */
import { describe, it, expect } from "vitest";
import { withArenaReflection, type ArenaHandler } from "./withArenaReflection";

function jsonResponse(data: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("withArenaReflection", () => {
  it("returns a function (ArenaHandler)", () => {
    const original: ArenaHandler = async () => jsonResponse({});
    const wrapped = withArenaReflection(original);
    expect(typeof wrapped).toBe("function");
    expect(wrapped.length).toBe(1);
  });

  it("returns original response when request body is empty (no levelId/userText)", async () => {
    const original: ArenaHandler = async () => jsonResponse({ foo: 1 });
    const wrapped = withArenaReflection(original);
    const req = new Request("https://x/", {
      method: "POST",
      body: JSON.stringify({}),
      headers: { "content-type": "application/json" },
    });
    const res = await wrapped(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.foo).toBe(1);
    expect(data.reflection).toBeUndefined();
  });

  it("returns original response when response is not JSON", async () => {
    const original: ArenaHandler = async () =>
      new Response("plain text", { headers: { "content-type": "text/plain" } });
    const wrapped = withArenaReflection(original);
    const req = new Request("https://x/", {
      method: "POST",
      body: JSON.stringify({ levelId: "S1", userText: "hello" }),
      headers: { "content-type": "application/json" },
    });
    const res = await wrapped(req);
    expect(res.headers.get("content-type")).toContain("text/plain");
    expect(await res.text()).toBe("plain text");
  });

  it("returns original response when body is invalid JSON", async () => {
    const original: ArenaHandler = async () => jsonResponse({ ok: true });
    const wrapped = withArenaReflection(original);
    const req = new Request("https://x/", {
      method: "POST",
      body: "not json",
      headers: { "content-type": "application/json" },
    });
    const res = await wrapped(req);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.reflection).toBeUndefined();
  });

  it("merges reflection when body has levelId and userText and response is JSON", async () => {
    const original: ArenaHandler = async () => jsonResponse({ result: "ok" });
    const wrapped = withArenaReflection(original);
    const req = new Request("https://x/", {
      method: "POST",
      body: JSON.stringify({ levelId: "S1", userText: "I felt defensive" }),
      headers: { "content-type": "application/json" },
    });
    const res = await wrapped(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.result).toBe("ok");
    expect(data.reflection).toBeDefined();
    expect(typeof data.reflection.summary).toBe("string");
    expect(Array.isArray(data.reflection.questions)).toBe(true);
    expect(data.reflection.detected).toBeDefined();
    expect(Array.isArray(data.reflection.detected.tags)).toBe(true);
  });
});
