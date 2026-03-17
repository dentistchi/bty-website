/**
 * GET /api/arena/dashboard/summary
 * 대시보드용 진도·추천·오늘 성장 요약. 도메인 타입·서비스 호출만; recommendation 실데이터 연동(기본값).
 *
 * Query (optional): source=arena|foundry|center — filter recommendation by source.
 * Response 200: progress, recommendation, todayGrowth (xpToday from arena_events since start of today UTC). See DashboardSummaryResponse.
 * Response 401: { error: "UNAUTHENTICATED" }. LE/DB failures may surface as 500 (no explicit JSON envelope in route).
 */
import { NextRequest, NextResponse } from "next/server";
import { requireUser, unauthenticated, copyCookiesAndDebug } from "@/lib/supabase/route-client";
import {
  getLeadershipEngineState,
  ensureLeadershipEngineState,
} from "@/lib/bty/leadership-engine/state-service";
import { stageProgressPercent, type Stage } from "@/domain/leadership-engine/stages";
import type { RecommendationSummary, RecommendationSource } from "@/domain/dashboard";
import { RECOMMENDATION_SOURCE_PRIORITY } from "@/domain/dashboard";

export type DashboardSummaryResponse = {
  progress: {
    currentStage: Stage;
    stageName: string;
    progressPercent: number;
    forcedResetTriggeredAt: string | null;
    resetDueAt: string | null;
  };
  recommendation: RecommendationSummary | null;
  todayGrowth: { xpToday: number };
};

const VALID_SOURCES: RecommendationSource[] = ["arena", "foundry", "center"];

function startOfTodayUTC(): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

function parseSourceParam(req: NextRequest): RecommendationSource | null {
  const source = req.nextUrl.searchParams.get("source");
  if (source == null || source === "") return null;
  return VALID_SOURCES.includes(source as RecommendationSource) ? (source as RecommendationSource) : null;
}

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
    priority: RECOMMENDATION_SOURCE_PRIORITY.arena,
  };

  const filterSource = parseSourceParam(req);
  const recommendationOut: RecommendationSummary | null =
    filterSource != null && recommendation.source !== filterSource ? null : recommendation;

  const since = startOfTodayUTC();
  const { data: eventRows } = await supabase
    .from("arena_events")
    .select("xp")
    .eq("user_id", user.id)
    .gte("created_at", since);
  const xpToday = (eventRows ?? []).reduce((sum, r) => sum + (Number((r as { xp?: unknown }).xp) || 0), 0);

  const payload: DashboardSummaryResponse = {
    progress: {
      currentStage: state.currentStage,
      stageName: state.stageName,
      progressPercent,
      forcedResetTriggeredAt: state.forcedResetTriggeredAt,
      resetDueAt: state.resetDueAt,
    },
    recommendation: recommendationOut,
    todayGrowth: { xpToday },
  };

  const res = NextResponse.json(payload);
  copyCookiesAndDebug(base, res, req, true);
  return res;
}
