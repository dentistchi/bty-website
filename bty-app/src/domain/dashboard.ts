/**
 * 대시보드 — 진도·추천 요약에 쓸 공통 타입·상수.
 * Pure types only. No UI, API, or DB.
 * Ref: docs/ROADMAP_Q3_Q4.md 대시보드.
 */

/** 영역별 진도 요약 (0–100 또는 null). */
export interface ProgressSummary {
  arenaProgress?: number | null;
  foundryProgress?: number | null;
  centerProgress?: number | null;
}

/** 추천 출처 (어느 영역 기준). */
export type RecommendationSource = "arena" | "foundry" | "center" | null;

/** 소스별 우선순위 (높을수록 먼저 노출). 대시보드 recommendation 정렬 단일 소스. */
export const RECOMMENDATION_SOURCE_PRIORITY: Readonly<Record<NonNullable<RecommendationSource>, number>> = {
  arena: 30,
  foundry: 20,
  center: 10,
} as const;

/** 추천 트랙·다음 행동 요약. */
export interface RecommendationSummary {
  recommendedTrack?: string | null;
  nextAction?: string | null;
  /** 추천 근거 영역. API가 채움. */
  source?: RecommendationSource;
  /** 정렬·우선순위용 (높을수록 우선). RECOMMENDATION_SOURCE_PRIORITY 또는 API 지정값 사용. */
  priority?: number | null;
}
