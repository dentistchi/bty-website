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
});
