/**
 * Leadership Engine — Stage 4 (Integrity Reset) forced trigger logic.
 * Single source: docs/LEADERSHIP_ENGINE_SPEC.md §5, ENGINE_ARCHITECTURE_DIRECTIVE_PLAN §4 P3.
 *
 * Stage 4 triggers when ANY TWO of:
 *   - Stage 3 selected twice within 14 days
 *   - AIR_7d < 0.70 for 2 consecutive weeks
 *   - No QR verification for 7 days
 *   - TSP declining for 2 consecutive weeks
 *
 * Constraints: User may delay reset max 48h; reset cannot be permanently dismissed;
 * after completion → Stage returns to 1.
 *
 * Pure domain only; no UI, API, or DB.
 */

export const FORCED_RESET_STAGE3_COUNT_THRESHOLD = 2 as const;
export const FORCED_RESET_AIR_7D_THRESHOLD = 0.7 as const;
export const FORCED_RESET_NO_QR_DAYS_THRESHOLD = 7 as const;
export const FORCED_RESET_DELAY_HOURS = 48 as const;

/** Inputs for evaluating forced reset. All must be provided by caller (API/cron from logs/snapshots). */
export interface ResetEvalInputs {
  /** Number of times Stage 3 was selected in the last 14 days. */
  stage3SelectedCountIn14d: number;
  /** True if AIR_7d has been < 0.70 for each of the last 2 consecutive weeks (weekly snapshots). */
  air7dBelow70ForTwoConsecutiveWeeks: boolean;
  /** Days since last QR verification (any verified activation with method=qr). */
  noQrVerificationDays: number;
  /** True if TSP (Team Stability Pulse) was lower in week n than week n-1 for each of the last 2 consecutive weeks. */
  tspDecliningTwoConsecutiveWeeks: boolean;
}

export interface ForcedResetEvalResult {
  shouldTrigger: boolean;
  reasons: string[];
}

const REASON_STAGE3_TWICE = "stage3_selected_twice_in_14d";
const REASON_AIR_LOW_TWO_WEEKS = "air_7d_below_70_two_consecutive_weeks";
const REASON_NO_QR_7_DAYS = "no_qr_verification_7_days";
const REASON_TSP_DECLINING_TWO_WEEKS = "tsp_declining_two_consecutive_weeks";

/**
 * Deterministic evaluation: Stage 4 (Integrity Reset) must trigger when ANY TWO
 * of the four conditions are met.
 */
export function evaluateForcedReset(inputs: ResetEvalInputs): ForcedResetEvalResult {
  const reasons: string[] = [];

  if (inputs.stage3SelectedCountIn14d >= FORCED_RESET_STAGE3_COUNT_THRESHOLD) {
    reasons.push(REASON_STAGE3_TWICE);
  }
  if (inputs.air7dBelow70ForTwoConsecutiveWeeks) {
    reasons.push(REASON_AIR_LOW_TWO_WEEKS);
  }
  if (inputs.noQrVerificationDays >= FORCED_RESET_NO_QR_DAYS_THRESHOLD) {
    reasons.push(REASON_NO_QR_7_DAYS);
  }
  if (inputs.tspDecliningTwoConsecutiveWeeks) {
    reasons.push(REASON_TSP_DECLINING_TWO_WEEKS);
  }

  const shouldTrigger = reasons.length >= 2;
  return { shouldTrigger, reasons };
}

/**
 * Returns reset due timestamp (triggeredAt + 48h). Used by handler/API.
 */
export function getResetDueAt(triggeredAt: Date): Date {
  const due = new Date(triggeredAt.getTime() + FORCED_RESET_DELAY_HOURS * 60 * 60 * 1000);
  return due;
}
