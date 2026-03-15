/**
 * GET /api/arena/leadership-engine/stage-summary
 * LE Stage + Arena 결과·행동 패턴 요약. 도메인/서비스 호출만; UI는 렌더만.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireUser, unauthenticated, copyCookiesAndDebug } from "@/lib/supabase/route-client";
import {
  getLeadershipEngineState,
  ensureLeadershipEngineState,
} from "@/lib/bty/leadership-engine/state-service";
import { stageProgressPercent, type Stage } from "@/domain/leadership-engine/stages";

export async function GET(req: NextRequest) {
  const { user, supabase, base } = await requireUser(req);
  if (!user) return unauthenticated(req, base);

  await ensureLeadershipEngineState(supabase, user.id);
  const state = await getLeadershipEngineState(supabase, user.id);

  const currentStage = state.currentStage as Stage;
  const progressPercent = stageProgressPercent(currentStage);

  const res = NextResponse.json({
    currentStage: state.currentStage,
    stageName: state.stageName,
    progressPercent,
    forcedResetTriggeredAt: state.forcedResetTriggeredAt,
    resetDueAt: state.resetDueAt,
    arenaSummary: null,
    behaviorPattern: null,
  });
  copyCookiesAndDebug(base, res, req, true);
  return res;
}
