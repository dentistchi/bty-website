/**
 * Center Healing Journey — 4 linear phases (인정→성찰→재통합→갱신).
 * Pure rules only; persistence in `user_center_healing_journey` + Center diagnostics counts.
 * @see lib/bty/center/healingPhaseService.ts
 */

import type { AwakeningActId } from "@/domain/healing";

/** 1=인정, 2=성찰, 3=재통합, 4=갱신 */
export type HealingJourneyPhaseId = 1 | 2 | 3 | 4;

export const HEALING_JOURNEY_PHASE_IDS: readonly HealingJourneyPhaseId[] = [1, 2, 3, 4];

/** Korean stepper labels (single source for display; i18n may add EN). */
export const HEALING_JOURNEY_PHASE_LABEL_KO: Record<HealingJourneyPhaseId, string> = {
  1: "인정",
  2: "성찰",
  3: "재통합",
  4: "갱신",
};

/** Observable Center inputs (no PII; counts and act ids only). */
export type CenterHealingPhaseInputs = {
  assessmentSubmissionCount: number;
  dearMeLetterCount: number;
  completedAwakeningActIds: readonly AwakeningActId[];
};

function hasAct(acts: readonly AwakeningActId[], id: AwakeningActId): boolean {
  return acts.includes(id);
}

/**
 * All Center diagnostics required to **complete** the given phase (exit criteria).
 * Phase 4 is complete when all four criteria rings are satisfied (terminal).
 */
export function phaseCompletionCriteriaMet(
  phase: HealingJourneyPhaseId,
  inputs: CenterHealingPhaseInputs
): boolean {
  const a = inputs.assessmentSubmissionCount;
  const l = inputs.dearMeLetterCount;
  const acts = inputs.completedAwakeningActIds;

  switch (phase) {
    case 1:
      return a >= 1;
    case 2:
      return a >= 1 && l >= 1;
    case 3:
      return a >= 1 && l >= 1 && hasAct(acts, 1);
    case 4:
      return a >= 1 && l >= 1 && hasAct(acts, 1) && hasAct(acts, 2) && hasAct(acts, 3);
    default:
      return false;
  }
}

/**
 * Stored `active_phase` from DB (1–4). Validates range.
 */
export function normalizeStoredHealingPhase(raw: unknown): HealingJourneyPhaseId {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (n === 1 || n === 2 || n === 3 || n === 4) return n;
  return 1;
}
