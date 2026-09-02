import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { requireUser, unauthenticated, copyCookiesAndDebug } from "@/lib/supabase/route-client";
import { listMyAnnouncements } from "@/lib/bty/announcement/announcementService.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/bty/announcements/mine — what needs THIS person's response. Slice A1.
 *
 * Ownership is the session. The projection is built by a whitelisting select that never reads the
 * captured message body or any internal Microsoft identifier, so a private-channel source cannot
 * leak to someone who merely happens to be in the audience.
 */
/*
  ★ TEAMS TRACKING IS A WORKPLACE MESSAGE WORKFLOW, NOT ARENA LEARNER PRACTICE (2026-09-02).

  This route gated on `requireConsentedUser`, and the same boundary error already locked a Host out
  of his own tracking: MEASURED, hc's session was valid and ZERO reads reached the tables, because
  `isConsentCurrent` found no `arena_profiles` row and the request was refused `403
  consent_required` before any query ran. Only 2 of 13 Microsoft-linked accounts carry a consent
  version -- a Teams-first person never passes through the Arena flow at all.

  A recipient here was picked out of a Teams message by their manager and asked one question. Making
  them accept the Arena learner document before they can answer it is not a safeguard; it is a
  different product's gate on this product's path. Arena practice, training, observation and
  learning data keep their consent requirement untouched -- this is the only boundary that moves.

  What remains is the part that was always load-bearing: the row must be BOUND to the caller's own
  canonical user id. That is unchanged, and it is what makes an unbound row invisible to everyone.
*/
export async function GET(req: NextRequest) {
  const { user, base } = await requireUser(req);
  if (!user) return unauthenticated(req, base);

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ ok: false, items: [] }, { status: 503 });

  const items = await listMyAnnouncements(admin, user.id);
  const res = NextResponse.json({ ok: true, items }, { status: 200 });
  res.headers.set("Cache-Control", "private, no-store");
  copyCookiesAndDebug(base, res, req, true);
  return res;
}
