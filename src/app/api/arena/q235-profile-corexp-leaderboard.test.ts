/**
 * SPRINT 235 C6: GET profile, core-xp, leaderboard — 401·200 batch.
 */
import { NextRequest, NextResponse } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRequireUser = vi.fn();
const mockGetUser = vi.fn();
const mockFetchWeeklyXpRows = vi.fn();

vi.mock("@/lib/supabase/route-client", () => ({
  requireUser: (...args: unknown[]) => mockRequireUser(...args),
  unauthenticated: vi.fn(() =>
    NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 }),
  ),
  copyCookiesAndDebug: vi.fn(),
  mergeAuthCookiesFromResponse: vi.fn(),
}));

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

const { GET: getProfile } = await import("./profile/route");
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
    rpc: vi.fn().mockResolvedValue({}),
  };
}

describe("Q235 profile · core-xp · leaderboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireUser.mockImplementation(async (req: NextRequest) => {
      if (req.nextUrl.pathname.includes("core-xp")) {
        return {
          user: null,
          supabase: {},
          base: {},
        };
      }
      return { user: null, supabase: {}, base: {} };
    });
    mockGetUser.mockResolvedValue({ data: { user: null } });
    mockFetchWeeklyXpRows.mockResolvedValue({ rows: [], error: null });
  });

  it("401: unauthenticated profile, core-xp, leaderboard", async () => {
    const p = await getProfile(
      new NextRequest("http://localhost/api/arena/profile"),
    );
    expect(p.status).toBe(401);

    const c = await getCoreXp(
      new NextRequest("http://localhost/api/arena/core-xp"),
    );
    expect(c.status).toBe(401);

    const l = await getLeaderboard(
      new NextRequest("http://localhost/api/arena/leaderboard"),
    );
    expect(l.status).toBe(401);
  });

  it("200: authenticated profile, core-xp, leaderboard", async () => {
    const profileSb = {
      rpc: vi.fn().mockResolvedValue({}),
      from: () => ({
        select: () => ({
          eq: () => ({
            single: () =>
              Promise.resolve({
                data: {
                  user_id: "u1",
                  avatar_character_id: null,
                  core_xp_total: 0,
                },
                error: null,
              }),
          }),
        }),
      }),
    };

    mockRequireUser.mockImplementation(async (req: NextRequest) => {
      if (req.nextUrl.pathname.includes("core-xp")) {
        return {
          user: { id: "u1" },
          supabase: makeCoreXpSupabase(),
          base: {},
        };
      }
      return {
        user: { id: "u1" },
        supabase: profileSb,
        base: {},
      };
    });

    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });

    const p = await getProfile(
      new NextRequest("http://localhost/api/arena/profile"),
    );
    expect(p.status).toBe(200);
    const jp = await p.json();
    expect(jp.profile).toBeDefined();
    expect(jp.avatarCharacterId).toBeNull();

    const c = await getCoreXp(
      new NextRequest("http://localhost/api/arena/core-xp"),
    );
    expect(c.status).toBe(200);
    expect((await c.json()).coreXpTotal).toBe(0);

    const l = await getLeaderboard(
      new NextRequest("http://localhost/api/arena/leaderboard"),
    );
    expect(l.status).toBe(200);
    expect(Array.isArray((await l.json()).leaderboard)).toBe(true);
  });
});
