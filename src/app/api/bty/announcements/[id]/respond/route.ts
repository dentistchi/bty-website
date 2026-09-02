import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { requireUser, unauthenticated, copyCookiesAndDebug } from "@/lib/supabase/route-client";
import { respondToAnnouncement } from "@/lib/bty/announcement/announcementService.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/bty/announcements/[id]/respond — record one response. Slice A1.
 *
 * WRITE-ONCE, and ownership is the session: the RPC finds the row by (announcement, caller), so
 * there is no recipient id to guess and no user id this route would accept from a body.
 *
 * A non-recipient and an unknown announcement return the SAME 404, so membership of someone else's
 * audience cannot be probed.
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
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { user, base } = await requireUser(req);
  if (!user) return unauthenticated(req, base);

  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { response?: unknown; questionText?: unknown };

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ ok: false }, { status: 503 });

  const result = await respondToAnnouncement(admin, {
    announcementId: id,
    userId: user.id,
    response: body?.response,
    questionText: body?.questionText,
  });

  if (!result.ok) {
    const status = result.reason === "not_a_recipient" ? 404 : 400;
    const res = NextResponse.json({ ok: false, code: result.reason }, { status });
    res.headers.set("Cache-Control", "private, no-store");
    return res;
  }

  const res = NextResponse.json(
    { ok: true, response: result.response, alreadyResponded: result.alreadyResponded },
    { status: 200 },
  );
  res.headers.set("Cache-Control", "private, no-store");
  copyCookiesAndDebug(base, res, req, true);
  return res;
}
