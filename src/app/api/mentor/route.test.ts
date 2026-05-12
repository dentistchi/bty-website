import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";

// Next.js cookies() is called by getSupabaseServerClient(); mock for Vitest (no request scope).
vi.mock("next/headers", () => ({
  cookies: () =>
    Promise.resolve({
      getAll: () => [],
    }),
}));

// Supabase client: mock so fallback/OpenAI path works without real DB.
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

// Emotional/quality/activity: no-op in tests.
vi.mock("@/lib/bty/arena/activityXp", () => ({ recordActivityXp: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/bty/emotional-stats", () => ({
  detectEmotionalEventFromText: () => null,
  recordEmotionalEventServer: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/bty/quality", () => ({ recordQualityEventApp: vi.fn() }));
vi.mock("@/lib/log-api-error", () => ({ logApiError: vi.fn() }));

// LLM client mock — default: unavailable (returns fallback). Override per-test in describe blocks.
const { mockCreate, mockIsLlmAvailable } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockIsLlmAvailable: vi.fn().mockReturnValue(false),
}));

vi.mock("@/lib/bty/llm/client", () => ({
  isLlmAvailable: () => mockIsLlmAvailable(),
  getLlmClient: vi.fn(() => ({
    chat: { completions: { create: mockCreate } },
  })),
  getLlmModel: vi.fn().mockReturnValue("gpt-4o-mini"),
}));

function request(body: unknown, headers?: Record<string, string>): Request {
  return new Request("http://localhost/api/mentor", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

describe("POST /api/mentor", () => {
  beforeEach(() => {
    mockCheckRateLimit.mockReturnValue({ allowed: true, retryAfterSeconds: 60 });
    mockIsLlmAvailable.mockReturnValue(false);
    mockCreate.mockReset();
  });

  it("returns 400 when message is missing", async () => {
    const res = await POST(request({}));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });

  it("returns 400 with JSON body containing only error key when message missing", async () => {
    const res = await POST(request({}));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(Object.keys(data)).toEqual(["error"]);
  });

  it("returns 400 when messages is empty and no message field", async () => {
    const res = await POST(request({ messages: [] }));
    expect(res.status).toBe(400);
  });

  it("returns 500 when body is not valid JSON", async () => {
    const req = new Request("http://localhost/api/mentor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json {",
    });
    const res = await POST(req);
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });

  it("returns 500 with JSON body containing only error key when body not valid JSON", async () => {
    const req = new Request("http://localhost/api/mentor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json {",
    });
    const res = await POST(req);
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(Object.keys(data)).toEqual(["error"]);
  });

  it("returns 429 with error key when rate limited", async () => {
    mockCheckRateLimit.mockReturnValueOnce({ allowed: false, retryAfterSeconds: 30 });
    const res = await POST(request({ message: "Hi", lang: "en" }));
    expect(res.status).toBe(429);
    const data = await res.json();
    expect(data).toHaveProperty("error");
    expect(typeof data.error).toBe("string");
  });

  it("returns 429 when rate limit disallows", async () => {
    mockCheckRateLimit.mockReturnValueOnce({ allowed: false, retryAfterSeconds: 30 });
    const res = await POST(request({ message: "Hello", lang: "en" }));
    expect(res.status).toBe(429);
    const data = await res.json();
    expect(data.error).toMatch(/many requests|Too many/i);
    expect(res.headers.get("Retry-After")).toBe("30");
  });

  it("returns 429 with error and retryAfterSeconds keys", async () => {
    mockCheckRateLimit.mockReturnValueOnce({ allowed: false, retryAfterSeconds: 60 });
    const res = await POST(request({ message: "Hi", lang: "en" }));
    expect(res.status).toBe(429);
    const data = await res.json();
    expect(data).toHaveProperty("error");
    expect(data).toHaveProperty("retryAfterSeconds");
    expect(typeof data.retryAfterSeconds).toBe("number");
  });

  it("returns 200 with message as string on success", async () => {
    const res = await POST(
      request({
        message: "What is leadership?",
        lang: "en",
      })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(typeof data.message).toBe("string");
  });

  it("returns 200 with message when lang=ko", async () => {
    const res = await POST(
      request({
        messages: [{ role: "user", content: "리더십 피드백 어떻게 주나요?" }],
        lang: "ko",
      })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(typeof data.message).toBe("string");
    expect(data.message.length).toBeGreaterThan(0);
  });

  it("returns 200 with message key present", async () => {
    const res = await POST(
      request({
        message: "How do I give feedback?",
        lang: "en",
      })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("message");
    expect(typeof data.message).toBe("string");
  });

  it("returns 200 with message when lang=en", async () => {
    const res = await POST(
      request({
        message: "How do I handle conflict with a colleague?",
        lang: "en",
      })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(typeof data.message).toBe("string");
  });

  it("returns 200 with safety_valve and dear_me_url for low self-esteem signal", async () => {
    const res = await POST(
      request({
        messages: [{ role: "user", content: "저는 너무 힘들어요 포기할까봐" }],
        lang: "ko",
      })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(typeof data.message).toBe("string");
    expect(data.safety_valve).toBe(true);
    expect(data.dear_me_url).toBeDefined();
  });

  describe("request/response mocking", () => {
    const MOCKED_REPLY = "Mocked mentor reply for tests.";

    beforeEach(() => {
      mockIsLlmAvailable.mockReturnValue(true);
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: MOCKED_REPLY } }],
      });
    });

    it("POST with message + OPENAI_API_KEY uses mocked client and returns mocked message", async () => {
      const req = request({ message: "What is leadership?", lang: "en" });
      const res = await POST(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.message).toBe(MOCKED_REPLY);
      expect(mockCreate).toHaveBeenCalled();
      const [params] = mockCreate.mock.calls[0] ?? [];
      expect(params?.model).toBe("gpt-4o-mini");
    });

    it("request body with messages[] and lang=ko yields 200 and JSON with message", async () => {
      const req = request({
        messages: [{ role: "user", content: "테스트 메시지" }],
        lang: "ko",
      });
      const res = await POST(req);
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toMatch(/application\/json/);
      const data = await res.json();
      expect(data).toMatchObject({ message: expect.any(String) });
      expect(data.message.length).toBeGreaterThan(0);
    });
  });

  it("returns 500 when request.json() throws", async () => {
    const req = new Request("http://localhost/api/mentor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    vi.spyOn(req, "json").mockRejectedValueOnce(new Error("parse error"));
    const res = await POST(req);
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });

  it("returns 500 with only error key when request.json() throws", async () => {
    const req = new Request("http://localhost/api/mentor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    vi.spyOn(req, "json").mockRejectedValueOnce(new Error("parse error"));
    const res = await POST(req);
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(Object.keys(data)).toEqual(["error"]);
  });

  describe("error and edge cases", () => {
    it("returns 400 when message is empty string", async () => {
      const res = await POST(request({ message: "", lang: "en" }));
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe("Message required");
    });

    it("returns 200 with usedFallback when LLM throws an error", async () => {
      mockIsLlmAvailable.mockReturnValueOnce(true);
      mockCreate.mockRejectedValueOnce(new Error("Network error"));
      const res = await POST(
        request({ message: "Normal question", lang: "en" })
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.message).toBeDefined();
      expect(typeof data.message).toBe("string");
      expect(data.message.length).toBeGreaterThan(0);
      expect(data.usedFallback).toBe(true);
    });
  });
});
