import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ACTIVE_CONSENT_VERSION } from "@/domain/legal/consent-document";

/**
 * SLICE 3.2R-R9B.1 — REPRESENTATIVE LEARNER ROUTES, THROUGH THE REAL GUARD.
 *
 * The helper's own suite proves the verdict. This proves the WIRING: that real routes across
 * different product domains refuse an unconsented learner, and — the part that actually matters —
 * that they refuse BEFORE reading protected data or performing a mutation. A 403 returned after the
 * query has already run would still have leaked the read.
 *
 * `requireUser` is deliberately NOT mocked here; the real `requireConsentedUser` runs against a
 * stubbed Supabase so the consent read is the genuine one.
 */

const mockGetUser = vi.fn();
const mockMaybeSingle = vi.fn();
const listMyFieldActions = vi.fn();
const markAllNotificationsRead = vi.fn();

vi.mock("next/headers", () => ({ cookies: async () => ({ getAll: () => [] }) }));
vi.mock("@/lib/bty/cookies/authCookies", () => ({
  authCookieSecureForRequest: () => true,
  setAuthCookie: vi.fn(),
}));
vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: { getUser: () => mockGetUser() },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => mockMaybeSingle() }) }) }),
  }),
}));

/** The protected work each route would do — must stay untouched on refusal. */
vi.mock("@/lib/bty/action-contract/myFieldActions.server", () => ({
  listMyFieldActions: (...a: unknown[]) => listMyFieldActions(...a),
}));
vi.mock("@/lib/supabase-admin", () => ({ getSupabaseAdmin: () => ({ from: vi.fn() }) }));
vi.mock("@/engine/integration/notification-router.service", () => ({
  markAllNotificationsRead: (...a: unknown[]) => markAllNotificationsRead(...a),
}));
vi.mock("@/lib/bty/arena/supabaseServer", () => ({
  getSupabaseServerClient: async () => ({ from: vi.fn() }),
}));

const USER = { id: "11111111-1111-1111-1111-111111111111" };

beforeEach(() => {
  vi.clearAllMocks();
  mockGetUser.mockResolvedValue({ data: { user: USER }, error: null });
  listMyFieldActions.mockResolvedValue([]);
  markAllNotificationsRead.mockResolvedValue(undefined);
});

const consented = () =>
  mockMaybeSingle.mockResolvedValue({ data: { consent_version: ACTIVE_CONSENT_VERSION }, error: null });
const withVersion = (v: string | null) =>
  mockMaybeSingle.mockResolvedValue({ data: { consent_version: v }, error: null });

describe("[3.2R-R9B.1] case 9 — a learner GET refuses before the protected read", () => {
  const get = async () => {
    const { GET } = await import("./bty/action-contract/mine/route");
    return GET(new NextRequest("http://localhost/api/bty/action-contract/mine"));
  };

  it("current consent → the route runs normally", async () => {
    consented();
    const res = await get();
    expect(res.status).toBe(200);
    expect(listMyFieldActions).toHaveBeenCalledTimes(1);
  });

  for (const [label, version] of [
    ["null", null],
    ["old", "2026-05-pending-v1"],
    ["invented", "2099-12-anything"],
  ] as const) {
    it(`${label} consent → 403 consent_required, and the contracts are NEVER read`, async () => {
      withVersion(version);
      const res = await get();
      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({ error: "consent_required" });
      expect(listMyFieldActions).not.toHaveBeenCalled();
    });
  }

  it("no session → still the existing 401, not a consent refusal", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    const res = await get();
    expect(res.status).toBe(401);
    expect(listMyFieldActions).not.toHaveBeenCalled();
  });
});

describe("[3.2R-R9B.1] case 10 — a learner POST refuses before the mutation", () => {
  const post = async () => {
    const { POST } = await import("./bty/notifications/read-all/route");
    return POST(new NextRequest("http://localhost/api/bty/notifications/read-all", { method: "POST" }));
  };

  it("current consent → the mutation runs", async () => {
    consented();
    const res = await post();
    expect(res.status).toBe(200);
    expect(markAllNotificationsRead).toHaveBeenCalledTimes(1);
  });

  it("old consent → 403 and NOTHING is written", async () => {
    withVersion("2026-05-pending-v1");
    const res = await post();
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "consent_required" });
    expect(markAllNotificationsRead).not.toHaveBeenCalled();
  });

  it("a profile read failure fails closed — and still writes nothing", async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: { message: "boom" } });
    expect((await post()).status).toBe(403);
    expect(markAllNotificationsRead).not.toHaveBeenCalled();
  });
});
