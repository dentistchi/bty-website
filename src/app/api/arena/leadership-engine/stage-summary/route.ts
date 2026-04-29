/**
 * GET /api/arena/leadership-engine/stage-summary — LE Stage + Arena·행동 패턴 요약.
 *
 * @contract
 * - **200:** `StageSummaryResponse` — `currentStage`, `stageName`, `progressPercent`, reset 필드 +
 *   `arenaSummary`, `behaviorPattern` (**빈 로그·미집계 시 둘 다 `null`** — 정상 200).
 * - **401:** `{ error: "UNAUTHENTICATED" }`.
 * - **500:** LE state 보장/조회 실패 시(명시 JSON 미보장·Next 오류 페이지 가능).
 *
 * @see domain/leadership-engine/le-stage.ts LEStageSummary
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
