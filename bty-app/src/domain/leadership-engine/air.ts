/**
 * Leadership Engine — AIR (Action Integrity Rate).
 * Single source: docs/LEADERSHIP_ENGINE_SPEC.md §4.
 *
 * Weighted AIR = sum(weight of completed+verified) / sum(weight of chosen)
 *   - micro_win weight = 1.0
 *   - reset weight     = 2.0
 *
 * Penalty: each missed activation window → -0.10 (floor 0).
 * Flag:    3 consecutive missed windows → integrity_slip = true.
 *
 * Rolling windows: 7d, 14d, 90d.
 * All values recalculable from activation + verification logs.
 *
 * Pure domain only; no UI, API, or DB.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const WEIGHT_MICRO_WIN = 1.0 as const;
export const WEIGHT_RESET = 2.0 as const;
export const MISSED_WINDOW_PENALTY = 0.10 as const;
export const CONSECUTIVE_MISS_THRESHOLD = 3 as const;

export type ActivationType = "micro_win" | "reset";
export type AIRPeriod = "7d" | "14d" | "90d";

// ---------------------------------------------------------------------------
// Data model — matches LEADERSHIP_ENGINE_SPEC §9 Activation schema
// ---------------------------------------------------------------------------

export interface ActivationRecord {
  activation_id: string;
  user_id: string;
  type: ActivationType;
  chosen_at: Date;
  due_at: Date;
  completed_at: Date | null;
  verified: boolean;
}

export interface AIRResult {
  air: number;
  missedWindows: number;
  integritySlip: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function weightFor(type: ActivationType): number {
  return type === "reset" ? WEIGHT_RESET : WEIGHT_MICRO_WIN;
}

function isCompleted(a: ActivationRecord): boolean {
  return a.completed_at !== null && a.verified;
}

function isMissed(a: ActivationRecord, asOf: Date): boolean {
  return a.completed_at === null && a.due_at <= asOf;
}

function windowStart(period: AIRPeriod, asOf: Date): Date {
  const ms: Record<AIRPeriod, number> = {
    "7d": 7 * 86_400_000,
    "14d": 14 * 86_400_000,
    "90d": 90 * 86_400_000,
  };
  return new Date(asOf.getTime() - ms[period]);
}

// ---------------------------------------------------------------------------
// Core computation — pure, deterministic
// ---------------------------------------------------------------------------

/**
 * Compute AIR for a single user over a rolling window.
 *
 * @param activations  Raw activation log rows (any time range; filtered internally).
 * @param period       Rolling window: "7d" | "14d" | "90d".
 * @param asOf         Reference timestamp (defaults to now). All window/miss checks relative to this.
 */
export function computeAIR(
  activations: readonly ActivationRecord[],
  period: AIRPeriod,
  asOf: Date = new Date(),
): AIRResult {
  const start = windowStart(period, asOf);
  const inWindow = activations.filter((a) => a.chosen_at >= start && a.chosen_at <= asOf);

  if (inWindow.length === 0) {
    return { air: 0, missedWindows: 0, integritySlip: false };
  }

  let weightedChosen = 0;
  let weightedCompleted = 0;
  let missedWindows = 0;

  for (const a of inWindow) {
    const w = weightFor(a.type);
    weightedChosen += w;

    if (isCompleted(a)) {
      weightedCompleted += w;
    } else if (isMissed(a, asOf)) {
      missedWindows += 1;
    }
  }

  const rawAir = weightedChosen > 0 ? weightedCompleted / weightedChosen : 0;
  const penalised = rawAir - missedWindows * MISSED_WINDOW_PENALTY;
  const air = Math.max(0, Math.min(1, penalised));

  const integritySlip = detectIntegritySlip(inWindow, asOf);

  return { air, missedWindows, integritySlip };
}

// ---------------------------------------------------------------------------
// Integrity slip detection
// ---------------------------------------------------------------------------

/**
 * Returns true when 3+ consecutive activations (ordered by due_at) are missed.
 * Operates on the same window-filtered set for consistency.
 */
export function detectIntegritySlip(
  activations: readonly ActivationRecord[],
  asOf: Date = new Date(),
): boolean {
  const sorted = [...activations].sort(
    (a, b) => a.due_at.getTime() - b.due_at.getTime(),
  );

  let consecutive = 0;
  for (const a of sorted) {
    if (isMissed(a, asOf)) {
      consecutive += 1;
      if (consecutive >= CONSECUTIVE_MISS_THRESHOLD) return true;
    } else {
      consecutive = 0;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Convenience: compute all three windows at once
// ---------------------------------------------------------------------------

export interface AIRSnapshot {
  air_7d: AIRResult;
  air_14d: AIRResult;
  air_90d: AIRResult;
}

export function computeAIRSnapshot(
  activations: readonly ActivationRecord[],
  asOf: Date = new Date(),
): AIRSnapshot {
  return {
    air_7d: computeAIR(activations, "7d", asOf),
    air_14d: computeAIR(activations, "14d", asOf),
    air_90d: computeAIR(activations, "90d", asOf),
  };
}

// ---------------------------------------------------------------------------
// Legacy re-export (backward compat with P0 callers)
// ---------------------------------------------------------------------------

/** @deprecated Use ActivationRecord[] + computeAIR instead. Kept for P0/P1 compatibility. */
export type AIRLedger = {
  chosenActivations: number;
  executedActivations: number;
  integrityResetActivations: number;
  missedWindows: number;
  consecutiveNonExecutionCount: number;
  [k: string]: unknown;
};

/** @deprecated Use detectIntegritySlip instead. */
export function hasThreeConsecutiveNonExecutionWarning(ledger: AIRLedger): boolean {
  return ledger.consecutiveNonExecutionCount >= CONSECUTIVE_MISS_THRESHOLD;
}
