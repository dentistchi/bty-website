/**
 * Pattern Shift — **LAYER 2 (behavior validation)** per `docs/# BTY ENGINE — FINAL RULESET (v2 LOCKED).md` §4.
 *
 * **Not AIR.** Measures whether decision patterns change after re-exposure, not whether actions were executed.
 *
 * **Runtime-connected:** `patternShiftBandFromReexposure` is invoked by `POST /api/arena/re-exposure/validate`
 * (via `computeReexposureValidation`). The resulting band (`changed` | `unstable` | `no_change`) is persisted on
 * `arena_pending_outcomes.validation_payload` (JSONB); there is no dedicated `pattern_shift_results` table.
 * `PatternShiftBand` is the canonical runtime vocabulary for this band — import it; do not re-declare the union.
 */

export type PatternShiftBand = "changed" | "unstable" | "no_change";

/**
 * Provenance of a re-exposure `validation_result`.
 *
 * - `"computed"` — produced by {@link patternShiftBandFromReexposure} from measured
 *   before/after signals (an operational band judgement).
 * - `"insufficient_signal"` — fallback collapse: a required input was absent, so the
 *   band judgement could not run. The stored band stays a {@link PatternShiftBand}
 *   value (no new band is introduced); this metadata records that the value is NOT
 *   measured behaviour evidence and must not feed confidence / repeat / verified XP.
 */
export type ValidationResultOrigin = "computed" | "insufficient_signal";

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
