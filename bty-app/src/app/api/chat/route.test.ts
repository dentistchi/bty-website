import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";

// Next.js cookies() is called by getSupabaseServerClient(); mock for Vitest (no request scope).
vi.mock("next/headers", () => ({
  cookies: () =>
    Promise.resolve({
      getAll: () => [],
    }),
}));

// Supabase client requires env in test; mock so fallback response path works.
vi.mock("@/lib/bty/arena/supabaseServer", () => ({
  getSupabaseServerClient: () =>
    Promise.resolve({
      auth: {
        getUser: () => Promise.resolve({ data: { user: null } }),
      },
    }),
}));

const mockCheckRateLimit = vi.fn(() => ({ allowed: true, retryAfterSeconds: 60 }));
vi.mock("@/lib/rate-limit", () => ({
  getClientIdentifier: () => "test-client",
  checkRateLimit: (_id: string, _limit: number) => mockCheckRateLimit(),
}));

function request(body: unknown, headers?: Record<string, string>): Request {
  return new Request("http://localhost/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

describe("POST /api/chat", () => {
  beforeEach(() => {
    mockCheckRateLimit.mockReturnValue({ allowed: true, retryAfterSeconds: 60 });
  });

  it("returns 429 when rate limit disallows", async () => {
    mockCheckRateLimit.mockReturnValueOnce({ allowed: false, retryAfterSeconds: 30 });
    const res = await POST(
      request({
        messages: [{ role: "user", content: "Hello" }],
        mode: "foundry",
        lang: "en",
      })
    );
    expect(res.status).toBe(429);
    const data = await res.json();
    expect(data.error).toMatch(/many requests|Too many/i);
    expect(res.headers.get("Retry-After")).toBe("30");
  });

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

  it("returns 200 with message and mode (center) when lang=ko", async () => {
    const res = await POST(
      request({
        messages: [{ role: "user", content: "오늘 기분이 좋아요" }],
        mode: "center",
        lang: "ko",
      })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(typeof data.message).toBe("string");
    expect(data.message.length).toBeGreaterThan(0);
    expect(data.mode).toBe("center");
  });

  it("returns 200 with message and mode (foundry) when lang=en", async () => {
    const res = await POST(
      request({
        messages: [{ role: "user", content: "How do I give feedback?" }],
        mode: "foundry",
        lang: "en",
      })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(typeof data.message).toBe("string");
    expect(data.mode).toBe("foundry");
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
    expect(["arena", "foundry", "center"]).toContain(data.mode);
  });

  it("returns 200 with fixed intro reply for BTY/Center intro question (CHATBOT_TRAINING_CHECKLIST)", async () => {
    const res = await POST(
      request({
        messages: [{ role: "user", content: "BTY가 뭐야?" }],
        mode: "foundry",
        lang: "ko",
      })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(typeof data.message).toBe("string");
    expect(data.message).toContain("리더십");
    const resEn = await POST(
      request({
        messages: [{ role: "user", content: "What is Center?" }],
        mode: "center",
        lang: "en",
      })
    );
    expect(resEn.status).toBe(200);
    const dataEn = await resEn.json();
    expect(dataEn.message).toContain("safe");
  });
});
