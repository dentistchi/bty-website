import { STAGE_CODES, STAGE_STEP_SIZE, STAGE_VISIBLE_MAX } from "./constants";
import type { StageState } from "./types";

/**
 * Derive stage from coreXp.
 * We intentionally keep it simple:
 * - stageIndex grows with coreXp
 * - visible until 699 (7*100 - 1), then hidden
 *
 * Later: we can change mapping (non-linear) without changing storage shape.
 */
export function deriveStageFromCoreXp(coreXp: number): StageState {
  const safeXp = Math.max(0, Math.floor(coreXp));
  const stageIndex = safeXp; // A1: 1 xp == 1 step. Later can be re-mapped.

  const codenameVisible = stageIndex <= STAGE_VISIBLE_MAX;

  if (!codenameVisible) {
    return {
      stageIndex,
      codenameVisible: false,
    };
  }

  const stageNumber = Math.floor(stageIndex / STAGE_STEP_SIZE) + 1; // 1..7
  const stepInStage = stageIndex % STAGE_STEP_SIZE; // 0..99
  const codeName = STAGE_CODES[stageNumber - 1];

  return {
    stageIndex,
    codenameVisible: true,
    codeName,
    stageNumber,
    stepInStage,
  };
}
