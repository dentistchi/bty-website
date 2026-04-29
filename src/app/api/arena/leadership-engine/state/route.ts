import { NextRequest, NextResponse } from "next/server";
import { requireUser, unauthenticated, copyCookiesAndDebug } from "@/lib/supabase/route-client";
import {
  getLeadershipEngineState,
  ensureLeadershipEngineState,
} from "@/lib/bty/leadership-engine/state-service";

/**
 * GET /api/arena/leadership-engine/state — **LE Stage** 노출 (런/결과 위젯용). 계산은 서비스·도메인; UI는 표시만.
 *
 * @contract
 * - **Auth:** 무세션 → 401 `{ error: "UNAUTHENTICATED" }` (`unauthenticated` + 쿠키 복사).
 * - **200:** `{ currentStage: string, stageName: string, forcedResetTriggeredAt: string | null, resetDueAt: string | null }`
 *   — `currentStage`는 LE 파이프라인 Stage 키; `stageName` 표시용 라벨.
 * - **500:** LE state 보장/조회 실패 시 Next 기본 또는 비일관 JSON(런타임 예외).
 *
 * @see docs/spec/ARENA_DOMAIN_SPEC.md §4-10
 */
export async function GET(req: NextRequest) {
  const { user, supabase, base } = await requireUser(req);
  if (!user) return unauthenticated(req, base);

  await ensureLeadershipEngineState(supabase, user.id);
  const state = await getLeadershipEngineState(supabase, user.id);

  const res = NextResponse.json({
    currentStage: state.currentStage,
    stageName: state.stageName,
    forcedResetTriggeredAt: state.forcedResetTriggeredAt,
    resetDueAt: state.resetDueAt,
  });
  copyCookiesAndDebug(base, res, req, true);
  return res;
}
