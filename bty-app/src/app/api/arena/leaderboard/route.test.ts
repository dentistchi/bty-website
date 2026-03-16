/**
 * GET /api/arena/leaderboard — 401·500 (Arena §6·§7·§8).
 * 인증 실패(401)·에러 응답(500) 테스트.
 */
import { NextRequest } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";

const mockGetUser = vi.fn();
const mockFetchWeeklyXpRows = vi.fn();

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: { getUser: () => mockGetUser() },
  }),
}));

vi.mock("@/lib/bty/cookies/authCookies", () => ({
  writeSupabaseAuthCookies: vi.fn(),
}));

vi.mock("@/lib/supabase-admin", () => ({
  getSupabaseAdmin: () => null,
}));

vi.mock("@/lib/bty/arena/leaderboardService", () => ({
  getScopeFilter: vi.fn().mockResolvedValue({ userIds: null, scopeLabel: null }),
  fetchWeeklyXpRows: (...args: unknown[]) => mockFetchWeeklyXpRows(...args),
  fetchProfileMap: vi.fn().mockResolvedValue(new Map()),
  buildLeaderboardRows: vi.fn().mockReturnValue([]),
  resolveMyRank: vi.fn().mockResolvedValue({ myRank: 0, myXp: 0, gapToAbove: null }),
}));

vi.mock("@/lib/bty/arena/activeLeague", () => ({
  getActiveLeague: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/bty/arena/leaderboardWeekBoundary", () => ({
  getLeaderboardWeekBoundary: vi.fn().mockReturnValue({ week_end: null, reset_at: null }),
}));

function makeRequest(url = "http://localhost/api/arena/leaderboard"): NextRequest {
  return new NextRequest(url);
}

describe("GET /api/arena/leaderboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: null } });
    mockFetchWeeklyXpRows.mockResolvedValue({ rows: [], error: null });
  });

  it("returns 401 with message when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("UNAUTHENTICATED");
    expect(data.message).toBe("Sign in to see leaderboard");
  });

  it("returns 401 with JSON body containing only error and message keys", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(Object.keys(data).sort()).toEqual(["error", "message"].sort());
  });

  it("returns 500 when fetchWeeklyXpRows fails", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    mockFetchWeeklyXpRows.mockResolvedValue({
      rows: null,
      error: "WEEKLY_XP_QUERY_FAILED",
    });

    const res = await GET(makeRequest());
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe("WEEKLY_XP_QUERY_FAILED");
    expect(data.detail).toBeDefined();
  });

  it("returns 200 with expected response keys when successful", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    mockFetchWeeklyXpRows.mockResolvedValue({ rows: [], error: null });

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const data = await res.json();
    const expectedKeys = [
      "champions",
      "count",
      "gapToAbove",
      "leaderboard",
      "myRank",
      "myXp",
      "nearMe",
      "reset_at",
      "scope",
      "scopeLabel",
      "scopeUnavailable",
      "season",
      "top10",
      "week_end",
    ].sort();
    expect(Object.keys(data).sort()).toEqual(expectedKeys);
  });
});
