/**
 * GET /api/bty/foundry/recommendations — Top-3 Foundry program cards (session user).
 */
import { NextRequest, NextResponse } from "next/server";
import { getRecommendationsForUi } from "@/engine/foundry/program-recommender.service";
import { requireUser, unauthenticated, copyCookiesAndDebug } from "@/lib/supabase/route-client";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { user, supabase, base } = await requireUser(req);
  if (!user) return unauthenticated(req, base);

  try {
    const recommendations = await getRecommendationsForUi(user.id, supabase);
    const res = NextResponse.json({ ok: true, recommendations });
    copyCookiesAndDebug(base, res, req, true);
    return res;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    const res = NextResponse.json({ ok: false, error: msg }, { status: 500 });
    copyCookiesAndDebug(base, res, req, true);
    return res;
  }
}
