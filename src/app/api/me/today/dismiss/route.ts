import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { requireUser, unauthenticated, copyCookiesAndDebug } from "@/lib/supabase/route-client";
import { dismissTodayItem } from "@/lib/bty/daily/todayDismissal.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/me/today/dismiss — "remove this card from MY Today".
 *
 * ★ THE ONLY IDENTITY IS THE SESSION. The body carries a card kind and a card id and NOTHING else;
 * there is no user id, email or Entra id to supply, and none would be read. Because the dismissal
 * table's primary key leads with `user_id`, one person tidying their Today has no address at which
 * to change what anybody else sees.
 *
 * ★ IT HIDES, IT DOES NOT DELETE. The service names exactly one table, and it is not the one the
 * card came from. No announcement, recipient row, thread message, read receipt, handled state,
 * capture, XP row or training record is reachable from this endpoint.
 *
 * ★ OWNERSHIP IS VERIFIED BEFORE ANYTHING IS WRITTEN. The service confirms the named card is on
 * THIS person's Today — a recipient row bound to them, or an announcement they own — and refuses
 * anything else. A card belonging to somebody else and a card that does not exist are refused
 * IDENTICALLY, so this cannot be used to discover that a Track exists.
 */
export async function POST(req: NextRequest) {
  const { user, base } = await requireUser(req);
  if (!user) return unauthenticated(req, base);

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ ok: false }, { status: 503 });

  const body = (await req.json().catch(() => ({}))) as { itemKind?: unknown; itemId?: unknown };
  const result = await dismissTodayItem(admin, {
    userId: user.id,
    itemKind: body?.itemKind,
    itemId: body?.itemId,
  });

  if (!result.ok) {
    const res = NextResponse.json(
      { ok: false, code: result.reason },
      { status: result.reason === "invalid_kind" ? 400 : result.reason === "not_found" ? 404 : 500 },
    );
    res.headers.set("Cache-Control", "private, no-store");
    return res;
  }

  const res = NextResponse.json(
    { ok: true, dismissedAt: result.dismissedAt, activityVersion: result.activityVersion },
    { status: 200 },
  );
  res.headers.set("Cache-Control", "private, no-store");
  copyCookiesAndDebug(base, res, req, true);
  return res;
}
