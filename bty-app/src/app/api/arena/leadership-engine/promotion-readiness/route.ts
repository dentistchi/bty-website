import { NextRequest, NextResponse } from "next/server";
import { requireUser, unauthenticated, copyCookiesAndDebug } from "@/lib/supabase/route-client";
import { getPromotionReadiness } from "@/engine/integrity/promotion-readiness.service";

export const runtime = "nodejs";

/**
 * GET /api/arena/leadership-engine/promotion-readiness — LRI-based readiness snapshot (Elite Spec gate).
 */
export async function GET(req: NextRequest) {
  const { user, base } = await requireUser(req);
  if (!user) return unauthenticated(req, base);

  const pr = await getPromotionReadiness(user.id);
  const res = NextResponse.json({
    readiness_score: pr.readiness_score,
    promotion_blocked: pr.promotion_blocked,
    block_reasons: pr.block_reasons,
  });
  copyCookiesAndDebug(base, res, req, true);
  return res;
}
