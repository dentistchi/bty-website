/**
 * POST /api/dear-me/letter — 401·400·200.
 */
import type { NextRequest } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";

const mockGetLetterAuth = vi.fn();
const mockSubmitLetter = vi.fn();
vi.mock("@/lib/bty/center", () => ({
  getLetterAuth: (...args: unknown[]) => mockGetLetterAuth(...args),
  submitLetter: (...args: unknown[]) => mockSubmitLetter(...args),
}));

function makeRequest(body: {
  letterText?: string;
  lang?: string;
  useLlm?: boolean;
}): NextRequest {
  return new Request("http://localhost/api/dear-me/letter", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

describe("POST /api/dear-me/letter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetLetterAuth.mockResolvedValue(null);
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetLetterAuth.mockResolvedValue(null);

    const res = await POST(makeRequest({ letterText: "Hello self" }));
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("Unauthorized");
    expect(mockSubmitLetter).not.toHaveBeenCalled();
  });

  it("returns 401 with error as string", async () => {
    mockGetLetterAuth.mockResolvedValue(null);
    const res = await POST(makeRequest({ letterText: "Hi", lang: "en" }));
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(typeof data.error).toBe("string");
  });

  it("returns 401 with JSON body containing only error key", async () => {
    mockGetLetterAuth.mockResolvedValue(null);
    const res = await POST(makeRequest({ letterText: "Hi" }));
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(Object.keys(data)).toEqual(["error"]);
  });

  it("returns 400 when body is not valid JSON", async () => {
    mockGetLetterAuth.mockResolvedValue({ supabase: {}, userId: "u1" });

    const req = new Request("http://localhost/api/dear-me/letter", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json {",
    }) as unknown as NextRequest;
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("missing_text");
    expect(mockSubmitLetter).not.toHaveBeenCalled();
  });

  it("returns 400 when service returns validation error", async () => {
    mockGetLetterAuth.mockResolvedValue({ supabase: {}, userId: "u1" });
    mockSubmitLetter.mockResolvedValue({ ok: false, error: "text_too_long" });

    const res = await POST(makeRequest({ letterText: "x" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("text_too_long");
    expect(mockSubmitLetter).toHaveBeenCalledOnce();
  });

  it("returns 400 with JSON body containing only error key", async () => {
    mockGetLetterAuth.mockResolvedValue({ supabase: {}, userId: "u1" });
    mockSubmitLetter.mockResolvedValue({ ok: false, error: "text_too_long" });
    const res = await POST(makeRequest({ letterText: "x" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(Object.keys(data)).toEqual(["error"]);
  });

  it("returns 200 with letterId as string", async () => {
    mockGetLetterAuth.mockResolvedValue({ supabase: {}, userId: "u1" });
    mockSubmitLetter.mockResolvedValue({
      ok: true,
      letterId: "letter-1",
      reply: "Thanks.",
    });
    const res = await POST(makeRequest({ letterText: "Hi" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(typeof data.letterId).toBe("string");
    expect(data.letterId.length).toBeGreaterThan(0);
  });

  it("returns 200 with letterId and replyMessage on success", async () => {
    mockGetLetterAuth.mockResolvedValue({ supabase: {}, userId: "u1" });
    mockSubmitLetter.mockResolvedValue({
      ok: true,
      letterId: "letter-123",
      reply: "Thank you for writing.",
    });

    const res = await POST(makeRequest({ letterText: "Dear me" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.letterId).toBe("letter-123");
    expect(data.replyMessage).toBe("Thank you for writing.");
    expect(mockSubmitLetter).toHaveBeenCalledOnce();
  });

  it("returns 200 with replyMessage as string", async () => {
    mockGetLetterAuth.mockResolvedValue({ supabase: {}, userId: "u1" });
    mockSubmitLetter.mockResolvedValue({
      ok: true,
      letterId: "l1",
      reply: "Got it.",
    });
    const res = await POST(makeRequest({ letterText: "Hi" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(typeof data.replyMessage).toBe("string");
  });

  it("returns 200 with exactly letterId and replyMessage keys", async () => {
    mockGetLetterAuth.mockResolvedValue({ supabase: {}, userId: "u1" });
    mockSubmitLetter.mockResolvedValue({
      ok: true,
      letterId: "l1",
      reply: "OK",
    });
    const res = await POST(makeRequest({ letterText: "Hi" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Object.keys(data).sort()).toEqual(["letterId", "replyMessage"].sort());
  });

  it("returns 200 with content-type application/json on success", async () => {
    mockGetLetterAuth.mockResolvedValue({ supabase: {}, userId: "u1" });
    mockSubmitLetter.mockResolvedValue({
      ok: true,
      letterId: "l1",
      reply: "OK",
    });

    const res = await POST(makeRequest({ letterText: "Hi" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/application\/json/);
  });

  it("returns 200 with empty replyMessage when service returns empty reply", async () => {
    mockGetLetterAuth.mockResolvedValue({ supabase: {}, userId: "u1" });
    mockSubmitLetter.mockResolvedValue({
      ok: true,
      letterId: "letter-1",
      reply: "",
    });

    const res = await POST(makeRequest({ letterText: "Hi" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.letterId).toBe("letter-1");
    expect(data.replyMessage).toBe("");
  });

  it("calls submitLetter with locale from body.lang", async () => {
    const mockSupabase = {};
    mockGetLetterAuth.mockResolvedValue({ supabase: mockSupabase, userId: "u2" });
    mockSubmitLetter.mockResolvedValue({
      ok: true,
      letterId: "l1",
      reply: "답장",
    });

    await POST(makeRequest({ letterText: "편지 내용", lang: "ko" }));

    expect(mockSubmitLetter).toHaveBeenCalledOnce();
    const [, input] = mockSubmitLetter.mock.calls[0];
    expect(input.locale).toBe("ko");
    expect(input.body).toBe("편지 내용");
  });

  it("calls submitLetter with empty body when letterText is not a string", async () => {
    mockGetLetterAuth.mockResolvedValue({ supabase: {}, userId: "u1" });
    mockSubmitLetter.mockResolvedValue({
      ok: true,
      letterId: "l1",
      reply: "OK",
    });

    const req = new Request("http://localhost/api/dear-me/letter", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ letterText: 123 }),
    }) as unknown as NextRequest;
    await POST(req);

    expect(mockSubmitLetter).toHaveBeenCalledOnce();
    const [, input] = mockSubmitLetter.mock.calls[0];
    expect(input.body).toBe("");
  });

  it("returns 500 when submitLetter throws", async () => {
    mockGetLetterAuth.mockResolvedValue({ supabase: {}, userId: "u1" });
    mockSubmitLetter.mockRejectedValue(new Error("service error"));

    const res = await POST(makeRequest({ letterText: "Hello" }));
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe("Something went wrong");
  });

  it("returns 500 with error as string when submitLetter throws", async () => {
    mockGetLetterAuth.mockResolvedValue({ supabase: {}, userId: "u1" });
    mockSubmitLetter.mockRejectedValue(new Error("service error"));
    const res = await POST(makeRequest({ letterText: "Hi" }));
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(typeof data.error).toBe("string");
  });

  it("returns 500 when getLetterAuth throws", async () => {
    mockGetLetterAuth.mockRejectedValue(new Error("auth unavailable"));

    const res = await POST(makeRequest({ letterText: "Hi" }));
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe("Something went wrong");
    expect(mockSubmitLetter).not.toHaveBeenCalled();
  });

  it("calls submitLetter with undefined locale when body.lang is omitted", async () => {
    mockGetLetterAuth.mockResolvedValue({ supabase: {}, userId: "u1" });
    mockSubmitLetter.mockResolvedValue({
      ok: true,
      letterId: "l1",
      reply: "Thanks",
    });

    await POST(makeRequest({ letterText: "Hello" }));

    expect(mockSubmitLetter).toHaveBeenCalledOnce();
    const [, input] = mockSubmitLetter.mock.calls[0];
    expect(input.locale).toBeUndefined();
    expect(input.body).toBe("Hello");
  });

  it("calls submitLetter with useLlm true when body.useLlm is true", async () => {
    mockGetLetterAuth.mockResolvedValue({ supabase: {}, userId: "u1" });
    mockSubmitLetter.mockResolvedValue({
      ok: true,
      letterId: "l1",
      reply: "Reply",
    });

    await POST(makeRequest({ letterText: "Hello", useLlm: true }));

    expect(mockSubmitLetter).toHaveBeenCalledOnce();
    const [, input] = mockSubmitLetter.mock.calls[0];
    expect(input.useLlm).toBe(true);
  });
});
