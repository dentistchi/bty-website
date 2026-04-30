/**
 * Pattern History domain — pure functions, no I/O.
 * Ref: QUICK_MODE_PATTERN_TYPE_SPEC_V1
 *
 * Pattern types:
 *   intent            — choice made in Quick Mode; NOT air_eligible
 *   action            — action contract completed (full or quick); air_eligible when action_completed=true
 *   abandonment_signal — >= threshold quick intents with no action in window; never air_eligible
 *
 * AIR invariant: only rows with air_eligible=true are consumed by the AIR engine.
 * The AIR engine itself (domain/leadership-engine/air.ts) is unchanged.
 */

export type PatternType = "intent" | "action" | "abandonment_signal";
export type SourceMode = "full_arena" | "quick_mode";

export interface PatternHistoryInsert {
  user_id: string;
  scenario_id: string;
  pattern_type: PatternType;
  source_mode: SourceMode;
  axis: string | null;
  action_completed: boolean;
  air_eligible: boolean;
  weight: number;
}

export interface PatternHistoryRow extends PatternHistoryInsert {
  id: string;
  created_at: string;
}

export interface GapMetric {
  intent_total: number;
  action_completed: number;
  abandonment_signals: number;
  /** action_completed / max(intent_total, 1) */
  completion_rate: number;
}

const QUICK_MODE_ACTION_WEIGHT = 0.5;
const FULL_ARENA_ACTION_WEIGHT = 1.0;
const INTENT_WEIGHT = 1.0;
const ABANDONMENT_WEIGHT = 1.0;

export const ABANDONMENT_WINDOW_DAYS = 7;
export const ABANDONMENT_THRESHOLD = 3;

/** Build an INSERT row for an intent (choice made, action not yet completed). */
export function buildIntentRow(opts: {
  userId: string;
  scenarioId: string;
  sourceMode: SourceMode;
  axis?: string;
}): PatternHistoryInsert {
  return {
    user_id: opts.userId,
    scenario_id: opts.scenarioId,
    pattern_type: "intent",
    source_mode: opts.sourceMode,
    axis: opts.axis ?? null,
    action_completed: false,
    air_eligible: false,
    weight: INTENT_WEIGHT,
  };
}

/** Build an INSERT row for a completed action. */
export function buildActionRow(opts: {
  userId: string;
  scenarioId: string;
  sourceMode: SourceMode;
  axis?: string;
}): PatternHistoryInsert {
  const weight = opts.sourceMode === "quick_mode" ? QUICK_MODE_ACTION_WEIGHT : FULL_ARENA_ACTION_WEIGHT;
  return {
    user_id: opts.userId,
    scenario_id: opts.scenarioId,
    pattern_type: "action",
    source_mode: opts.sourceMode,
    axis: opts.axis ?? null,
    action_completed: true,
    air_eligible: true,
    weight,
  };
}

/** Build an INSERT row for an abandonment signal (backend-only, never shown in UI). */
export function buildAbandonmentRow(opts: {
  userId: string;
  scenarioId: string;
  axis?: string;
}): PatternHistoryInsert {
  return {
    user_id: opts.userId,
    scenario_id: opts.scenarioId,
    pattern_type: "abandonment_signal",
    source_mode: "quick_mode",
    axis: opts.axis ?? null,
    action_completed: false,
    air_eligible: false,
    weight: ABANDONMENT_WEIGHT,
  };
}

/** Pure guard: is a row eligible for AIR computation? */
export function isAirEligible(patternType: PatternType, actionCompleted: boolean): boolean {
  return patternType === "action" && actionCompleted;
}

/** Compute intent-action gap for a set of rows within the last `days` days. */
export function computeIntentActionGap(rows: PatternHistoryRow[], days: number = 30): GapMetric {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const recent = rows.filter((r) => new Date(r.created_at) >= cutoff);

  const intent_total = recent.filter((r) => r.pattern_type === "intent").length;
  const action_completed = recent.filter((r) => r.pattern_type === "action" && r.action_completed).length;
  const abandonment_signals = recent.filter((r) => r.pattern_type === "abandonment_signal").length;

  return {
    intent_total,
    action_completed,
    abandonment_signals,
    completion_rate: action_completed / Math.max(intent_total, 1),
  };
}

/**
 * Returns true when the abandonment signal threshold is met:
 * >= threshold quick_mode intent rows WITHOUT a matching action in the window.
 */
export function shouldTriggerAbandonmentSignal(
  rows: PatternHistoryRow[],
  windowDays: number = ABANDONMENT_WINDOW_DAYS,
  threshold: number = ABANDONMENT_THRESHOLD
): boolean {
  const cutoff = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
  const recentIntents = rows.filter(
    (r) =>
      r.pattern_type === "intent" &&
      r.source_mode === "quick_mode" &&
      new Date(r.created_at) >= cutoff
  );
  if (recentIntents.length < threshold) return false;

  const recentActionScenarioIds = new Set(
    rows
      .filter((r) => r.pattern_type === "action" && r.action_completed && new Date(r.created_at) >= cutoff)
      .map((r) => r.scenario_id)
  );

  const unacted = recentIntents.filter((r) => !recentActionScenarioIds.has(r.scenario_id));
  return unacted.length >= threshold;
}
