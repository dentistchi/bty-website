/**
 * Leadership Engine — 4 Core Stages & transition rules.
 * Single source: docs/ENGINE_ARCHITECTURE_DIRECTIVE_PLAN.md §1.
 * Pure domain only; no UI, API, or DB.
 */

// --- 4 Core Stages (names per §1) ---

export const STAGE_1 = 1 as const;
export const STAGE_2 = 2 as const;
export const STAGE_3 = 3 as const;
export const STAGE_4 = 4 as const;

export type Stage = 1 | 2 | 3 | 4;

export const STAGES: readonly Stage[] = [STAGE_1, STAGE_2, STAGE_3, STAGE_4] as const;

export const STAGE_NAMES: Readonly<Record<Stage, string>> = {
  1: "Over-Intervention (Speed Bias)",
  2: "Expectation Collapse (Cynicism Drift)",
  3: "Leadership Withdrawal (Responsibility Avoidance)",
  4: "Integrity Reset (Forced Realignment)",
} as const;

// --- Transition context (deterministic, data-driven) ---

export type StageTransitionContext =
  | "repeat_1_without_delegation"
  | "repeat_2_without_corrective_activation"
  | "air_below_threshold"
  | "stage_4_completion";

/**
 * Returns the next stage given current stage and transition context, or null if no transition.
 * Rules (§1): 1 repeat without delegation → 2; 2 repeat without corrective activation → 3;
 * 3 + AIR below threshold → 4; Stage 4 completion → 1.
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
