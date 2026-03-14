import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";

vi.mock("next/headers", () => ({
  cookies: () => Promise.resolve({ getAll: () => [] }),
}));

vi.mock("@/lib/bty/arena/supabaseServer", () => ({
  getSupabaseServerClient: vi.fn(),
}));

const mockSubmitDojo50 = vi.fn();
vi.mock("@/lib/bty/foundry/dojoSubmitService", () => ({
  submitDojo50: (...args: unknown[]) => mockSubmitDojo50(...args),
}));

vi.mock("@/lib/i18n", () => ({
  getMessages: (locale: string) => ({
    dojoResult: {
      resultCommentHigh: locale === "ko" ? "우수 코멘트" : "Strong comment",
      resultCommentMid: locale === "ko" ? "발전 코멘트" : "Developing comment",
      resultCommentLow: locale === "ko" ? "집중 코멘트" : "Needs focus comment",
    },
  }),
}));

const { getSupabaseServerClient } = await import(
  "@/lib/bty/arena/supabaseServer"
);

/** Valid Dojo 50 answers (1..50 → 1..5) for tests. */
function validAnswers(): Record<number, number> {
  const out: Record<number, number> = {};
  for (let q = 1; q <= 50; q++) out[q] = 3;
  return out;
}

function makeRequest(
  body: { answers?: Record<string | number, number> },
  headers?: Record<string, string>
): Request {
  return new Request("http://localhost/api/dojo/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

describe("POST /api/dojo/submit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSupabaseServerClient).mockResolvedValue({
      auth: { getUser: () => Promise.resolve({ data: { user: null } }) },
    } as never);
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getSupabaseServerClient).mockResolvedValue({
      auth: { getUser: () => Promise.resolve({ data: { user: null } }) },
    } as never);

    const res = await POST(makeRequest({ answers: validAnswers() }));
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("UNAUTHENTICATED");
    expect(mockSubmitDojo50).not.toHaveBeenCalled();
  });

  it("returns 400 when body is not valid JSON", async () => {
    vi.mocked(getSupabaseServerClient).mockResolvedValue({
      auth: {
        getUser: () =>
          Promise.resolve({ data: { user: { id: "u1" } } }),
      },
    } as never);

    const req = new Request("http://localhost/api/dojo/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json {",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("invalid_body");
    expect(mockSubmitDojo50).not.toHaveBeenCalled();
  });

  it("returns 400 when service returns validation error", async () => {
    vi.mocked(getSupabaseServerClient).mockResolvedValue({
      auth: {
        getUser: () =>
          Promise.resolve({ data: { user: { id: "u1" } } }),
      },
    } as never);
    mockSubmitDojo50.mockResolvedValue({
      ok: false,
      error: "answers_count",
    });

    const res = await POST(makeRequest({ answers: { 1: 3 } }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("answers_count");
    expect(mockSubmitDojo50).toHaveBeenCalledOnce();
  });

  it("returns 200 with correct response structure on success", async () => {
    vi.mocked(getSupabaseServerClient).mockResolvedValue({
      auth: {
        getUser: () =>
          Promise.resolve({ data: { user: { id: "u1" } } }),
      },
    } as never);
    mockSubmitDojo50.mockResolvedValue({
      ok: true,
      submissionId: "sub-123",
      scores: {
        perspective_taking: 50,
        communication: 60,
        leadership: 70,
        conflict: 55,
        teamwork: 65,
      },
      summaryKey: "high",
    });

    const res = await POST(
      makeRequest({ answers: validAnswers() })
    );
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.submissionId).toBe("sub-123");
    expect(data.summaryKey).toBe("high");
    expect(data.scores).toEqual({
      perspective_taking: 50,
      communication: 60,
      leadership: 70,
      conflict: 55,
      teamwork: 65,
    });
    expect(typeof data.mentorComment).toBe("string");
    expect(mockSubmitDojo50).toHaveBeenCalledOnce();
  });

  it("returns 200 with content-type application/json on success", async () => {
    vi.mocked(getSupabaseServerClient).mockResolvedValue({
      auth: {
        getUser: () =>
          Promise.resolve({ data: { user: { id: "u1" } } }),
      },
    } as never);
    mockSubmitDojo50.mockResolvedValue({
      ok: true,
      submissionId: "sub-1",
      scores: {
        perspective_taking: 30,
        communication: 30,
        leadership: 30,
        conflict: 30,
        teamwork: 30,
      },
      summaryKey: "mid",
    });

    const res = await POST(makeRequest({ answers: validAnswers() }));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/application\/json/);
  });

  it("calls submitDojo50 with normalized answers (string keys 1..50)", async () => {
    vi.mocked(getSupabaseServerClient).mockResolvedValue({
      auth: {
        getUser: () =>
          Promise.resolve({ data: { user: { id: "u2" } } }),
      },
    } as never);
    mockSubmitDojo50.mockResolvedValue({
      ok: true,
      submissionId: "sub-456",
      scores: {
        perspective_taking: 40,
        communication: 50,
        leadership: 60,
        conflict: 45,
        teamwork: 55,
      },
      summaryKey: "mid",
    });

    const raw: Record<string, number> = {};
    for (let q = 1; q <= 50; q++) raw[String(q)] = 2;
    await POST(makeRequest({ answers: raw }));

    expect(mockSubmitDojo50).toHaveBeenCalledOnce();
    const [supabase, userId, answers] = mockSubmitDojo50.mock.calls[0];
    expect(supabase).toBeDefined();
    expect(userId).toBe("u2");
    expect(Object.keys(answers)).toHaveLength(50);
    for (let q = 1; q <= 50; q++) {
      expect(answers[q]).toBe(2);
    }
  });

  it("includes locale-based mentorComment (accept-language)", async () => {
    vi.mocked(getSupabaseServerClient).mockResolvedValue({
      auth: {
        getUser: () =>
          Promise.resolve({ data: { user: { id: "u1" } } }),
      },
    } as never);
    mockSubmitDojo50.mockResolvedValue({
      ok: true,
      submissionId: "x",
      scores: {
        perspective_taking: 0,
        communication: 0,
        leadership: 0,
        conflict: 0,
        teamwork: 0,
      },
      summaryKey: "low",
    });

    const resKo = await POST(
      makeRequest({ answers: validAnswers() }, {
        "accept-language": "ko-KR,en;q=0.9",
      })
    );
    const dataKo = await resKo.json();
    expect(dataKo.mentorComment).toBe("집중 코멘트");

    const resEn = await POST(
      makeRequest({ answers: validAnswers() }, {
        "accept-language": "en-US,en;q=0.9",
      })
    );
    const dataEn = await resEn.json();
    expect(dataEn.mentorComment).toBe("Needs focus comment");
  });

  it("returns 200 when submissionId is null (insert failed)", async () => {
    vi.mocked(getSupabaseServerClient).mockResolvedValue({
      auth: {
        getUser: () =>
          Promise.resolve({ data: { user: { id: "u1" } } }),
      },
    } as never);
    mockSubmitDojo50.mockResolvedValue({
      ok: true,
      submissionId: null,
      scores: {
        perspective_taking: 30,
        communication: 30,
        leadership: 30,
        conflict: 30,
        teamwork: 30,
      },
      summaryKey: "mid",
    });

    const res = await POST(makeRequest({ answers: validAnswers() }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.submissionId).toBeNull();
    expect(data.summaryKey).toBe("mid");
  });

  it("rejects when getSupabaseServerClient rejects", async () => {
    vi.mocked(getSupabaseServerClient).mockRejectedValue(new Error("supabase down"));

    await expect(POST(makeRequest({ answers: validAnswers() }))).rejects.toThrow("supabase down");
    expect(mockSubmitDojo50).not.toHaveBeenCalled();
  });

  it("rejects when submitDojo50 throws", async () => {
    vi.mocked(getSupabaseServerClient).mockResolvedValue({
      auth: {
        getUser: () =>
          Promise.resolve({ data: { user: { id: "u1" } } }),
      },
    } as never);
    mockSubmitDojo50.mockRejectedValue(new Error("db write failed"));

    await expect(POST(makeRequest({ answers: validAnswers() }))).rejects.toThrow("db write failed");
  });
});
