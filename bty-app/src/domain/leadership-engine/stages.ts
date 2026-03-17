/**
 * Leadership Engine — 4 Core Stages & transition rules.
 * Single source: docs/ENGINE_ARCHITECTURE_DIRECTIVE_PLAN.md §1.
 * 전이: getNextStage·StageTransitionContext. 진행률 매핑: STAGE_PROGRESS_PERCENT·stageProgressPercent (0–100).
 * Stage 4 (Integrity Reset) **강제 트리거** 조건 = `forced-reset.ts` (`evaluateForcedReset`). TII = `tii.ts` (별도).
 * Pure domain only; no UI, API, or DB.
 */

// --- 4 Core Stages (names per §1) ---

export const STAGE_1 = 1 as const;
export const STAGE_2 = 2 as const;
export const STAGE_3 = 3 as const;
export const STAGE_4 = 4 as const;

export type Stage = 1 | 2 | 3 | 4;

export const STAGES: readonly Stage[] = [STAGE_1, STAGE_2, STAGE_3, STAGE_4] as const;

/** LE Stage 경계 (API·진행도 검증용). stage ∈ [LE_STAGE_MIN, LE_STAGE_MAX]. */
export const LE_STAGE_MIN = STAGE_1;
export const LE_STAGE_MAX = STAGE_4;

export const STAGE_NAMES: Readonly<Record<Stage, string>> = {
  1: "Over-Intervention (Speed Bias)",
  2: "Expectation Collapse (Cynicism Drift)",
  3: "Leadership Withdrawal (Responsibility Avoidance)",
  4: "Integrity Reset (Forced Realignment)",
} as const;

// --- Progress boundary (0–100, per stage; single source for stage-summary) ---

export const PROGRESS_PERCENT_MIN = 0 as const;
export const PROGRESS_PERCENT_MAX = 100 as const;

export const PROGRESS_PERCENT_STAGE_1 = 25 as const;
export const PROGRESS_PERCENT_STAGE_2 = 50 as const;
export const PROGRESS_PERCENT_STAGE_3 = 75 as const;
export const PROGRESS_PERCENT_STAGE_4 = 100 as const;

export const STAGE_PROGRESS_PERCENT: Readonly<Record<Stage, number>> = {
  [STAGE_1]: PROGRESS_PERCENT_STAGE_1,
  [STAGE_2]: PROGRESS_PERCENT_STAGE_2,
  [STAGE_3]: PROGRESS_PERCENT_STAGE_3,
  [STAGE_4]: PROGRESS_PERCENT_STAGE_4,
} as const;

// --- Transition context (deterministic, data-driven) ---

export type StageTransitionContext =
  | "repeat_1_without_delegation"
  | "repeat_2_without_corrective_activation"
  | "air_below_threshold"
  | "stage_4_completion";

/** 유효 전이 컨텍스트 목록 (API·엔진 검증용). StageTransitionContext 단일 소스. */
export const STAGE_TRANSITION_CONTEXTS: readonly StageTransitionContext[] = [
  "repeat_1_without_delegation",
  "repeat_2_without_corrective_activation",
  "air_below_threshold",
  "stage_4_completion",
];

/**
 * Returns the next stage given current stage and transition context, or null if no transition.
 * Rules (§1): 1 repeat without delegation → 2; 2 repeat without corrective activation → 3;
 * 3 + AIR below threshold → 4 (`air_below_threshold`: align with `air.AIR_THRESHOLD_STAGE_ESCALATION` / low band);
 * Stage 4 completion → 1.
 */
export function getNextStage(
  currentStage: Stage,
  context: StageTransitionContext
): Stage | null {
  switch (currentStage) {
    case STAGE_1:
      return context === "repeat_1_without_delegation" ? STAGE_2 : null;
    case STAGE_2:
      return context === "repeat_2_without_corrective_activation" ? STAGE_3 : null;
    case STAGE_3:
      return context === "air_below_threshold" ? STAGE_4 : null;
    case STAGE_4:
      return context === "stage_4_completion" ? STAGE_1 : null;
    default:
      return null;
  }
}

/** 스테이지(1–4) → 진행률 0–100. 순수 함수. STAGE_PROGRESS_PERCENT 단일 소스. */
export function stageProgressPercent(stage: Stage): number {
  return STAGE_PROGRESS_PERCENT[stage] ?? PROGRESS_PERCENT_MIN;
}
