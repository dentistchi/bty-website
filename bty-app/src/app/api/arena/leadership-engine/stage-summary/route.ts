/**
 * GET /api/arena/leadership-engine/stage-summary
 * LE Stage + Arena 결과·행동 패턴 요약. 도메인/서비스 호출만; UI는 렌더만.
 *
 * Response 200: StageSummaryResponse (currentStage, stageName, progressPercent, forcedResetTriggeredAt, resetDueAt, arenaSummary, behaviorPattern). See export type StageSummaryResponse.
 * Response 401: { error: "UNAUTHENTICATED" }. Response 500: LE state/RPC failure (Next error page or { message } per runtime).
 *
 * @see domain/leadership-engine/le-stage.ts LEStageSummary (단일 스키마 소스)
 */
import { NextRequest, NextResponse } from "next/server";
import { requireUser, unauthenticated, copyCookiesAndDebug } from "@/lib/supabase/route-client";
import {
  getLeadershipEngineState,
  ensureLeadershipEngineState,
} from "@/lib/bty/leadership-engine/state-service";
import { stageProgressPercent, type Stage } from "@/domain/leadership-engine/stages";
import type { ArenaResultSummary, BehaviorPatternSummary } from "@/domain/leadership-engine/le-stage";

/** GET stage-summary response shape. Domain types for arena/behavior; reset fields from state. */
export type StageSummaryResponse = {
  currentStage: Stage;
  stageName: string;
  progressPercent: number;
  forcedResetTriggeredAt: string | null;
  resetDueAt: string | null;
  arenaSummary: ArenaResultSummary | null;
  behaviorPattern: BehaviorPatternSummary | null;
};

function buildStageSummaryResponse(
  state: Awaited<ReturnType<typeof getLeadershipEngineState>>,
  arenaSummary: ArenaResultSummary | null,
  behaviorPattern: BehaviorPatternSummary | null
): StageSummaryResponse {
  const progressPercent = stageProgressPercent(state.currentStage);
  return {
    currentStage: state.currentStage,
    stageName: state.stageName,
    progressPercent,
    forcedResetTriggeredAt: state.forcedResetTriggeredAt,
    resetDueAt: state.resetDueAt,
    arenaSummary,
    behaviorPattern,
  };
}

export async function GET(req: NextRequest) {
  const { user, supabase, base } = await requireUser(req);
  if (!user) return unauthenticated(req, base);

  await ensureLeadershipEngineState(supabase, user.id);
  const state = await getLeadershipEngineState(supabase, user.id);

  const payload: StageSummaryResponse = buildStageSummaryResponse(state, null, null);
  const res = NextResponse.json(payload);
  copyCookiesAndDebug(base, res, req, true);
  return res;
}
