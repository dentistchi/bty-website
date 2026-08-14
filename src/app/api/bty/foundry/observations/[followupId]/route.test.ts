/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Slice 3.2M-5 — the observer's door.
 *
 * 3.2M-4 had the capability and no route, so nobody could report anything. These tests hold the
 * two properties that make the door safe: identity is server-derived and never taken from the
 * caller, and a refusal is indistinguishable from a missing request so the existence of an
 * observation request cannot be probed by someone with no authority.
 */
const getSupabaseAdmin = vi.fn();
const getSupabaseServerClient = vi.fn();
const getObservationRequest = vi.fn();
const submitObservation = vi.fn();

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
vi.mock("@/lib/bty/arena/supabaseServer", () => ({
  getSupabaseServerClient: () => getSupabaseServerClient(),
}));
vi.mock("@/lib/bty/foundry/events/foundryObservationService", () => ({
  getObservationRequest: (...a: unknown[]) => getObservationRequest(...a),
  submitObservation: (...a: unknown[]) => submitObservation(...a),
}));

let GET: typeof import("./route").GET;
let POST: typeof import("./submit/route").POST;
beforeEach(async () => {
  vi.clearAllMocks();
  ({ GET } = await import("./route"));
  ({ POST } = await import("./submit/route"));
});

const FOLLOWUP = "fu-1";
const BASE = `https://staging.example.workers.dev/api/bty/foundry/observations/${FOLLOWUP}`;
const ctx = { params: Promise.resolve({ followupId: FOLLOWUP }) };

function readReq() {
  return new NextRequest(BASE);
}
function writeReq(body: unknown) {
  return new NextRequest(`${BASE}/submit`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
function authed(userId: string | null) {
  getSupabaseServerClient.mockResolvedValue({
    auth: { getUser: () => Promise.resolve({ data: { user: userId ? { id: userId } : null } }) },
  });
}

const REQUEST = {
  followupId: FOLLOWUP,
  learnerDisplayName: "Hanbit",
  observableStandard: "The outgoing person states each open item aloud.",
  maxObservedOn: "2026-08-20",
  myObservations: [],
};

describe("GET /api/bty/foundry/observations/[followupId]", () => {
  it("503 when the service-role client is unavailable", async () => {
    getSupabaseAdmin.mockReturnValue(null);
    expect((await GET(readReq(), ctx)).status).toBe(503);
    expect(getSupabaseServerClient).not.toHaveBeenCalled();
  });

  it("401 for an anonymous caller — the service is never reached", async () => {
    getSupabaseAdmin.mockReturnValue({});
    authed(null);
    expect((await GET(readReq(), ctx)).status).toBe(401);
    expect(getObservationRequest).not.toHaveBeenCalled();
  });

  it("the observer identity comes from the session, never from the request", async () => {
    getSupabaseAdmin.mockReturnValue({});
    authed("observer-1");
    getObservationRequest.mockResolvedValue({ ok: true, value: REQUEST });
    await GET(readReq(), ctx);
    expect(getObservationRequest).toHaveBeenCalledWith(expect.anything(), "observer-1", FOLLOWUP);
  });

  it("200 returns the thin request", async () => {
    getSupabaseAdmin.mockReturnValue({});
    authed("observer-1");
    getObservationRequest.mockResolvedValue({ ok: true, value: REQUEST });
    const res = await GET(readReq(), ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, request: REQUEST });
  });

  it("an unauthorised caller gets EXACTLY what a missing request gives — no probing", async () => {
    getSupabaseAdmin.mockReturnValue({});
    authed("stranger");
    getObservationRequest.mockResolvedValue({ ok: false, reason: "not_authorized" });
    const refused = await GET(readReq(), ctx);
    getObservationRequest.mockResolvedValue({ ok: false, reason: "not_found" });
    const missing = await GET(readReq(), ctx);
    expect(refused.status).toBe(404);
    expect(await refused.json()).toEqual(await missing.json());
  });

  it("never shared-cacheable — this is one person's private view", async () => {
    getSupabaseAdmin.mockReturnValue({});
    authed("observer-1");
    getObservationRequest.mockResolvedValue({ ok: true, value: REQUEST });
    expect((await GET(readReq(), ctx)).headers.get("Cache-Control")).toContain("private");
  });
});

describe("POST /api/bty/foundry/observations/[followupId]/submit", () => {
  it("401 for an anonymous caller — nothing is written", async () => {
    getSupabaseAdmin.mockReturnValue({});
    authed(null);
    expect((await POST(writeReq({ outcome: "OBSERVED", observedOn: "2026-08-20" }), ctx)).status).toBe(401);
    expect(submitObservation).not.toHaveBeenCalled();
  });

  it("passes the occurrence date through and stamps nothing itself", async () => {
    getSupabaseAdmin.mockReturnValue({});
    authed("observer-1");
    submitObservation.mockResolvedValue({ ok: true, outcome: "OBSERVED", observedOn: "2026-08-14", created: true });
    const res = await POST(writeReq({ outcome: "OBSERVED", observedOn: "2026-08-14" }), ctx);
    expect(submitObservation).toHaveBeenCalledWith(expect.anything(), "observer-1", FOLLOWUP, "OBSERVED", "2026-08-14");
    expect(await res.json()).toEqual({ ok: true, outcome: "OBSERVED", observedOn: "2026-08-14", created: true });
  });

  it("a double tap is a 200 with created:false — not an error to shout about", async () => {
    getSupabaseAdmin.mockReturnValue({});
    authed("observer-1");
    submitObservation.mockResolvedValue({ ok: true, outcome: "OBSERVED", observedOn: "2026-08-14", created: false });
    const res = await POST(writeReq({ outcome: "OBSERVED", observedOn: "2026-08-14" }), ctx);
    expect(res.status).toBe(200);
    expect((await res.json()).created).toBe(false);
  });

  it("maps each refusal to an honest status", async () => {
    getSupabaseAdmin.mockReturnValue({});
    authed("observer-1");
    for (const [reason, status] of [
      ["invalid_outcome", 400],
      ["invalid_date", 400],
      ["future_date", 400],
      ["no_observable_standard", 409],
      ["not_found", 404],
      ["error", 500],
    ] as const) {
      submitObservation.mockResolvedValue({ ok: false, reason });
      expect((await POST(writeReq({}), ctx)).status, reason).toBe(status);
    }
  });

  it("an unauthorised write is answered as not_found — the same non-disclosure as the read", async () => {
    getSupabaseAdmin.mockReturnValue({});
    authed("stranger");
    submitObservation.mockResolvedValue({ ok: false, reason: "not_authorized" });
    const res = await POST(writeReq({ outcome: "OBSERVED", observedOn: "2026-08-20" }), ctx);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ ok: false, error: "not_found" });
  });

  it("a malformed body reaches the service as undefined and is refused there, not guessed at", async () => {
    getSupabaseAdmin.mockReturnValue({});
    authed("observer-1");
    submitObservation.mockResolvedValue({ ok: false, reason: "invalid_outcome" });
    const res = await POST(
      new NextRequest(`${BASE}/submit`, { method: "POST", body: "not json" }),
      ctx,
    );
    expect(res.status).toBe(400);
    expect(submitObservation).toHaveBeenCalledWith(expect.anything(), "observer-1", FOLLOWUP, undefined, undefined);
  });
});
