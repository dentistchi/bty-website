import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * SLICE 3.2R-R9C — THE LEADERBOARD ANSWERED STRANGERS.
 *
 * `GET /api/arena/leaderboard` returned 200 to an unauthenticated caller in production, with real
 * display names, user UUIDs, XP and avatars for every ranked learner.
 *
 * WHY THE EXISTING SUITE NEVER SAW IT. `route.test.ts` mocks the service role away —
 * `vi.mock("@/lib/supabase-admin", () => ({ getSupabaseAdmin: () => null }))` — and the anonymous
 * branch is guarded by `if (!user && scope === "overall" && admin)`. With `admin` null the branch
 * is skipped, the route falls through to 401, and test "250" passes while asserting exactly the
 * contract the spec documents. Production is the one environment where the service role IS
 * configured, so the branch only ever activated there.
 *
 * That is the whole defect: the exposure was conditioned on infrastructure availability rather
 * than on a product decision. This test therefore mocks the service role as PRESENT — the
 * production shape — which is the only way to observe it.
 *
 * AUTHORITY: `docs/spec/ARENA_DOMAIN_SPEC.md` §4-4 documents this route's unauthenticated
 * behaviour as `401 UNAUTHENTICATED`, no doc anywhere mentions `viewerAnonymous`, the
 * `/[locale]/bty/leaderboard` page is middleware-protected (307 to login when signed out), and the
 * sibling anonymous convention on `/api/arena/runs` returns an EMPTY list. Nothing authorised a
 * public roster of named learners.
 */

const mockGetUser = vi.fn();

/*
  R9B.2: these routes now require CURRENT consent. This suite is about the route's own behaviour,
  and its subject has always been an ordinary consented learner — so the consent primitive says so
  explicitly. The consent VERDICT itself is proven by `requireConsentedUser.test.ts` and
  `learnerConsentGuard.route.test.ts`, which do not mock it.
*/
vi.mock("@/lib/legal/activeConsent", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/legal/activeConsent")>()),
  isConsentCurrent: async () => true,
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({ auth: { getUser: () => mockGetUser() } }),
}));

vi.mock("@/lib/bty/cookies/authCookies", () => ({
  writeSupabaseAuthCookies: vi.fn(),
  authCookieSecureForRequest: vi.fn().mockReturnValue(true),
}));

/** PRESENT, unlike the existing suite — this is the production configuration. */
const adminStub = { from: vi.fn() };
vi.mock("@/lib/supabase-admin", () => ({ getSupabaseAdmin: () => adminStub }));

/** Rows exist, so a leak would have real content to leak. */
vi.mock("@/lib/bty/arena/leaderboardService", () => ({
  getScopeFilter: vi.fn().mockResolvedValue({ userIds: null, scopeLabel: null }),
  fetchWeeklyXpRows: vi.fn().mockResolvedValue({
    rows: [{ user_id: "11111111-1111-1111-1111-111111111111", xp_total: 10 }],
    error: null,
  }),
  fetchProfileMap: vi.fn().mockResolvedValue(new Map()),
  buildLeaderboardRows: vi.fn().mockReturnValue([
    {
      userId: "11111111-1111-1111-1111-111111111111",
      displayName: "A Real Person",
      rank: 1,
      xpTotal: 10,
      coreXpTotal: 252,
    },
  ]),
  resolveMyRank: vi.fn().mockResolvedValue({ myRank: 0, myXp: 0, gapToAbove: null }),
}));

vi.mock("@/lib/bty/arena/activeLeague", () => ({ getActiveLeague: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/bty/arena/leaderboardWeekBoundary", () => ({
  getLeaderboardWeekBoundary: vi.fn().mockReturnValue({ week_end: null, reset_at: null }),
}));
vi.mock("@/lib/supabase/route-client", () => ({ mergeAuthCookiesFromResponse: vi.fn() }));

const req = (url = "http://localhost/api/arena/leaderboard") => new NextRequest(url);

beforeEach(() => vi.clearAllMocks());

describe("[3.2R-R9C] the leaderboard requires a session, even where the service role exists", () => {
  it("case 1 — unauthenticated overall → 401, with the service role AVAILABLE", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const { GET } = await import("./route");
    const res = await GET(req());

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("UNAUTHENTICATED");
    // The 401 body carries only error + message — the documented shape, and no roster.
    expect(Object.keys(body).sort()).toEqual(["error", "message"]);
  });

  it("no identity, XP or ranking reaches an anonymous caller", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const { GET } = await import("./route");
    const raw = await (await GET(req())).text();

    // Note: the refusal MESSAGE legitimately contains the word "leaderboard"
    // ("Sign in to see leaderboard"); what must never appear is roster DATA.
    for (const leaked of ["A Real Person", "11111111-1111-1111-1111-111111111111", "coreXpTotal", "xpTotal", "rank"]) {
      expect(raw, `must not leak ${leaked}`).not.toContain(leaked);
    }
  });

  it("the refusal is not scope-dependent — an anonymous caller cannot pick a scope around it", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const { GET } = await import("./route");
    for (const scope of ["overall", "role", "office"]) {
      const res = await GET(req(`http://localhost/api/arena/leaderboard?scope=${scope}`));
      expect(res.status, scope).toBe(401);
    }
  });

  it("case 2 — an authenticated caller still receives the full leaderboard, unchanged", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "22222222-2222-2222-2222-222222222222" } } });
    const { GET } = await import("./route");
    const res = await GET(req());

    expect(res.status).toBe(200);
    const body = await res.json();
    // Cases 3/4/5 — ordering, XP and identity semantics are untouched by this slice.
    expect(body.leaderboard).toHaveLength(1);
    expect(body.leaderboard[0].rank).toBe(1);
    expect(body.leaderboard[0].xpTotal).toBe(10);
    expect(body.leaderboard[0].displayName).toBe("A Real Person");
    expect(body.count).toBe(1);
    // The anonymity marker is gone: a 200 is now always a real viewer.
    expect(body.viewerAnonymous).toBeUndefined();
  });

  it("case 6 — no write occurs on either path", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const { GET } = await import("./route");
    await GET(req());
    mockGetUser.mockResolvedValue({ data: { user: { id: "22222222-2222-2222-2222-222222222222" } } });
    await GET(req());
    // The only admin handle the route holds is never used to write.
    expect(adminStub.from).not.toHaveBeenCalled();
  });
});
