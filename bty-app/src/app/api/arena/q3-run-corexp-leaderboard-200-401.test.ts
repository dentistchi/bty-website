/**
 * Q3: POST run/complete, GET core-xp, GET leaderboard — 200·401 batch contract.
 */
import { NextRequest } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRequireUser = vi.fn();
const mockGetUser = vi.fn();
const mockFetchWeeklyXpRows = vi.fn();

vi.mock("next/headers", () => ({
  cookies: () => Promise.resolve({ getAll: () => [] }),
}));

vi.mock("@/lib/bty/arena/supabaseServer", () => ({
  getSupabaseServerClient: vi.fn(() =>
    Promise.resolve({
      auth: {
        getUser: () => Promise.resolve({ data: { user: null } }),
      },
      from: () => ({
        select: () => ({
          eq: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }),
        }),
      }),
      rpc: () => Promise.resolve({ error: null }),
    }),
  ),
}));

vi.mock("@/lib/bty/arena/applyCoreXp", () => ({
  applyDirectCoreXp: vi.fn(),
  applySeasonalXpToCore: vi.fn(),
}));

vi.mock("@/lib/bty/arena/weeklyQuest", () => ({
  getWeekStartUTC: () => "2026-03-02",
  REFLECTION_QUEST_TARGET: 3,
  REFLECTION_QUEST_BONUS_XP: 15,
}));

vi.mock("@/lib/supabase/route-client", () => ({
  requireUser: (...args: unknown[]) => mockRequireUser(...args),
  unauthenticated: vi.fn(
    () =>
      new Response(JSON.stringify({ error: "UNAUTHENTICATED" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
  ),
  copyCookiesAndDebug: vi.fn(),
}));

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
  resolveMyRank: vi.fn().mockResolvedValue({
    myRank: 0,
    myXp: 0,
    gapToAbove: null,
  }),
}));

vi.mock("@/lib/bty/arena/activeLeague", () => ({
  getActiveLeague: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/bty/arena/leaderboardWeekBoundary", () => ({
  getLeaderboardWeekBoundary: vi.fn().mockReturnValue({
    week_end: null,
    reset_at: null,
  }),
}));

const { POST: postRunComplete } = await import("./run/complete/route");
const { GET: getCoreXp } = await import("./core-xp/route");
const { GET: getLeaderboard } = await import("./leaderboard/route");

function makeCoreXpSupabase() {
  const countResult = { count: 0, error: null };
  const countThenable = Object.assign(Promise.resolve(countResult), {
    gt: () => Promise.resolve(countResult),
  });
  return {
    from: vi.fn().mockImplementation((table: string) => {
      const select = vi.fn().mockImplementation(
        (_sel: string | unknown, opts?: { count?: string; head?: boolean }) => {
          if (opts?.count === "exact" && opts?.head === true) {
            return { is: () => countThenable };
          }
          const maybeSingle = vi
            .fn()
            .mockResolvedValue({ data: null, error: null });
          return {
            eq: vi.fn().mockReturnValue({
              is: vi.fn().mockReturnValue({ maybeSingle }),
              maybeSingle:
                table === "arena_profiles" ? maybeSingle : undefined,
            }),
          };
        },
      );
      return { select };
    }),
  };
}

describe("Q3 run/complete · core-xp · leaderboard — 200·401", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireUser.mockResolvedValue({
      user: null,
      supabase: {},
      base: {},
    });
    mockGetUser.mockResolvedValue({ data: { user: null } });
    mockFetchWeeklyXpRows.mockResolvedValue({ rows: [], error: null });
  });

  it("401: unauthenticated POST run/complete, GET core-xp, GET leaderboard", async () => {
    const r1 = await postRunComplete(
      new Request("http://localhost/api/arena/run/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId: "run-1" }),
      }),
    );
    expect(r1.status).toBe(401);
    expect((await r1.json()).error).toBe("UNAUTHENTICATED");
    expect(r1.headers.get("content-type")).toMatch(/application\/json/);

    const r2 = await getCoreXp(
      new NextRequest("http://localhost/api/arena/core-xp"),
    );
    expect(r2.status).toBe(401);
    expect((await r2.json()).error).toBe("UNAUTHENTICATED");

    const r3 = await getLeaderboard(
      new NextRequest("http://localhost/api/arena/leaderboard"),
    );
    expect(r3.status).toBe(401);
    const j3 = await r3.json();
    expect(j3.error).toBe("UNAUTHENTICATED");
    expect(j3.message).toBe("Sign in to see leaderboard");
  });

  it("200: authenticated GET core-xp and GET leaderboard", async () => {
    mockRequireUser.mockResolvedValue({
      user: { id: "u1" },
      supabase: makeCoreXpSupabase(),
      base: {},
    });
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });

    const r2 = await getCoreXp(
      new NextRequest("http://localhost/api/arena/core-xp"),
    );
    expect(r2.status).toBe(200);
    const d2 = await r2.json();
    expect(d2.error).toBeUndefined();
    expect(typeof d2.coreXpTotal).toBe("number");

    const r3 = await getLeaderboard(
      new NextRequest("http://localhost/api/arena/leaderboard"),
    );
    expect(r3.status).toBe(200);
    const d3 = await r3.json();
    expect(d3.error).toBeUndefined();
    expect(Array.isArray(d3.leaderboard)).toBe(true);
    expect(r3.headers.get("Cache-Control")).toMatch(/no-store/);
  });
});
