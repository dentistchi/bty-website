/**
 * GET /api/assessment/submissions — 401·500·200.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";

const mockGetLetterAuth = vi.fn();
const mockGetAssessmentHistory = vi.fn();
vi.mock("@/lib/bty/center", () => ({
  getLetterAuth: (...args: unknown[]) => mockGetLetterAuth(...args),
  getAssessmentHistory: (...args: unknown[]) => mockGetAssessmentHistory(...args),
}));

describe("GET /api/assessment/submissions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetLetterAuth.mockResolvedValue(null);
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetLetterAuth.mockResolvedValue(null);

    const res = await GET();
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("UNAUTHENTICATED");
    expect(mockGetAssessmentHistory).not.toHaveBeenCalled();
  });

  it("returns 500 when service returns error", async () => {
    mockGetLetterAuth.mockResolvedValue({ supabase: {}, userId: "u1" });
    mockGetAssessmentHistory.mockResolvedValue({ ok: false, error: "db_error" });

    const res = await GET();
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe("db_error");
    expect(mockGetAssessmentHistory).toHaveBeenCalledOnce();
  });

  it("returns 200 with submissions array on success", async () => {
    mockGetLetterAuth.mockResolvedValue({ supabase: {}, userId: "u1" });
    mockGetAssessmentHistory.mockResolvedValue({
      ok: true,
      submissions: [
        {
          id: "a1",
          scores: { core: 80, compassion: 70 },
          pattern: "balanced",
          track: "default",
          createdAt: "2026-03-10T00:00:00Z",
        },
      ],
    });

    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.submissions).toHaveLength(1);
    expect(data.submissions[0].id).toBe("a1");
    expect(data.submissions[0].pattern).toBe("balanced");
    expect(mockGetAssessmentHistory).toHaveBeenCalledOnce();
  });

  it("returns 200 with empty submissions when no history", async () => {
    mockGetLetterAuth.mockResolvedValue({ supabase: {}, userId: "u1" });
    mockGetAssessmentHistory.mockResolvedValue({ ok: true, submissions: [] });

    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.submissions).toEqual([]);
  });

  it("returns 200 with content-type application/json on success", async () => {
    mockGetLetterAuth.mockResolvedValue({ supabase: {}, userId: "u1" });
    mockGetAssessmentHistory.mockResolvedValue({ ok: true, submissions: [] });

    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/application\/json/);
  });

  it("returns 200 with multiple submissions in response", async () => {
    mockGetLetterAuth.mockResolvedValue({ supabase: {}, userId: "u1" });
    mockGetAssessmentHistory.mockResolvedValue({
      ok: true,
      submissions: [
        { id: "s1", scores: { core: 20 }, pattern: "p1", track: "t1", createdAt: "2026-03-01T00:00:00Z" },
        { id: "s2", scores: { core: 22 }, pattern: "p2", track: "t2", createdAt: "2026-03-02T00:00:00Z" },
      ],
    });

    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.submissions).toHaveLength(2);
    expect(data.submissions[0].id).toBe("s1");
    expect(data.submissions[1].id).toBe("s2");
  });

  it("calls getAssessmentHistory with auth supabase and userId", async () => {
    const mockSupabase = {};
    mockGetLetterAuth.mockResolvedValue({ supabase: mockSupabase, userId: "user-42" });
    mockGetAssessmentHistory.mockResolvedValue({ ok: true, submissions: [] });

    await GET();

    expect(mockGetAssessmentHistory).toHaveBeenCalledOnce();
    expect(mockGetAssessmentHistory).toHaveBeenCalledWith(mockSupabase, "user-42");
  });

  it("returns 500 when getAssessmentHistory throws", async () => {
    mockGetLetterAuth.mockResolvedValue({ supabase: {}, userId: "u1" });
    mockGetAssessmentHistory.mockRejectedValue(new Error("unexpected"));

    const res = await GET();
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe("Something went wrong");
  });

  it("returns 500 when getLetterAuth throws", async () => {
    mockGetLetterAuth.mockRejectedValue(new Error("auth unavailable"));

    const res = await GET();
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe("Something went wrong");
    expect(mockGetAssessmentHistory).not.toHaveBeenCalled();
  });
});
