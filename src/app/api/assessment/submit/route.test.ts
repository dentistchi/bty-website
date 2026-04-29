/**
 * POST /api/assessment/submit — 401·400·200·insert 실패(200, submissionId null).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";

const mockGetLetterAuth = vi.fn();
const mockSubmitAssessment = vi.fn();
vi.mock("@/lib/bty/center", () => ({
  getLetterAuth: (...args: unknown[]) => mockGetLetterAuth(...args),
  submitAssessment: (...args: unknown[]) => mockSubmitAssessment(...args),
}));

/** Valid assessment answers: 50 questions, values 1..5. */
function validAnswers(): Record<string, number> {
  const out: Record<string, number> = {};
  for (let q = 1; q <= 50; q++) out[String(q)] = 3;
  return out;
}

function makeRequest(body: { answers?: Record<string, number> }): Request {
  return new Request("http://localhost/api/assessment/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/assessment/submit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetLetterAuth.mockResolvedValue(null);
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetLetterAuth.mockResolvedValue(null);

    const res = await POST(makeRequest({ answers: validAnswers() }));
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("UNAUTHENTICATED");
    expect(mockSubmitAssessment).not.toHaveBeenCalled();
  });

  it("returns 401 with JSON body containing only error key", async () => {
    mockGetLetterAuth.mockResolvedValue(null);
    const res = await POST(makeRequest({ answers: validAnswers() }));
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(Object.keys(data)).toEqual(["error"]);
  });

  it("returns 400 when body is not valid JSON", async () => {
    mockGetLetterAuth.mockResolvedValue(new Error('auth unavailable')).mockResolvedValue({
      supabase: {},
      userId: "u1",
    });

    const req = new Request("http://localhost/api/assessment/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json {",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("invalid_body");
    expect(mockSubmitAssessment).not.toHaveBeenCalled();
  });

  it("returns 400 with only error key when body is not valid JSON", async () => {
    mockGetLetterAuth.mockResolvedValue(new Error('auth unavailable')).mockResolvedValue({ supabase: {}, userId: "u1" });
    const req = new Request("http://localhost/api/assessment/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json {",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(Object.keys(data)).toEqual(["error"]);
  });

  it("returns 400 when service returns validation error", async () => {
    mockGetLetterAuth.mockResolvedValue(new Error('auth unavailable')).mockResolvedValue({
      supabase: {},
      userId: "u1",
    });
    mockSubmitAssessment.mockResolvedValue(new Error('db connection lost')).mockResolvedValue({
      ok: false,
      error: "answers_invalid",
    });

    const res = await POST(makeRequest({ answers: { 1: 3 } }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("answers_invalid");
    expect(mockSubmitAssessment).toHaveBeenCalledOnce();
  });

  it("returns 400 with only error key when no detail", async () => {
    mockGetLetterAuth.mockResolvedValue(new Error('auth unavailable')).mockResolvedValue({ supabase: {}, userId: "u1" });
    mockSubmitAssessment.mockResolvedValue(new Error('db connection lost')).mockResolvedValue({ ok: false, error: "answers_invalid" });
    const res = await POST(makeRequest({ answers: { 1: 3 } }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(Object.keys(data)).toEqual(["error"]);
  });

  it("returns 400 with detail when service returns error and detail", async () => {
    mockGetLetterAuth.mockResolvedValue(new Error('auth unavailable')).mockResolvedValue({ supabase: {}, userId: "u1" });
    mockSubmitAssessment.mockResolvedValue(new Error('db connection lost')).mockResolvedValue({
      ok: false,
      error: "answers_invalid",
      detail: "Missing keys: 2,3,...,50",
    });

    const res = await POST(makeRequest({ answers: { 1: 3 } }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("answers_invalid");
    expect(data.detail).toBe("Missing keys: 2,3,...,50");
  });

  it("returns 200 with exactly submissionId, scores, pattern, recommendedTrack keys", async () => {
    mockGetLetterAuth.mockResolvedValue(new Error('auth unavailable')).mockResolvedValue({ supabase: {}, userId: "u1" });
    mockSubmitAssessment.mockResolvedValue(new Error('db connection lost')).mockResolvedValue({
      ok: true,
      submissionId: "sub-1",
      scores: { core: 20, compassion: 20, stability: 20, growth: 20, social: 20 },
      pattern: "balanced",
      track: "default",
    });

    const res = await POST(makeRequest({ answers: validAnswers() }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Object.keys(data).sort()).toEqual(
      ["pattern", "recommendedTrack", "scores", "submissionId"].sort()
    );
  });

  it("returns 200 with submissionId, scores, pattern, recommendedTrack on success", async () => {
    mockGetLetterAuth.mockResolvedValue(new Error('auth unavailable')).mockResolvedValue({
      supabase: {},
      userId: "u1",
    });
    mockSubmitAssessment.mockResolvedValue(new Error('db connection lost')).mockResolvedValue({
      ok: true,
      submissionId: "sub-123",
      scores: {
        core: 24,
        compassion: 22,
        stability: 20,
        growth: 18,
        social: 26,
      },
      pattern: "balanced",
      track: "default",
    });

    const res = await POST(makeRequest({ answers: validAnswers() }));
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.submissionId).toBe("sub-123");
    expect(data.scores).toEqual({
      core: 24,
      compassion: 22,
      stability: 20,
      growth: 18,
      social: 26,
    });
    expect(data.pattern).toBe("balanced");
    expect(data.recommendedTrack).toBe("default");
    expect(mockSubmitAssessment).toHaveBeenCalledOnce();
  });

  it("returns 200 with content-type application/json on success", async () => {
    mockGetLetterAuth.mockResolvedValue(new Error('auth unavailable')).mockResolvedValue({ supabase: {}, userId: "u1" });
    mockSubmitAssessment.mockResolvedValue(new Error('db connection lost')).mockResolvedValue({
      ok: true,
      submissionId: "sub-1",
      scores: { core: 20, compassion: 20, stability: 20, growth: 20, social: 20 },
      pattern: "balanced",
      track: "default",
    });

    const res = await POST(makeRequest({ answers: validAnswers() }));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/application\/json/);
  });

  it("returns 200 when submissionId is null (insert failed)", async () => {
    mockGetLetterAuth.mockResolvedValue(new Error('auth unavailable')).mockResolvedValue({
      supabase: {},
      userId: "u1",
    });
    mockSubmitAssessment.mockResolvedValue(new Error('db connection lost')).mockResolvedValue({
      ok: true,
      submissionId: null,
      scores: {
        core: 20,
        compassion: 20,
        stability: 20,
        growth: 20,
        social: 20,
      },
      pattern: "balanced",
      track: "default",
    });

    const res = await POST(makeRequest({ answers: validAnswers() }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.submissionId).toBeNull();
    expect(data.scores).toBeDefined();
    expect(data.pattern).toBe("balanced");
    expect(data.recommendedTrack).toBe("default");
  });

  it("returns 200 with recommendedTrack from service when non-default", async () => {
    mockGetLetterAuth.mockResolvedValue(new Error('auth unavailable')).mockResolvedValue({ supabase: {}, userId: "u1" });
    mockSubmitAssessment.mockResolvedValue(new Error('db connection lost')).mockResolvedValue({
      ok: true,
      submissionId: "sub-1",
      scores: { core: 18, compassion: 28, stability: 20, growth: 22, social: 20 },
      pattern: "compassion_focus",
      track: "compassion_path",
    });

    const res = await POST(makeRequest({ answers: validAnswers() }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.recommendedTrack).toBe("compassion_path");
    expect(data.pattern).toBe("compassion_focus");
  });

  it("returns 200 and passes through pattern and track from service", async () => {
    mockGetLetterAuth.mockResolvedValue(new Error('auth unavailable')).mockResolvedValue({ supabase: {}, userId: "u1" });
    mockSubmitAssessment.mockResolvedValue(new Error('db connection lost')).mockResolvedValue({
      ok: true,
      submissionId: "sub-x",
      scores: { core: 20, compassion: 20, stability: 20, growth: 20, social: 20 },
      pattern: "balanced-growth",
      track: "growth_path",
    });

    const res = await POST(makeRequest({ answers: validAnswers() }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.pattern).toBe("balanced-growth");
    expect(data.recommendedTrack).toBe("growth_path");
  });

  it("calls submitAssessment with userId and answers from auth and body", async () => {
    const mockSupabase = {};
    mockGetLetterAuth.mockResolvedValue(new Error('auth unavailable')).mockResolvedValue({
      supabase: mockSupabase,
      userId: "u2",
    });
    mockSubmitAssessment.mockResolvedValue(new Error('db connection lost')).mockResolvedValue({
      ok: true,
      submissionId: "id",
      scores: { core: 0, compassion: 0, stability: 0, growth: 0, social: 0 },
      pattern: "x",
      track: "y",
    });

    await POST(makeRequest({ answers: validAnswers() }));

    expect(mockSubmitAssessment).toHaveBeenCalledOnce();
    const [supabase, input] = mockSubmitAssessment.mock.calls[0];
    expect(supabase).toBe(mockSupabase);
    expect(input.userId).toBe("u2");
    expect(Object.keys(input.answers)).toHaveLength(50);
    expect(input.questions).toBeDefined();
    expect(Array.isArray(input.questions)).toBe(true);
  });

  it("returns 500 when submitAssessment throws", async () => {
    mockGetLetterAuth.mockResolvedValue(new Error('auth unavailable')).mockResolvedValue({
      supabase: {},
      userId: "u1",
    });
    mockSubmitAssessment.mockRejectedValue(new Error("db connection lost"));

    const res = await POST(makeRequest({ answers: validAnswers() }));
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe("Something went wrong");
  });

  it("returns 500 when getLetterAuth throws", async () => {
    mockGetLetterAuth.mockRejectedValue(new Error("auth unavailable"));

    const res = await POST(makeRequest({ answers: validAnswers() }));
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe("Something went wrong");
    expect(mockSubmitAssessment).not.toHaveBeenCalled();
  });

  it("calls submitAssessment with empty answers when body.answers is omitted", async () => {
    mockGetLetterAuth.mockResolvedValue(new Error('auth unavailable')).mockResolvedValue({ supabase: {}, userId: "u1" });
    mockSubmitAssessment.mockResolvedValue(new Error('db connection lost')).mockResolvedValue({
      ok: false,
      error: "answers_invalid",
    });

    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
    expect(mockSubmitAssessment).toHaveBeenCalledOnce();
    const [, input] = mockSubmitAssessment.mock.calls[0];
    expect(input.answers).toEqual({});
  });
});
