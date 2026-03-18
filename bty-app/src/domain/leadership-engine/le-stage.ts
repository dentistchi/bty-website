/**
 * Leadership Engine — LE Stage API / Arena 결과·행동 패턴 노출용 타입.
 * Pure types only. No UI, API, or DB.
 * Ref: docs/ROADMAP_Q3_Q4.md LE Stage, docs/ENGINE_ARCHITECTURE_DIRECTIVE_PLAN.md.
 */

import type { Stage } from "./stages";
import {
  PROGRESS_PERCENT_MAX,
  LE_STAGE_MAX,
  LE_STAGE_MIN,
  STAGE_NAMES,
  stageProgressPercent,
} from "./stages";

/** 진행도 0–100 내 스테이지당 기본 스텝 (25%). API·위젯 진행도 표시용. */
export const LE_STAGE_PROGRESS_STEP = PROGRESS_PERCENT_MAX / LE_STAGE_MAX;

/** Arena 런/시나리오 결과 요약 — API·대시보드 노출용. */
export interface ArenaResultSummary {
  /** LE Core Stage 1–4 (`stages.Stage`). Not Arena Core-XP stage 1–7 (`level-tier.stageFromCoreXp`). */
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

/** LE Stage 한 줄 요약 — API 응답·위젯용. GET stage-summary 응답 스키마 단일 소스. */
export interface LEStageSummary {
  currentStage: Stage;
  stageName: string;
  progressPercent: number;
  /** 리셋 예정 시각 (ISO string). null이면 미설정. */
  resetDueAt?: string | null;
  /** 강제 리셋 발생 시각 (ISO string). null이면 미발생. */
  forcedResetTriggeredAt?: string | null;
  arenaSummary?: ArenaResultSummary | null;
  behaviorPattern?: BehaviorPatternSummary | null;
}

function clampLeStage(n: number): Stage {
  const s = Math.floor(Number(n));
  if (s < LE_STAGE_MIN) return LE_STAGE_MIN;
  if (s > LE_STAGE_MAX) return LE_STAGE_MAX;
  return s as Stage;
}

/**
 * Arena 런 완료·결과 API용 LE Stage 노출 (순수). Core-XP 스테이지(1–7)와 구분.
 * UI/API는 이 객체를 그대로 직렬화; 전이 로직은 별도.
 */
export function leStageDisplayForArenaRunResult(input: {
  leStage: Stage | number;
  completedRunsInPeriod: number;
  periodLabel?: string;
}): {
  currentStage: Stage;
  stageName: string;
  progressPercent: number;
  arenaSummary: ArenaResultSummary;
} {
  const currentStage = clampLeStage(input.leStage as number);
  const completedCount = Math.max(0, Math.floor(input.completedRunsInPeriod));
  return {
    currentStage,
    stageName: STAGE_NAMES[currentStage],
    progressPercent: stageProgressPercent(currentStage),
    arenaSummary: {
      currentStage,
      completedCount,
      periodLabel: input.periodLabel,
    },
  };
}

/** 주간 요약(런 외 소스) + 런 세션 집계를 한 번에 노출 — 대시보드·주간 위젯용. */
export interface LeWeeklyPeriodSummary {
  runCount: number;
  reflectionCount: number;
  periodLabel?: string;
}

export function leStageDisplayWithWeeklySummary(input: {
  leStage: Stage | number;
  /** 직전 런/세션 완료 건수(단일 소스에서 온 값) */
  sessionCompletedCount: number;
  /** 주간 누적 런 수(주간 요약 테이블·집계) */
  weeklyRunCount: number;
  weeklyReflectionCount?: number;
  periodLabel?: string;
}): {
  currentStage: Stage;
  stageName: string;
  progressPercent: number;
  arenaSummary: ArenaResultSummary;
  weeklyPeriodSummary: LeWeeklyPeriodSummary;
} {
  const base = leStageDisplayForArenaRunResult({
    leStage: input.leStage,
    completedRunsInPeriod: input.sessionCompletedCount,
    periodLabel: input.periodLabel,
  });
  return {
    ...base,
    weeklyPeriodSummary: {
      runCount: Math.max(0, Math.floor(input.weeklyRunCount)),
      reflectionCount: Math.max(0, Math.floor(input.weeklyReflectionCount ?? 0)),
      periodLabel: input.periodLabel,
    },
  };
}

export type LeActivityVolumeTier = "light" | "steady" | "strong";

/**
 * 주간·누적 런(또는 동일 스칼라) 요약 → Stage 라벨용 활동 티어. i18n 키 접미사로 사용.
 */
export function leStageActivityVolumeTier(input: {
  weeklyRuns: number;
  cumulativeRuns: number;
}): LeActivityVolumeTier {
  const w = Math.max(0, Math.floor(input.weeklyRuns));
  const c = Math.max(0, Math.floor(input.cumulativeRuns));
  if (w >= 10 || c >= 50) return "strong";
  if (w >= 3 || c >= 15) return "steady";
  return "light";
}

/** 엣지: 동일 Stage라도 주간 2 vs 10에서 티어·키 분기 */
export function leStageSummaryLabelKey(input: {
  stage: Stage | number;
  weeklyRuns: number;
  cumulativeRuns: number;
}): string {
  const s = clampLeStage(input.stage as number);
  const v = leStageActivityVolumeTier(input);
  return `le_stage_s${s}_${v}`;
}
