/**
 * GET /api/arena/dashboard/summary — Arena·Foundry·Center 공통 **대시보드 요약** (LE 진도 + 추천 + 오늘 XP).
 *
 * @contract
 * - **Auth:** 무세션 → 401 (`unauthenticated`; 쿠키 복사 패턴).
 * - **Query:** `source=arena|foundry|center` — 필터 시 추천 `source`가 일치하지 않으면 `recommendation: null`.
 * - **200 — progress (LE 필드):** `currentStage`, `stageName`, `progressPercent` (0–100), `forcedResetTriggeredAt`, `resetDueAt` — Foundry·통합 대시보드 LE 위젯 소스.
 * - **AIR 필드:** 본 응답 JSON에 `air_*` 미포함. 동일 세션에서 `GET /api/arena/leadership-engine/air` 호출해 `air_7d`·`air_14d`·`air_90d` 병합 표시.
 * - **200 — recommendation (`RecommendationSummary` 연장 스키마):** 현재 응답은 `nextAction`, `source`, `priority`.
 *   도메인 타입상 **연장 필드** `recommendedTrack` 등은 Foundry/Center 추천 연동 시 채울 수 있음 (미채움 시 생략).
 * - **200 — todayGrowth:** `{ xpToday }` — 금일 UTC `arena_events.xp` 합(표시용; 주간 랭킹과 별개).
 * - **503:** `{ error: "SERVICE_UNAVAILABLE", message?: string }` — DB/게이트웨이 일시 불가 시(계약; 필요 시 라우트에서 반환).
 * - **500:** `{ error: "DASHBOARD_SUMMARY_FAILED", detail?: string }` — LE 상태·arena_events 조회 등 처리 중 예외.
 * - **캐시·페이지:** 사용자별 동적 데이터 — 응답 `Cache-Control: private, no-store, max-age=0`(공유 CDN·풀 라우트 캐시 비권장).
 *
 * @see `src/domain/dashboard.ts` RecommendationSummary · docs/spec/ARENA_DOMAIN_SPEC.md §4-11
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
import { arenaRecommendationSourceFromParam } from "@/domain/rules/arenaRecommendationSourceFromParam";

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

function startOfTodayUTC(): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

function parseSourceParam(req: NextRequest): RecommendationSource | null {
  return arenaRecommendationSourceFromParam(req.nextUrl.searchParams.get("source"));
}

export async function GET(req: NextRequest) {
  try {
    const { user, supabase, base } = await requireUser(req);
    if (!user) return unauthenticated(req, base);

    let state: Awaited<ReturnType<typeof getLeadershipEngineState>>;
    try {
      await ensureLeadershipEngineState(supabase, user.id);
      state = await getLeadershipEngineState(supabase, user.id);
    } catch {
      const res = NextResponse.json(
        { error: "SERVICE_UNAVAILABLE", message: "LE_STATE_UNAVAILABLE" },
        { status: 503 },
      );
      res.headers.set("Cache-Control", "private, no-store, max-age=0");
      copyCookiesAndDebug(base, res, req, true);
      return res;
    }

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
    res.headers.set("Cache-Control", "private, no-store, max-age=0");
    copyCookiesAndDebug(base, res, req, true);
    return res;
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    const res = NextResponse.json(
      { error: "DASHBOARD_SUMMARY_FAILED", detail },
      { status: 500 },
    );
    res.headers.set("Cache-Control", "private, no-store, max-age=0");
    return res;
  }
}
