import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { requireUser, unauthenticated, copyCookiesAndDebug } from "@/lib/supabase/route-client";
import { canTrackWithBty } from "@/lib/bty/authority/platformAdmin.server";
import { handleRecipientFollowUp } from "@/lib/bty/announcement/announcementService.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/bty/announcements/recipients/[recipientId]/handle — settle one person's follow-up.
 *
 * ★ TWO GATES, AND THE SECOND ONE IS THE REAL ONE.
 *
 * Track capability decides whether this endpoint exists for you at all — the same
 * `canTrackWithBty` (active Platform Admin OR active Foundry Host) the Track gates use, so a
 * participant is refused before any row is touched. But holding that capability says nothing about
 * WHOSE announcement this recipient belongs to, and the answer to that is never taken from the
 * request: `bty_handle_announcement_recipient` joins the recipient to its announcement and requires
 * the actor to be `owner_user_id`.
 *
 * A wrong owner is answered `not_found`, identically to a row that does not exist, so another
 * Host cannot use this to discover that someone else's run exists.
 *
 * The body carries ONE boolean. There is no user id, no announcement id and no owner to supply,
 * because all three are derived server-side — a crafted body has nothing to aim at.
 *
 * Arena learner consent is deliberately not consulted: this is a workplace message workflow, the
 * same boundary already corrected on the Host and recipient routes.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ recipientId: string }> }) {
  const { user, base } = await requireUser(req);
  if (!user) return unauthenticated(req, base);

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ ok: false }, { status: 503 });

  if (!(await canTrackWithBty(admin, user.id))) {
    const denied = NextResponse.json({ error: "track_capability_required" }, { status: 403 });
    copyCookiesAndDebug(base, denied, req, false);
    return denied;
  }

  const { recipientId } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { handled?: unknown };
  // Anything that is not an explicit `false` is a request to settle: the control that sends this
  // is a two-state toggle, and a malformed body must not silently re-open somebody's follow-up.
  const handled = body?.handled !== false;

  const result = await handleRecipientFollowUp(admin, {
    recipientId,
    actorUserId: user.id,
    handled,
  });

  if (!result.ok) {
    const status = result.reason === "not_found" ? 404 : result.reason === "not_handleable" ? 409 : 500;
    const res = NextResponse.json({ ok: false, code: result.reason }, { status });
    res.headers.set("Cache-Control", "private, no-store");
    return res;
  }

  const res = NextResponse.json({ ok: true, handled: result.handled }, { status: 200 });
  res.headers.set("Cache-Control", "private, no-store");
  copyCookiesAndDebug(base, res, req, true);
  return res;
}
