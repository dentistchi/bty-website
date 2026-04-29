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
  authCookieSecureForRequest: vi.fn().mockReturnValue(true),
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

  /** C6 248: 잘못된 week·scope → 400 (auth 이전). */
  it("returns 400 for invalid scope or invalid week query", async () => {
    const rScope = await GET(
      makeRequest("http://localhost/api/arena/leaderboard?scope=not-a-scope"),
    );
    expect(rScope.status).toBe(400);
    const dScope = await rScope.json();
    expect(dScope.error).toBe("INVALID_SCOPE");
    expect(typeof dScope.message).toBe("string");

    const rWeek = await GET(
      makeRequest("http://localhost/api/arena/leaderboard?week=not-a-date"),
    );
    expect(rWeek.status).toBe(400);
    const dWeek = await rWeek.json();
    expect(dWeek.error).toBe("INVALID_WEEK");
    expect(typeof dWeek.message).toBe("string");
  });

  /** S81 C3: Monday YYYY-MM-DD but not current week → 400 (before auth). */
  it("returns 400 when week is a Monday but not the current leaderboard week", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-03-18T15:00:00.000Z"));
      const res = await GET(
        makeRequest("http://localhost/api/arena/leaderboard?week=2026-03-09"),
      );
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe("INVALID_WEEK");
      expect(String(data.message)).toMatch(/current/i);
    } finally {
      vi.useRealTimers();
    }
  });

  /** S78 C3: valid scope from domain (overall|role|office) → 200. */
  it("returns 200 for scope=office when authenticated (valid scope from domain)", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    mockFetchWeeklyXpRows.mockResolvedValue({ rows: [], error: null });
    const res = await GET(
      makeRequest("http://localhost/api/arena/leaderboard?scope=office"),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.scope).toBe("office");
  });

  it("returns 401 with message when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("UNAUTHENTICATED");
    expect(data.message).toBe("Sign in to see leaderboard");
  });

  /** C6 250: 기본(overall)·scope=role 모두 비로그인 시 401 짝. */
  it("250: returns 401 unauthenticated for default leaderboard and for scope=role", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const r1 = await GET(makeRequest("http://localhost/api/arena/leaderboard"));
    expect(r1.status).toBe(401);
    expect((await r1.json()).error).toBe("UNAUTHENTICATED");
    const r2 = await GET(
      makeRequest("http://localhost/api/arena/leaderboard?scope=role"),
    );
    expect(r2.status).toBe(401);
    expect((await r2.json()).error).toBe("UNAUTHENTICATED");
  });

  it("returns 401 with JSON body containing only error and message keys", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(Object.keys(data).sort()).toEqual(["error", "message"].sort());
  });

  it("returns 401 with error as string", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(typeof data.error).toBe("string");
  });

  it("returns 401 with content-type application/json", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
    expect(res.headers.get("content-type")).toMatch(/application\/json/);
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

  it("returns 500 with error and detail keys only", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    mockFetchWeeklyXpRows.mockResolvedValue({
      rows: null,
      error: "WEEKLY_XP_QUERY_FAILED",
    });
    const res = await GET(makeRequest());
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(Object.keys(data).sort()).toEqual(["detail", "error"].sort());
  });

  it("returns 200 with content-type application/json", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    mockFetchWeeklyXpRows.mockResolvedValue({ rows: [], error: null });
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/application\/json/);
  });

  it("returns 200 with myXp as number", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    mockFetchWeeklyXpRows.mockResolvedValue({ rows: [], error: null });
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(typeof data.myXp).toBe("number");
  });

  it("returns 200 with myRank as number or null", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    mockFetchWeeklyXpRows.mockResolvedValue({ rows: [], error: null });
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.myRank === null || typeof data.myRank === "number").toBe(true);
  });

  it("returns 200 with count as number", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    mockFetchWeeklyXpRows.mockResolvedValue({ rows: [], error: null });
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(typeof data.count).toBe("number");
  });

  it("returns 200 with nearMe as array", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    mockFetchWeeklyXpRows.mockResolvedValue({ rows: [], error: null });
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.nearMe)).toBe(true);
  });

  it("returns 200 with scope as string", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    mockFetchWeeklyXpRows.mockResolvedValue({ rows: [], error: null });
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(typeof data.scope).toBe("string");
  });

  it("returns 200 with top10 as array", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    mockFetchWeeklyXpRows.mockResolvedValue({ rows: [], error: null });
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.top10)).toBe(true);
  });

  it("returns 200 with leaderboard as array", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    mockFetchWeeklyXpRows.mockResolvedValue({ rows: [], error: null });

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.leaderboard)).toBe(true);
  });

  it("returns 200 with gapToAbove null or number", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    mockFetchWeeklyXpRows.mockResolvedValue({ rows: [], error: null });
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.gapToAbove === null || typeof data.gapToAbove === "number").toBe(true);
  });

  it("returns 200 with champions as array", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    mockFetchWeeklyXpRows.mockResolvedValue({ rows: [], error: null });
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.champions)).toBe(true);
    expect(data.champions.length).toBeLessThanOrEqual(3);
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
    expect(res.headers.get("Cache-Control")).toMatch(/no-store/);
  });

  it("returns 400 INVALID_SCOPE for unknown scope param", async () => {
    const res = await GET(
      makeRequest("http://localhost/api/arena/leaderboard?scope=invalid"),
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("INVALID_SCOPE");
    expect(typeof data.message).toBe("string");
  });

  it("returns 400 INVALID_WEEK for garbage week param", async () => {
    const res = await GET(
      makeRequest("http://localhost/api/arena/leaderboard?week=xyz"),
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("INVALID_WEEK");
  });

  /** C6 241 C4 짝: 라이브 주간 랭킹 빈 주·no-store·count 0. */
  it("241: authenticated empty weekly rows → 200 live shape, count 0, no-store", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    mockFetchWeeklyXpRows.mockResolvedValue({ rows: [], error: null });
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toMatch(/no-store/);
    const data = await res.json();
    expect(data.count).toBe(0);
    expect(data.leaderboard).toEqual([]);
    expect(data.champions).toEqual([]);
    expect(data.top10).toEqual([]);
  });
});
