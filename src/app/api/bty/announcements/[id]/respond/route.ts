import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { requireConsentedUser, unauthenticated, copyCookiesAndDebug } from "@/lib/supabase/route-client";
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
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { user, base, consentDenied } = await requireConsentedUser(req);
  if (!user) return unauthenticated(req, base);
  if (consentDenied) return consentDenied;

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
