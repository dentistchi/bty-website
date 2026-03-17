/**
 * GET /api/bty/healing
 * Q4 Healing API — phase·콘텐츠 연동. 도메인 상수만 노출; 사용자별 phase는 추후 서비스 연동.
 *
 * Response (200): { ok: true, phase, content: { ringType } }.
 * Error responses:
 * - 401: { error: "UNAUTHENTICATED" } (route-client)
 * - 500: { error: "INTERNAL_ERROR", detail?: string } (btyErrorResponse)
 */
import { NextRequest, NextResponse } from "next/server";
import { requireUser, unauthenticated, copyCookiesAndDebug } from "@/lib/supabase/route-client";
import {
  HEALING_PHASE_II_LABEL,
  HEALING_PHASE_RING_TYPE,
  type HealingPhaseLabel,
} from "@/domain/healing";
import { btyErrorResponse } from "../errors";

export async function GET(req: NextRequest) {
  const { user, base } = await requireUser(req);
  if (!user) return unauthenticated(req, base);

  try {
    const phase: HealingPhaseLabel = HEALING_PHASE_II_LABEL;
    const res = NextResponse.json({
      ok: true,
      phase,
      content: {
        ringType: HEALING_PHASE_RING_TYPE,
      },
    });
    copyCookiesAndDebug(base, res, req, true);
    return res;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return btyErrorResponse(500, "INTERNAL_ERROR", message);
  }
}
