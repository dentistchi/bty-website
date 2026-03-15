/**
 * Leadership Engine — LE Stage API / Arena 결과·행동 패턴 노출용 타입.
 * Pure types only. No UI, API, or DB.
 * Ref: docs/ROADMAP_Q3_Q4.md LE Stage, docs/ENGINE_ARCHITECTURE_DIRECTIVE_PLAN.md.
 */

import type { Stage } from "./stages";

/** Arena 런/시나리오 결과 요약 — API·대시보드 노출용. */
export interface ArenaResultSummary {
  /** 사용자 현재 스테이지 (1–4). */
  currentStage: Stage;
  /** 완료한 시나리오 수 (또는 해당 기간 내 런 수). */
  completedCount: number;
  /** 기간 식별자 (예: week_id, month). */
  periodLabel?: string;
}

/** 행동 패턴 요약 — 반복 패턴·전환 컨텍스트 노출용. */
export interface BehaviorPatternSummary {
  /** 관찰된 전환 컨텍스트 (repeat_1_without_delegation 등). */
  transitionContext: string | null;
  /** 스테이지 전환 발생 여부. */
  didTransition: boolean;
  /** 다음 권장 스테이지 (null이면 유지). */
  nextStage: Stage | null;
}

/** LE Stage 한 줄 요약 — API 응답·위젯용. */
export interface LEStageSummary {
  currentStage: Stage;
  stageName: string;
  progressPercent: number;
  arenaSummary?: ArenaResultSummary;
  behaviorPattern?: BehaviorPatternSummary;
}
