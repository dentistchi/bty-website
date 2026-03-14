/**
 * GET /api/dear-me/letters — 401·500·200.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";

const mockGetLetterAuth = vi.fn();
const mockGetLetterHistory = vi.fn();
vi.mock("@/lib/bty/center", () => ({
  getLetterAuth: (...args: unknown[]) => mockGetLetterAuth(...args),
  getLetterHistory: (...args: unknown[]) => mockGetLetterHistory(...args),
}));

describe("GET /api/dear-me/letters", () => {
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
    expect(mockGetLetterHistory).not.toHaveBeenCalled();
  });

  it("returns 500 when service returns error", async () => {
    mockGetLetterAuth.mockResolvedValue({ supabase: {}, userId: "u1" });
    mockGetLetterHistory.mockResolvedValue({ ok: false, error: "db_error" });

    const res = await GET();
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe("db_error");
    expect(mockGetLetterHistory).toHaveBeenCalledOnce();
  });

  it("returns 200 with letters array on success", async () => {
    mockGetLetterAuth.mockResolvedValue({ supabase: {}, userId: "u1" });
    mockGetLetterHistory.mockResolvedValue({
      ok: true,
      letters: [
        {
          id: "l1",
          body: "Hello",
          reply: "Hi",
          createdAt: "2026-03-10T00:00:00Z",
        },
      ],
    });

    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.letters).toHaveLength(1);
    expect(data.letters[0].id).toBe("l1");
    expect(data.letters[0].body).toBe("Hello");
    expect(data.letters[0].reply).toBe("Hi");
    expect(mockGetLetterHistory).toHaveBeenCalledOnce();
  });

  it("returns 200 with empty letters when no history", async () => {
    mockGetLetterAuth.mockResolvedValue({ supabase: {}, userId: "u1" });
    mockGetLetterHistory.mockResolvedValue({ ok: true, letters: [] });

    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.letters).toEqual([]);
  });

  it("returns 200 with content-type application/json on success", async () => {
    mockGetLetterAuth.mockResolvedValue({ supabase: {}, userId: "u1" });
    mockGetLetterHistory.mockResolvedValue({ ok: true, letters: [] });

    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/application\/json/);
  });

  it("returns 200 with multiple letters when history has more than one", async () => {
    mockGetLetterAuth.mockResolvedValue({ supabase: {}, userId: "u1" });
    mockGetLetterHistory.mockResolvedValue({
      ok: true,
      letters: [
        { id: "l1", body: "First", reply: "R1", createdAt: "2026-03-01T00:00:00Z" },
        { id: "l2", body: "Second", reply: "R2", createdAt: "2026-03-02T00:00:00Z" },
      ],
    });

    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.letters).toHaveLength(2);
    expect(data.letters[0].id).toBe("l1");
    expect(data.letters[1].id).toBe("l2");
  });

  it("calls getLetterHistory with supabase and userId from auth", async () => {
    const mockSupabase = {};
    mockGetLetterAuth.mockResolvedValue({ supabase: mockSupabase, userId: "u2" });
    mockGetLetterHistory.mockResolvedValue({ ok: true, letters: [] });

    await GET();

    expect(mockGetLetterHistory).toHaveBeenCalledOnce();
    expect(mockGetLetterHistory).toHaveBeenCalledWith(mockSupabase, "u2");
  });

  it("rejects when getLetterHistory throws", async () => {
    mockGetLetterAuth.mockResolvedValue({ supabase: {}, userId: "u1" });
    mockGetLetterHistory.mockRejectedValue(new Error("db down"));

    await expect(GET()).rejects.toThrow("db down");
  });

  it("rejects when getLetterAuth throws", async () => {
    mockGetLetterAuth.mockRejectedValue(new Error("auth unavailable"));

    await expect(GET()).rejects.toThrow("auth unavailable");
    expect(mockGetLetterHistory).not.toHaveBeenCalled();
  });
});
