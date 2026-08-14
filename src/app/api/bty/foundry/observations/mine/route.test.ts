/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * SLICE 3.2N — the reviewer's own list.
 *
 * The property that matters most here is the empty case: someone with no reviewer edges must get
 * a successful empty list, not a refusal. "You have no review work" and "you are not allowed" are
 * different sentences, and answering with the second would both mislead an ordinary user and let
 * anyone probe the shape of the authority graph.
 */
const getSupabaseAdmin = vi.fn();
const getSupabaseServerClient = vi.fn();
const listMyObservationOpportunities = vi.fn();

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

vi.mock("@/lib/supabase-admin", () => ({ getSupabaseAdmin: () => getSupabaseAdmin() }));
vi.mock("@/lib/bty/arena/supabaseServer", () => ({ getSupabaseServerClient: () => getSupabaseServerClient() }));
vi.mock("@/lib/bty/foundry/events/observationOpportunityService", () => ({
  listMyObservationOpportunities: (...a: unknown[]) => listMyObservationOpportunities(...a),
}));

let GET: typeof import("./route").GET;
beforeEach(async () => {
  vi.clearAllMocks();
  ({ GET } = await import("./route"));
});

const req = () => new NextRequest("https://staging.example.workers.dev/api/bty/foundry/observations/mine");
function authed(userId: string | null) {
  getSupabaseServerClient.mockResolvedValue({
    auth: { getUser: () => Promise.resolve({ data: { user: userId ? { id: userId } : null } }) },
  });
}

const ITEM = {
  followupId: "fu-1", learnerLabel: "Yoon", behavior: "State each open item aloud.",
  state: "none", firstObservedOn: null, lastObservedOn: null, positiveDates: 0,
};

describe("GET /api/bty/foundry/observations/mine", () => {
  it("503 when the service-role client is unavailable", async () => {
    getSupabaseAdmin.mockReturnValue(null);
    expect((await GET(req())).status).toBe(503);
    expect(getSupabaseServerClient).not.toHaveBeenCalled();
  });

  it("401 for an anonymous caller — the service is never reached", async () => {
    getSupabaseAdmin.mockReturnValue({});
    authed(null);
    expect((await GET(req())).status).toBe(401);
    expect(listMyObservationOpportunities).not.toHaveBeenCalled();
  });

  it("the reviewer identity comes from the session, never the request", async () => {
    getSupabaseAdmin.mockReturnValue({});
    authed("observer-1");
    listMyObservationOpportunities.mockResolvedValue([ITEM]);
    await GET(req());
    expect(listMyObservationOpportunities).toHaveBeenCalledWith(expect.anything(), "observer-1");
  });

  it("200 with the items for an eligible reviewer", async () => {
    getSupabaseAdmin.mockReturnValue({});
    authed("observer-1");
    listMyObservationOpportunities.mockResolvedValue([ITEM]);
    const res = await GET(req());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, items: [ITEM] });
  });

  it("a NON-REVIEWER gets 200 and an empty list — never 403", async () => {
    getSupabaseAdmin.mockReturnValue({});
    authed("nobody-in-particular");
    listMyObservationOpportunities.mockResolvedValue([]);
    const res = await GET(req());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, items: [] });
  });

  it("a read failure degrades to an honest empty list, not a 500 into the reviewer surface", async () => {
    getSupabaseAdmin.mockReturnValue({});
    authed("observer-1");
    listMyObservationOpportunities.mockRejectedValue(new Error("boom"));
    const res = await GET(req());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, items: [] });
  });

  it("never shared-cacheable — this is one person's work list", async () => {
    getSupabaseAdmin.mockReturnValue({});
    authed("observer-1");
    listMyObservationOpportunities.mockResolvedValue([]);
    expect((await GET(req())).headers.get("Cache-Control")).toContain("private");
  });
});
