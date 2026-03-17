/**
 * 대시보드·Arena 추천·진도 타입 단일 소스 (API·위젯).
 * RecommendationSummary·ProgressSummary = 대시보드·Arena API 응답 타입 단일 소스. Pure types only. No UI, API, or DB.
 * Ref: docs/ROADMAP_Q3_Q4.md 대시보드.
 */

/** 영역별 진도 미제공 시 표시할 기본값 (0). */
export const PROGRESS_PERCENT_DEFAULT = 0 as const;

/** 영역별 진도 상한 (0–100). ProgressSummary·진도 표시 단일 경계. leadership-engine PROGRESS_PERCENT_MAX와 의미 동일, 네임스페이스 충돌 회피로 별도 이름. */
export const DASHBOARD_PROGRESS_PERCENT_MAX = 100 as const;

/**
 * 영역별 진도 요약 (0–100 또는 null).
 * Percent scale matches `leadership-engine/stages` `PROGRESS_PERCENT_MAX` (100) for Arena LE widgets.
 * API must clamp each value to [0, DASHBOARD_PROGRESS_PERCENT_MAX] before filling.
 */
export interface ProgressSummary {
  arenaProgress?: number | null;
  foundryProgress?: number | null;
  centerProgress?: number | null;
}

/** 추천 출처 — 반드시 `RECOMMENDATION_SOURCE_ORDER` 멤버 또는 null. */
export type RecommendationSource = "arena" | "foundry" | "center" | null;

/** 소스별 우선순위 (높을수록 먼저 노출). 대시보드 recommendation 정렬 단일 소스. */
export const RECOMMENDATION_SOURCE_PRIORITY: Readonly<Record<NonNullable<RecommendationSource>, number>> = {
  arena: 30,
  foundry: 20,
  center: 10,
} as const;

/** 소스 정렬 순서 (RECOMMENDATION_SOURCE_PRIORITY 기준). API·정렬 루프용. */
export const RECOMMENDATION_SOURCE_ORDER: readonly NonNullable<RecommendationSource>[] = [
  "arena",
  "foundry",
  "center",
] as const;

/** 추천 트랙·다음 행동 요약. */
export interface RecommendationSummary {
  recommendedTrack?: string | null;
  nextAction?: string | null;
  /** 추천 근거 영역. API가 채움. */
  source?: RecommendationSource;
  /** 정렬·우선순위용 (높을수록 우선). RECOMMENDATION_SOURCE_PRIORITY 또는 API 지정값 사용. */
  priority?: number | null;
}
