/**
 * GET /api/train/progress — read train_day_completions for the authed user.
 * Covers: completions read, non-contiguous days, empty, logged-out, DB error, admin missing.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";

const mockGetAuthUserFromRequest = vi.fn();
const mockGetSupabaseAdmin = vi.fn();
vi.mock("@/lib/auth-server", () => ({
  getAuthUserFromRequest: (...args: unknown[]) => mockGetAuthUserFromRequest(...args),
}));
vi.mock("@/lib/supabase-admin", () => ({
  getSupabaseAdmin: () => mockGetSupabaseAdmin(),
}));

function makeRequest(): Request {
  return new Request("http://localhost/api/train/progress");
}

/** Build an admin client whose SELECT chain resolves to { data, error }. */
function adminWith(result: { data: { day: number }[] | null; error: unknown }) {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => Promise.resolve(result),
        }),
      }),
    }),
  };
}

describe("GET /api/train/progress", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthUserFromRequest.mockResolvedValue({ id: "u1" });
    mockGetSupabaseAdmin.mockReturnValue(adminWith({ data: [], error: null }));
  });

  it("returns completedDays and lastCompletedDay from completed rows (1,2,3)", async () => {
    mockGetSupabaseAdmin.mockReturnValue(
      adminWith({ data: [{ day: 1 }, { day: 2 }, { day: 3 }], error: null })
    );

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.hasSession).toBe(true);
    expect(data.completedDays).toEqual([1, 2, 3]);
    expect(data.lastCompletedDay).toBe(3);
  });

  it("preserves non-contiguous completed days (1,3) without filling gaps", async () => {
    mockGetSupabaseAdmin.mockReturnValue(
      adminWith({ data: [{ day: 1 }, { day: 3 }], error: null })
    );

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.completedDays).toEqual([1, 3]);
    expect(data.lastCompletedDay).toBe(3);
  });

  it("returns empty progress when no rows", async () => {
    mockGetSupabaseAdmin.mockReturnValue(adminWith({ data: [], error: null }));

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.hasSession).toBe(true);
    expect(data.completedDays).toEqual([]);
    expect(data.lastCompletedDay).toBe(0);
  });

  it("returns hasSession:false (not 401) when logged out", async () => {
    mockGetAuthUserFromRequest.mockResolvedValue(null);

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.hasSession).toBe(false);
    expect(data.completedDays).toEqual([]);
    expect(data.lastCompletedDay).toBe(0);
    expect(mockGetSupabaseAdmin).not.toHaveBeenCalled();
  });

  it("returns 500 when the completions read errors", async () => {
    mockGetSupabaseAdmin.mockReturnValue(
      adminWith({ data: null, error: { message: "db down" } })
    );

    const res = await GET(makeRequest());
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.ok).toBe(false);
  });

  it("returns 503 when admin client not configured", async () => {
    mockGetSupabaseAdmin.mockReturnValue(null);

    const res = await GET(makeRequest());
    expect(res.status).toBe(503);
    const data = await res.json();
    expect(data.ok).toBe(false);
    expect(data.error).toBe("Server not configured");
  });

  it("sets Cache-Control no-store and Vary Cookie, returns expected keys", async () => {
    mockGetSupabaseAdmin.mockReturnValue(adminWith({ data: [{ day: 1 }], error: null }));

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toContain("no-store");
    expect(res.headers.get("Vary")).toBe("Cookie");
    expect(res.headers.get("content-type")).toMatch(/application\/json/);

    const data = await res.json();
    expect(typeof data.startDateISO).toBe("string");
    expect(data.startDateISO.length).toBeGreaterThan(0);
    expect(data.todayUnlockedDay).toBe(1);
    expect(data.unlockedMaxDay).toBe(1);
    expect(Object.keys(data).sort()).toEqual(
      [
        "completedDays",
        "hasSession",
        "lastCompletedDay",
        "ok",
        "startDateISO",
        "todayUnlockedDay",
        "unlockedMaxDay",
      ].sort()
    );
  });
});
