/**
 * Pattern Shift — **LAYER 2 (behavior validation)** per `docs/# BTY ENGINE — FINAL RULESET (v2 LOCKED).md` §4.
 *
 * **Not AIR.** Measures whether decision patterns change after re-exposure, not whether actions were executed.
 *
 * **Persistence gap:** There is no `pattern_shift_results` table or API wire-up yet. This module is the **minimal
 * integration point**: when re-exposure outcomes are stored, map them through `patternShiftBandFromReexposure`
 * and expose `pattern_shift_band` to clients from that pipeline only.
 */

export type PatternShiftBand = "changed" | "unstable" | "no_change";

/**
 * Classify Pattern Shift from re-exposure comparison (locked rules §4).
 *
 * - exit → **entry** ⇒ `changed`
 * - exit → **same** exit pattern (and not lower intensity) ⇒ `no_change`
 * - exit → **different** exit **or** lower intensity ⇒ `unstable`
 */
export function patternShiftBandFromReexposure(context: {
  /** After re-exposure, user is in an "entry" state (left exit toward entry) — rules: exit → entry = changed. */
  reentryAsEntry: boolean;
  /** Stable key for exit pattern before action (e.g. pattern family + exit id). */
  priorExitPatternKey: string;
  /** Exit pattern key after re-exposure; ignored when `reentryAsEntry` is true. */
  afterExitPatternKey: string;
  /** True when intensity decreased vs prior exit (rules: lower intensity ⇒ unstable). */
  intensityDecreased?: boolean;
}): PatternShiftBand {
  if (context.reentryAsEntry) return "changed";
  const sameExit =
    context.afterExitPatternKey === context.priorExitPatternKey && context.priorExitPatternKey !== "";
  if (sameExit && !context.intensityDecreased) return "no_change";
  return "unstable";
}
