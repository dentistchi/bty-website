import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { requireUser, unauthenticated, copyCookiesAndDebug } from "@/lib/supabase/route-client";
import { notifyRecipient } from "@/lib/bty/announcement/notifyRecipient.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/bty/announcements/recipients/[recipientId]/notify — tell ONE person, in Teams.
 *
 * The same boundary as the sibling `handle` route, for the same reason: ownership, verified inside
 * `bty_begin_recipient_notification` by joining the recipient to its announcement owner. A
 * non-owner is answered `not_found`, identically to a missing row, so nobody can use this to
 * discover that someone else's run exists.
 *
 * THE BODY IS IGNORED ENTIRELY. There is no message to supply, no recipient address, no routing
 * URL and no owner: the text is built from the Host's stored framing, and the coordinate comes
 * from the announcement's own `service_url`. A crafted body has nothing to aim at, and in
 * particular there is no way to ask this endpoint to send somewhere it was not already going.
 *
 * WHY A ROUTE AND NOT ONLY THE TRACK HOOK: the first controlled delivery targets an announcement
 * that ALREADY EXISTS, and creating a new Track to trigger it would manufacture production data
 * to test with. Retrying a delivery that failed also belongs here — an announcement is tracked
 * once, but telling someone can need a second attempt.
 *
 * `409 already_notified` is a success from the user's point of view and is deliberately not 200:
 * a retry must be visibly distinguishable from a fresh send, or at-most-once cannot be observed
 * from outside.
 */
const STATUS: Record<string, number> = {
  not_found: 404,
  already_notified: 409,
  // Someone else holds the delivery lease right now. Not an error, and explicitly not a retry
  // instruction: retrying immediately is the behaviour the lease exists to prevent.
  in_progress: 409,
  // A send began and its outcome was never learned. A person must look before anyone sends again.
  delivery_unknown: 409,
  // This attempt's lease was taken or already spent while it worked.
  claim_lost: 409,
  // Another announcement to the SAME person is creating their Teams thread right now. Retryable
  // the moment it exists — and named separately from `in_progress` so an operator is not sent
  // looking at this recipient row, which is not the thing that is busy.
  conversation_in_progress: 409,
  // A conversation creation began and its outcome was never learned. A person must look before
  // anything creates another thread for them.
  conversation_creation_unknown: 409,
  no_service_url: 409,
  credential_missing: 503,
  // The bot registration's tenant is not configured. Same family: the service is not set up,
  // the request was fine.
  tenant_not_configured: 503,
  not_installed: 409,
  throttled: 429,
};

export async function POST(req: NextRequest, ctx: { params: Promise<{ recipientId: string }> }) {
  const { user, base } = await requireUser(req);
  if (!user) return unauthenticated(req, base);

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ ok: false }, { status: 503 });

  /*
    OWNERSHIP IS THE BOUNDARY HERE, NOT A CAPABILITY (2026-09-04).

    Track is a participant capability now, so a Host grant can no longer be the price of telling
    someone about a run you created. `bty_begin_recipient_notification` already joins the recipient
    to its announcement owner and answers a non-owner exactly like a missing row, so a person who
    owns nothing can reach nobody through this route — and could not before either. What the
    capability check actually decided was whether the endpoint existed for you at all, which is not
    a boundary this endpoint needs.
  */

  const { recipientId } = await ctx.params;
  const result = await notifyRecipient(admin, { recipientId, ownerUserId: user.id });

  if (!result.ok) {
    const res = NextResponse.json({ ok: false, code: result.reason }, { status: STATUS[result.reason] ?? 502 });
    res.headers.set("Cache-Control", "private, no-store");
    return res;
  }

  const res = NextResponse.json({ ok: true, reused: result.reused }, { status: 200 });
  res.headers.set("Cache-Control", "private, no-store");
  copyCookiesAndDebug(base, res, req, true);
  return res;
}
