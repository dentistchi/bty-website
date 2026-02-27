import { describe, it, expect } from "vitest";
import { POST } from "./route";

function request(body: unknown, headers?: Record<string, string>): Request {
  return new Request("http://localhost/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

describe("POST /api/chat", () => {
  it("returns 400 when message is missing", async () => {
    const res = await POST(request({}));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });

  it("returns 400 when messages is empty", async () => {
    const res = await POST(request({ messages: [] }));
    expect(res.status).toBe(400);
  });

  it("returns 200 with message and mode (dearme) when lang=ko", async () => {
    const res = await POST(
      request({
        messages: [{ role: "user", content: "오늘 기분이 좋아요" }],
        mode: "dearme",
        lang: "ko",
      })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(typeof data.message).toBe("string");
    expect(data.message.length).toBeGreaterThan(0);
    expect(data.mode).toBe("dearme");
  });

  it("returns 200 with message and mode (dojo) when lang=en", async () => {
    const res = await POST(
      request({
        messages: [{ role: "user", content: "How do I give feedback?" }],
        mode: "dojo",
        lang: "en",
      })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(typeof data.message).toBe("string");
    expect(data.mode).toBe("dojo");
  });

  it("returns 200 with message and mode (arena) for arena mode", async () => {
    const res = await POST(
      request({
        messages: [{ role: "user", content: "Scenario practice" }],
        mode: "arena",
        lang: "en",
      })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(typeof data.message).toBe("string");
    expect(["arena", "dojo", "dearme"]).toContain(data.mode);
  });
});
