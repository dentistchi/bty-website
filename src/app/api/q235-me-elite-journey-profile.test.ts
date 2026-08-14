/**
 * SPRINT 235 C6: GET me/elite + GET journey/profile — 401·200 batch.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetSupabaseServerClient = vi.fn();
const mockGetIsEliteTop5 = vi.fn();
const mockGetEliteBadgeGrants = vi.fn();
const mockGetAuthUserFromRequest = vi.fn();
const mockGetSupabaseAdmin = vi.fn();

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

vi.mock("@/lib/bty/arena/supabaseServer", () => ({
  getSupabaseServerClient: (...args: unknown[]) =>
    mockGetSupabaseServerClient(...args),
}));
vi.mock("@/lib/bty/arena/eliteStatus", () => ({
  getIsEliteTop5: (...args: unknown[]) => mockGetIsEliteTop5(...args),
}));
vi.mock("@/lib/bty/arena/eliteBadge", () => ({
  getEliteBadgeGrants: (...args: unknown[]) => mockGetEliteBadgeGrants(...args),
}));

vi.mock("@/lib/auth-server", () => ({
  getAuthUserFromRequest: (...args: unknown[]) =>
    mockGetAuthUserFromRequest(...args),
}));
vi.mock("@/lib/supabase-admin", () => ({
  getSupabaseAdmin: (...args: unknown[]) => mockGetSupabaseAdmin(...args),
}));

const { GET: getElite } = await import("./me/elite/route");

describe("Q235 me/elite GET", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: { getUser: () => Promise.resolve({ data: { user: null } }) },
    });
    mockGetAuthUserFromRequest.mockResolvedValue(null);
    mockGetSupabaseAdmin.mockReturnValue(null);
  });

  it("401 elite unauthenticated", async () => {
    const e = await getElite();
    expect(e.status).toBe(401);
    expect((await e.json()).error).toBe("UNAUTHENTICATED");
  });

  it("200 elite when no row", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: () =>
          Promise.resolve({ data: { user: { id: "u1" } } }),
      },
    });
    mockGetIsEliteTop5.mockResolvedValue(false);
    mockGetEliteBadgeGrants.mockReturnValue([]);

    const e = await getElite();
    expect(e.status).toBe(200);
    const je = await e.json();
    expect(je.isElite).toBe(false);
    expect(Array.isArray(je.badges)).toBe(true);
  });
});
