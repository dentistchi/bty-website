/**
 * Pattern Trigger Engine — evaluates which QR trigger condition fires.
 *
 * 4 conditions (BTY Engine Final Architecture v1, §2-③):
 *   1. Immediate      exit + intensity 3 on a single signal → Forced QR
 *   2. Accumulation   same family exit ≥ 3 in 7-run window → QR
 *   3. Convergence    3+ distinct families with exit in window → QR
 *   4. Integrity Gap  entry_count > exit_count AND exit_count > 0 (says the right things, never acts) → Forced QR
 *
 * Pure domain — no DB, no I/O.
 */

export type TriggerSeverity = "QR" | "FORCED";

export type TriggerType =
  | "immediate"
  | "accumulation"
  | "convergence"
  | "integrity_gap";

export type PatternTriggerResult = {
  trigger: true;
  type: TriggerType;
  severity: TriggerSeverity;
  /** pattern_family that fired (or "multi" for convergence). */
  axis: string;
};

export type PatternTriggerInput = {
  /** pattern_family of the most recent signal — used for Immediate. */
  latestFamily: string;
  /** Direction of the most recent signal. */
  latestDirection: "entry" | "exit";
  /** Intensity of the most recent signal (1–3). Undefined = treat as 1. */
  latestIntensity?: 1 | 2 | 3;
  /** Full pattern state snapshot for the current user (from pattern_states). */
  familyStates: ReadonlyArray<{
    pattern_family: string;
    /** exit run count in 7-run window (family_window_tally). */
    exit_count: number;
    entry_count: number;
  }>;
};

/** exit ≥ this value in 7-run window fires Accumulation. Matches PATTERN_ACTION_CONTRACT_EXIT_THRESHOLD. */
export const ACCUMULATION_EXIT_THRESHOLD = 3;

/** Number of distinct families with exits required for Convergence. */
export const CONVERGENCE_FAMILY_THRESHOLD = 3;

/**
 * Evaluates all 4 trigger conditions in priority order.
 * Returns the first (highest-priority) match, or null if none fire.
 *
 * Priority: Immediate > Integrity Gap > Accumulation > Convergence
 */
export function evaluatePatternTrigger(
  input: PatternTriggerInput,
): PatternTriggerResult | null {
  // 1. Immediate — latest signal is exit with intensity 3
  if (
    input.latestDirection === "exit" &&
    (input.latestIntensity ?? 1) === 3
  ) {
    return {
      trigger: true,
      type: "immediate",
      severity: "FORCED",
      axis: input.latestFamily,
    };
  }

  // 4. Integrity Gap — entry_count > exit_count AND exit_count > 0
  //    (pattern of saying the right thing without following through)
  const gapFamily = input.familyStates.find(
    (s) => s.exit_count > 0 && s.entry_count > s.exit_count,
  );
  if (gapFamily) {
    return {
      trigger: true,
      type: "integrity_gap",
      severity: "FORCED",
      axis: gapFamily.pattern_family,
    };
  }

  // 2. Accumulation — same family exit ≥ 3 in window
  const accFamily = input.familyStates.find(
    (s) => s.exit_count >= ACCUMULATION_EXIT_THRESHOLD,
  );
  if (accFamily) {
    return {
      trigger: true,
      type: "accumulation",
      severity: "QR",
      axis: accFamily.pattern_family,
    };
  }

  // 3. Convergence — 3+ families with at least 1 exit
  const familiesWithExit = input.familyStates.filter((s) => s.exit_count > 0);
  if (familiesWithExit.length >= CONVERGENCE_FAMILY_THRESHOLD) {
    return {
      trigger: true,
      type: "convergence",
      severity: "QR",
      axis: "multi",
    };
  }

  return null;
}
