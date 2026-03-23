/**
 * GET /api/bty/center/integrity-scorecard?userId=
 * Session user only; returns {@link getIntegrityScoreCard} (persists latest row).
 */
import { NextRequest, NextResponse } from "next/server";
import { getIntegrityScoreCard } from "@/engine/integration/integrity-score-card.service";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { copyCookiesAndDebug, requireUser, unauthenticated } from "@/lib/supabase/route-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { user, base } = await requireUser(req);
  if (!user) return unauthenticated(req, base);

  let userId = req.nextUrl.searchParams.get("userId")?.trim() ?? "";
  if (!userId) userId = user.id;
  if (userId !== user.id) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    const res = NextResponse.json({ error: "ADMIN_UNAVAILABLE" }, { status: 503 });
    copyCookiesAndDebug(base, res, req, true);
    return res;
  }

  try {
    const integrityScoreCard = await getIntegrityScoreCard(userId, { supabase: admin });
    const res = NextResponse.json({ integrityScoreCard });
    copyCookiesAndDebug(base, res, req, true);
    return res;
  } catch (e) {
    console.error("[bty/center/integrity-scorecard]", e);
    const res = NextResponse.json(
      { error: e instanceof Error ? e.message : "INTERNAL_ERROR" },
      { status: 500 },
    );
    copyCookiesAndDebug(base, res, req, true);
    return res;
  }
}
