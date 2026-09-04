import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * POST .../recipients/[recipientId]/notify — the trigger for one real Teams delivery.
 *
 * ★ WHY A ROUTE EXISTS AT ALL. The first controlled delivery targets an announcement that already
 * exists. Triggering it from a fresh Track would mean manufacturing production data to test with,
 * and a delivery that failed has to be retryable without tracking the message again.
 *
 * ★ WHAT THE CALLER CANNOT INFLUENCE. Everything. There is no message, no address, no routing URL
 * and no owner in the request — the text is built from stored Host framing and the coordinate
 * comes from the announcement's own `service_url`. Ownership is decided inside
 * `bty_begin_recipient_notification`, not here.
 */

const requireUser = vi.fn();
const unauthenticated = vi.fn(() => new Response(JSON.stringify({ error: "UNAUTHENTICATED" }), { status: 401 }));
const canTrackWithBty = vi.fn();
const notifyRecipient = vi.fn();

vi.mock("@/lib/supabase/route-client", () => ({
  requireUser: (req: unknown) => requireUser(req),
  unauthenticated: () => unauthenticated(),
  copyCookiesAndDebug: () => {},
}));
vi.mock("@/lib/supabase-admin", () => ({ getSupabaseAdmin: () => ({ __admin: true }) }));
vi.mock("@/lib/bty/authority/platformAdmin.server", () => ({
  canTrackWithBty: (a: unknown, i: unknown) => canTrackWithBty(a, i),
}));
vi.mock("@/lib/bty/announcement/notifyRecipient.server", () => ({
  notifyRecipient: (a: unknown, p: unknown) => notifyRecipient(a, p),
}));

const HOST = "81f08aa1-0000-0000-0000-000000000001";
const RECIP = "aaaaaaaa-0000-0000-0000-000000000002";

async function POST(body: unknown = {}, recipientId = RECIP) {
  const mod = await import("@/app/api/bty/announcements/recipients/[recipientId]/notify/route");
  const req = new NextRequest("https://arena.btydaily.com/api/bty/announcements/recipients/x/notify", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return mod.POST(req, { params: Promise.resolve({ recipientId }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  requireUser.mockResolvedValue({ user: { id: HOST }, base: new Response() });
  canTrackWithBty.mockResolvedValue(true);
  notifyRecipient.mockResolvedValue({ ok: true, conversationId: "19:c", reused: false });
});

describe("the two gates", () => {
  it("an anonymous caller is refused before anything is attempted", async () => {
    requireUser.mockResolvedValue({ user: null, base: new Response() });
    expect((await POST()).status).toBe(401);
    expect(notifyRecipient).not.toHaveBeenCalled();
  });

  /*
    ★ REVERSED (2026-09-04). Track is a participant capability now, so a Host grant can no longer
    be the price of acting on a run you created. Ownership — verified inside the SECURITY DEFINER
    function, which answers a non-owner exactly like a missing row — is what protects these rows,
    and it is unchanged.
  */
  it("a signed-in participant may notify a recipient of the run THEY own", async () => {
    const res = await POST();
    expect(res.status).toBe(200);
    expect(canTrackWithBty).not.toHaveBeenCalled();
  });

  it("the actor is the SESSION user — never anything in the body", async () => {
    await POST({ ownerUserId: "someone-else", recipientId: "another-row", serviceUrl: "https://evil.example.com/" });
    expect(notifyRecipient).toHaveBeenCalledWith({ __admin: true }, { recipientId: RECIP, ownerUserId: HOST });
  });

  it("ignores the body entirely, even when it is not JSON at all", async () => {
    const mod = await import("@/app/api/bty/announcements/recipients/[recipientId]/notify/route");
    const req = new NextRequest("https://arena.btydaily.com/x", { method: "POST", body: "not json" });
    const res = await mod.POST(req, { params: Promise.resolve({ recipientId: RECIP }) });
    expect(res.status).toBe(200);
  });
});

describe("outcomes a human has to tell apart", () => {
  it("a fresh delivery is 200", async () => {
    const res = await POST();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, reused: false });
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("a second attempt is 409 already_notified — visibly NOT a fresh send", async () => {
    // At-most-once has to be observable from outside, or it cannot be verified in production.
    notifyRecipient.mockResolvedValue({ ok: false, reason: "already_notified" });
    const res = await POST();
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ ok: false, code: "already_notified" });
  });

  it("maps each refusal to the status that tells the operator what to do", async () => {
    for (const [reason, status] of [
      ["not_found", 404],
      ["no_service_url", 409],
      ["credential_missing", 503],
      ["not_installed", 409],
      ["throttled", 429],
      ["unreachable", 502],
      ["confirm_failed", 502],
    ] as const) {
      notifyRecipient.mockResolvedValue({ ok: false, reason });
      const res = await POST();
      expect(res.status, reason).toBe(status);
      expect(await res.json()).toEqual({ ok: false, code: reason });
    }
  });

  it("a missing credential is 503 — the service is not configured, the request was fine", async () => {
    notifyRecipient.mockResolvedValue({ ok: false, reason: "credential_missing" });
    expect((await POST()).status).toBe(503);
  });
});
