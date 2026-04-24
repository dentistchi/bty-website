/**
 * Pattern signature aggregation — **explicit state machine** (Phase B).
 * Maps re-exposure `validation_result` events onto durable `current_state` for (pattern_family × axis).
 *
 * Not AIR / not XP. Uncertainty stays visible (`unstable` does not collapse to “good”).
 *
 * @see docs — reinforcement loop closes on `changed`; follow-ups on `unstable` / `no_change`.
 */

import type { PatternShiftBand } from "@/domain/leadership-engine/patternShift";

/** Stored on `user_pattern_signatures.current_state`. */
export type PatternSignatureAggregateState = "active" | "unstable" | "improving" | "resolved";

export type PatternSignaturePrevSnapshot = {
  current_state: PatternSignatureAggregateState;
  repeat_count: number;
  confidence_score: number;
  lifetime_changed_count: number;
};

export type PatternSignatureEvent = {
  validation_result: PatternShiftBand;
};

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

/**
 * Single step of the aggregate state machine.
 *
 * Transitions (baseline):
 * - First event → `active` (or `unstable` if first result is unstable).
 * - `unstable` → `unstable` (repeat evidence).
 * - `no_change` → `active` (pattern stuck on axis; confidence rises slowly).
 * - `changed` after enough repetition (`repeat_count` ≥ 2 before increment) from `active`/`unstable` → `improving`.
 * - `changed` while `improving` → `resolved`.
 * - `changed` while `resolved` → back to `improving` (signature re-engaged).
 * - From `resolved`, `unstable` / `no_change` → `unstable` / `active` (reappearance).
 */
export function applyPatternSignatureTransition(
  prev: PatternSignaturePrevSnapshot | null,
  event: PatternSignatureEvent,
): Omit<PatternSignaturePrevSnapshot, "repeat_count"> & { repeat_count_delta: number } {
  const vr = event.validation_result;

  if (prev == null) {
    const baseConf = 0.32;
    if (vr === "unstable") {
      return {
        current_state: "unstable",
        repeat_count_delta: 1,
        confidence_score: clamp01(baseConf + 0.1),
        lifetime_changed_count: 0,
      };
    }
    if (vr === "no_change") {
      return {
        current_state: "active",
        repeat_count_delta: 1,
        confidence_score: clamp01(baseConf + 0.06),
        lifetime_changed_count: 0,
      };
    }
    return {
      current_state: "active",
      repeat_count_delta: 1,
      confidence_score: clamp01(baseConf + 0.04),
      lifetime_changed_count: 1,
    };
  }

  const lc = prev.lifetime_changed_count + (vr === "changed" ? 1 : 0);

  if (vr === "unstable") {
    let state: PatternSignatureAggregateState = "unstable";
    if (prev.current_state === "resolved") state = "unstable";
    return {
      current_state: state,
      repeat_count_delta: 1,
      confidence_score: clamp01(prev.confidence_score + 0.12),
      lifetime_changed_count: prev.lifetime_changed_count,
    };
  }

  if (vr === "no_change") {
    let state: PatternSignatureAggregateState = "active";
    if (prev.current_state === "resolved") state = "active";
    return {
      current_state: state,
      repeat_count_delta: 1,
      confidence_score: clamp01(prev.confidence_score + 0.08),
      lifetime_changed_count: prev.lifetime_changed_count,
    };
  }

  // changed
  if (prev.current_state === "resolved") {
    return {
      current_state: "improving",
      repeat_count_delta: 1,
      confidence_score: clamp01(prev.confidence_score + 0.05),
      lifetime_changed_count: lc,
    };
  }

  if (prev.current_state === "improving") {
    return {
      current_state: "resolved",
      repeat_count_delta: 1,
      confidence_score: clamp01(prev.confidence_score + 0.14),
      lifetime_changed_count: lc,
    };
  }

  if (
    (prev.current_state === "active" || prev.current_state === "unstable") &&
    prev.repeat_count >= 2
  ) {
    return {
      current_state: "improving",
      repeat_count_delta: 1,
      confidence_score: clamp01(prev.confidence_score + 0.1),
      lifetime_changed_count: lc,
    };
  }

  return {
    current_state: "active",
    repeat_count_delta: 1,
    confidence_score: clamp01(prev.confidence_score + 0.09),
    lifetime_changed_count: lc,
  };
}
