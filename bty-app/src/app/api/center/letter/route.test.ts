/**
 * POST /api/center/letter — 401·400·500·200.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";

const mockGetLetterAuth = vi.fn();
const mockSubmitCenterLetter = vi.fn();
vi.mock("@/lib/bty/center", () => ({
  getLetterAuth: (...args: unknown[]) => mockGetLetterAuth(...args),
  submitCenterLetter: (...args: unknown[]) => mockSubmitCenterLetter(...args),
}));

function makeRequest(body: {
  body?: string;
  mood?: string;
  energy?: number;
  oneWord?: string;
  lang?: string;
}): Request {
  return new Request("http://localhost/api/center/letter", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/center/letter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetLetterAuth.mockResolvedValue(null);
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetLetterAuth.mockResolvedValue(null);

    const res = await POST(makeRequest({ body: "Hello" }));
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("Unauthorized");
    expect(mockSubmitCenterLetter).not.toHaveBeenCalled();
  });

  it("returns 401 with JSON body containing only error key", async () => {
    mockGetLetterAuth.mockResolvedValue(null);
    const res = await POST(makeRequest({ body: "Hello" }));
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(Object.keys(data)).toEqual(["error"]);
  });

  it("returns 500 when body is invalid JSON", async () => {
    mockGetLetterAuth.mockResolvedValue({ supabase: {}, userId: "u1" });
    const req = new Request("http://localhost/api/center/letter", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json {",
    });
    const res = await POST(req);
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe("Something went wrong");
    expect(mockSubmitCenterLetter).not.toHaveBeenCalled();
  });

  it("returns 400 when service returns body_empty", async () => {
    mockGetLetterAuth.mockResolvedValue({ supabase: {}, userId: "u1" });
    mockSubmitCenterLetter.mockResolvedValue({ ok: false, error: "body_empty" });

    const res = await POST(makeRequest({ body: "" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("body_empty");
    expect(mockSubmitCenterLetter).toHaveBeenCalledOnce();
  });

  it("returns 400 when body is whitespace-only and service returns body_empty", async () => {
    mockGetLetterAuth.mockResolvedValue({ supabase: {}, userId: "u1" });
    mockSubmitCenterLetter.mockResolvedValue({ ok: false, error: "body_empty" });

    const res = await POST(makeRequest({ body: "   \n\t  " }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("body_empty");
    expect(mockSubmitCenterLetter).toHaveBeenCalledOnce();
  });

  it("returns 500 when service returns other error", async () => {
    mockGetLetterAuth.mockResolvedValue({ supabase: {}, userId: "u1" });
    mockSubmitCenterLetter.mockResolvedValue({ ok: false, error: "db_error" });

    const res = await POST(makeRequest({ body: "text" }));
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe("db_error");
  });

  it("returns 200 with saved and reply on success", async () => {
    mockGetLetterAuth.mockResolvedValue({ supabase: {}, userId: "u1" });
    mockSubmitCenterLetter.mockResolvedValue({
      ok: true,
      reply: "편지 잘 받았어요.",
    });

    const res = await POST(makeRequest({ body: "Dear me" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.saved).toBe(true);
    expect(data.reply).toBe("편지 잘 받았어요.");
    expect(mockSubmitCenterLetter).toHaveBeenCalledOnce();
  });

  it("returns 200 with content-type application/json on success", async () => {
    mockGetLetterAuth.mockResolvedValue({ supabase: {}, userId: "u1" });
    mockSubmitCenterLetter.mockResolvedValue({ ok: true, reply: "ok" });

    const res = await POST(makeRequest({ body: "Hi" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/application\/json/);
  });

  it("returns 200 with empty reply when service returns empty string", async () => {
    mockGetLetterAuth.mockResolvedValue({ supabase: {}, userId: "u1" });
    mockSubmitCenterLetter.mockResolvedValue({ ok: true, reply: "" });

    const res = await POST(makeRequest({ body: "Hi" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.saved).toBe(true);
    expect(data.reply).toBe("");
  });

  it("calls submitCenterLetter with locale from body.lang", async () => {
    const mockSupabase = {};
    mockGetLetterAuth.mockResolvedValue({ supabase: mockSupabase, userId: "u2" });
    mockSubmitCenterLetter.mockResolvedValue({ ok: true, reply: "답장" });

    await POST(makeRequest({ body: "편지 내용", lang: "ko" }));

    expect(mockSubmitCenterLetter).toHaveBeenCalledOnce();
    const [, input] = mockSubmitCenterLetter.mock.calls[0];
    expect(input.locale).toBe("ko");
    expect(input.body).toBe("편지 내용");
  });

  it("calls submitCenterLetter with mood, energy, oneWord when provided", async () => {
    mockGetLetterAuth.mockResolvedValue({ supabase: {}, userId: "u1" });
    mockSubmitCenterLetter.mockResolvedValue({ ok: true, reply: "ok" });

    await POST(makeRequest({
      body: "내용",
      mood: "calm",
      energy: 7,
      oneWord: "peace",
      lang: "en",
    }));

    expect(mockSubmitCenterLetter).toHaveBeenCalledOnce();
    const [, input] = mockSubmitCenterLetter.mock.calls[0];
    expect(input.mood).toBe("calm");
    expect(input.energy).toBe(7);
    expect(input.oneWord).toBe("peace");
    expect(input.locale).toBe("en");
  });

  it("returns 500 when submitCenterLetter throws", async () => {
    mockGetLetterAuth.mockResolvedValue({ supabase: {}, userId: "u1" });
    mockSubmitCenterLetter.mockRejectedValue(new Error("db error"));

    const res = await POST(makeRequest({ body: "Hello" }));
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe("Something went wrong");
  });

  it("returns 500 when getLetterAuth throws", async () => {
    mockGetLetterAuth.mockRejectedValue(new Error("auth unavailable"));

    const res = await POST(makeRequest({ body: "Hi" }));
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe("Something went wrong");
    expect(mockSubmitCenterLetter).not.toHaveBeenCalled();
  });

  it("calls submitCenterLetter with undefined locale when body.lang is omitted", async () => {
    mockGetLetterAuth.mockResolvedValue({ supabase: {}, userId: "u1" });
    mockSubmitCenterLetter.mockResolvedValue({ ok: true, reply: "ok" });

    await POST(makeRequest({ body: "Hello" }));

    expect(mockSubmitCenterLetter).toHaveBeenCalledOnce();
    const [, input] = mockSubmitCenterLetter.mock.calls[0];
    expect(input.locale).toBeUndefined();
    expect(input.body).toBe("Hello");
  });

  it("calls submitCenterLetter with undefined mood and energy when omitted", async () => {
    mockGetLetterAuth.mockResolvedValue({ supabase: {}, userId: "u1" });
    mockSubmitCenterLetter.mockResolvedValue({ ok: true, reply: "ok" });

    await POST(makeRequest({ body: "Hi" }));

    expect(mockSubmitCenterLetter).toHaveBeenCalledOnce();
    const [, input] = mockSubmitCenterLetter.mock.calls[0];
    expect(input.mood).toBeUndefined();
    expect(input.energy).toBeUndefined();
    expect(input.oneWord).toBeUndefined();
  });

  it("returns 200 when body has energy 0 (falsy but valid)", async () => {
    mockGetLetterAuth.mockResolvedValue({ supabase: {}, userId: "u1" });
    mockSubmitCenterLetter.mockResolvedValue({ ok: true, reply: "ok" });

    const res = await POST(makeRequest({ body: "Hi", energy: 0 }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.saved).toBe(true);
    const [, input] = mockSubmitCenterLetter.mock.calls[0];
    expect(input.energy).toBe(0);
  });
});
