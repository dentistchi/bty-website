/**
 * SPRINT 235 C6: GET me/elite + GET journey/profile — 401·200 batch.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetSupabaseServerClient = vi.fn();
const mockGetIsEliteTop5 = vi.fn();
const mockGetEliteBadgeGrants = vi.fn();
const mockGetAuthUserFromRequest = vi.fn();
const mockGetSupabaseAdmin = vi.fn();

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
const { GET: getJourneyProfile } = await import("./journey/profile/route");

describe("Q235 me/elite · journey/profile GET", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: { getUser: () => Promise.resolve({ data: { user: null } }) },
    });
    mockGetAuthUserFromRequest.mockResolvedValue(null);
    mockGetSupabaseAdmin.mockReturnValue(null);
  });

  it("401 elite unauthenticated; 401 journey profile unauthenticated", async () => {
    const e = await getElite();
    expect(e.status).toBe(401);
    expect((await e.json()).error).toBe("UNAUTHENTICATED");

    const j = await getJourneyProfile(
      new Request("http://localhost/api/journey/profile", { method: "GET" }),
    );
    expect(j.status).toBe(401);
    expect((await j.json()).error).toBe("Unauthorized");
  });

  it("200 elite; 200 journey profile default when no row", async () => {
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

    mockGetAuthUserFromRequest.mockResolvedValue({ id: "u1" });
    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { code: "PGRST116" },
          }),
        }),
      }),
    });
    mockGetSupabaseAdmin.mockReturnValue({ from: mockFrom });

    const j = await getJourneyProfile(
      new Request("http://localhost/api/journey/profile", { method: "GET" }),
    );
    expect(j.status).toBe(200);
    const jj = await j.json();
    expect(jj.current_day).toBe(1);
    expect(jj.is_new).toBe(true);
    expect(jj.bounce_back_count).toBe(0);
  });
});
