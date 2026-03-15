/**
 * GET /api/arena/dashboard/summary
 * 대시보드용 진도·추천 요약. 도메인 타입·서비스 호출만; recommendation 실데이터 연동(기본값).
 */
import { NextRequest, NextResponse } from "next/server";
import { requireUser, unauthenticated, copyCookiesAndDebug } from "@/lib/supabase/route-client";
import {
  getLeadershipEngineState,
  ensureLeadershipEngineState,
} from "@/lib/bty/leadership-engine/state-service";
import { stageProgressPercent, type Stage } from "@/domain/leadership-engine/stages";
import type { RecommendationSummary } from "@/domain/dashboard";

export async function GET(req: NextRequest) {
  const { user, supabase, base } = await requireUser(req);
  if (!user) return unauthenticated(req, base);

  await ensureLeadershipEngineState(supabase, user.id);
  const state = await getLeadershipEngineState(supabase, user.id);

  const currentStage = state.currentStage as Stage;
  const progressPercent = stageProgressPercent(currentStage);

  const recommendation: RecommendationSummary = {
    nextAction: "Continue Arena",
    source: "arena",
    priority: 1,
  };

  const res = NextResponse.json({
    progress: {
      currentStage: state.currentStage,
      stageName: state.stageName,
      progressPercent,
      forcedResetTriggeredAt: state.forcedResetTriggeredAt,
      resetDueAt: state.resetDueAt,
    },
    recommendation,
  });
  copyCookiesAndDebug(base, res, req, true);
  return res;
}
