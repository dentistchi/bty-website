/**
 * POST /api/safe-mirror — 400·200 (no auth).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";

const originalEnv = process.env;

function makeRequest(body: {
  messages?: { role: string; content?: string }[];
  message?: string;
  locale?: string;
  lang?: string;
}): Request {
  return new Request("http://localhost/api/safe-mirror", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/safe-mirror", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    delete process.env.GEMINI_API_KEY;
  });

  it("returns 400 when message is missing", async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Message required");
  });

  it("returns 200 with fallback message when no API key", async () => {
    const res = await POST(makeRequest({ message: "I feel sad" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(typeof data.message).toBe("string");
    expect(data.message.length).toBeGreaterThan(0);
  });

  it("returns 200 with Korean fallback when lang=ko and no API key", async () => {
    const res = await POST(makeRequest({ message: "힘들어요", lang: "ko" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(typeof data.message).toBe("string");
    expect(data.message).toMatch(/당연|부족|소중/);
  });

  it("returns 200 with content-type application/json on success", async () => {
    const res = await POST(makeRequest({ message: "I need support", lang: "en" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/application\/json/);
    const data = await res.json();
    expect(data).toHaveProperty("message");
    expect(typeof data.message).toBe("string");
  });

  it("returns 500 when body is not valid JSON", async () => {
    const req = new Request("http://localhost/api/safe-mirror", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json {",
    });
    const res = await POST(req);
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe("Something went wrong");
  });
});
