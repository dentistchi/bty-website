/**
 * Emotional stats domain constants (Core Stats, Events, Advanced Stats).
 * Single source of truth for SYSTEM_UPGRADE_PLAN_EMOTIONAL_STATS / HEALING_COACHING_SPEC_V3.
 * Arena XP · Weekly XP · leaderboard are separate; this system is for internal growth tracking only.
 */

// --- Event IDs (v3: 14 events) ---
export const EVENT_IDS = [
  "OBSERVATION_FACTUAL",
  "FEELING_LABELED",
  "FALSE_TO_TRUE_CONVERSION",
  "NEED_IDENTIFIED",
  "CLEAR_REQUEST",
  "BOUNDARY_ASSERTION",
  "REGULATION_ATTEMPT",
  "INTENSITY_REDUCTION",
  "PATTERN_LINKED",
  "PAST_MEMORY_REFERENCED",
  "O_F_N_R_COMPLETED",
  "REPAIR_ATTEMPT",
  "POST_CONFLICT_RETURN",
  "SELF_REFRAMING",
] as const;

export type EventId = (typeof EVENT_IDS)[number];
/** Alias for event IDs used in emotional event detection/formula. */
export type EmotionalEventId = EventId;

// --- Core stat IDs (6 types) ---
export const CORE_STAT_IDS = ["EA", "RS", "BS", "TI", "RC", "RD"] as const;

export type CoreStatId = (typeof CORE_STAT_IDS)[number];

export interface CoreStatDef {
  id: CoreStatId;
  name: string;
  source_events: readonly EventId[];
}

/**
 * Core stats definition: id, name, and which events contribute to this stat.
 */
export const CORE_STATS: readonly CoreStatDef[] = [
  { id: "EA", name: "Emotional Awareness", source_events: ["FEELING_LABELED", "FALSE_TO_TRUE_CONVERSION", "OBSERVATION_FACTUAL", "NEED_IDENTIFIED", "PATTERN_LINKED", "PAST_MEMORY_REFERENCED", "SELF_REFRAMING"] },
  { id: "RS", name: "Regulation Stability", source_events: ["REGULATION_ATTEMPT", "INTENSITY_REDUCTION", "FEELING_LABELED", "BOUNDARY_ASSERTION", "POST_CONFLICT_RETURN", "SELF_REFRAMING"] },
  { id: "BS", name: "Boundary Strength", source_events: ["CLEAR_REQUEST", "BOUNDARY_ASSERTION", "OBSERVATION_FACTUAL", "NEED_IDENTIFIED", "O_F_N_R_COMPLETED", "REPAIR_ATTEMPT"] },
  { id: "TI", name: "Trigger Insight", source_events: ["PATTERN_LINKED", "PAST_MEMORY_REFERENCED", "OBSERVATION_FACTUAL"] },
  { id: "RC", name: "Relational Clarity", source_events: ["O_F_N_R_COMPLETED", "OBSERVATION_FACTUAL", "FALSE_TO_TRUE_CONVERSION", "NEED_IDENTIFIED", "CLEAR_REQUEST", "REPAIR_ATTEMPT"] },
  { id: "RD", name: "Resilience Depth", source_events: ["REPAIR_ATTEMPT", "POST_CONFLICT_RETURN", "REGULATION_ATTEMPT", "INTENSITY_REDUCTION", "PAST_MEMORY_REFERENCED"] },
] as const;

// --- Events with quality_weight (for Q calculation) ---
export interface EventDef {
  id: EventId;
  quality_weight: number;
}

export const EVENTS: readonly EventDef[] = [
  { id: "OBSERVATION_FACTUAL", quality_weight: 1.0 },
  { id: "FEELING_LABELED", quality_weight: 1.0 },
  { id: "FALSE_TO_TRUE_CONVERSION", quality_weight: 1.5 },
  { id: "NEED_IDENTIFIED", quality_weight: 1.2 },
  { id: "CLEAR_REQUEST", quality_weight: 1.3 },
  { id: "BOUNDARY_ASSERTION", quality_weight: 1.6 },
  { id: "REGULATION_ATTEMPT", quality_weight: 1.2 },
  { id: "INTENSITY_REDUCTION", quality_weight: 1.5 },
  { id: "PATTERN_LINKED", quality_weight: 1.7 },
  { id: "PAST_MEMORY_REFERENCED", quality_weight: 1.2 },
  { id: "O_F_N_R_COMPLETED", quality_weight: 2.0 },
  { id: "REPAIR_ATTEMPT", quality_weight: 1.8 },
  { id: "POST_CONFLICT_RETURN", quality_weight: 2.2 },
  { id: "SELF_REFRAMING", quality_weight: 1.4 },
] as const;

// --- Map event_id -> quality_weight (for formula.ts) ---
export const EVENT_QUALITY_WEIGHT: Readonly<Record<EventId, number>> = Object.fromEntries(
  EVENTS.map((e) => [e.id, e.quality_weight])
) as Readonly<Record<EventId, number>>;

/** Session cap for Q denominator (v3 session_max_possible_events_cap). */
export const SESSION_MAX_POSSIBLE_EVENTS_CAP = 8;

export function getQualityWeight(id: EventId): number {
  return EVENT_QUALITY_WEIGHT[id] ?? 0;
}

/** Max possible weight for one session (top SESSION_MAX_POSSIBLE_EVENTS_CAP events by weight). */
export function getSessionMaxPossibleWeight(): number {
  const sorted = [...EVENTS].sort((a, b) => b.quality_weight - a.quality_weight);
  return sorted
    .slice(0, SESSION_MAX_POSSIBLE_EVENTS_CAP)
    .reduce((s, e) => s + e.quality_weight, 0);
}

/** v3 stat_distribution: event -> { CoreStatId: weight }. SELF_REFRAMING: CD mapped to EA+RS for Core-only. */
export const STAT_DISTRIBUTION: Readonly<Record<EventId, Partial<Record<CoreStatId, number>>>> = {
  OBSERVATION_FACTUAL: { RC: 0.6, EA: 0.2, BS: 0.2 },
  FEELING_LABELED: { EA: 0.8, RS: 0.2 },
  FALSE_TO_TRUE_CONVERSION: { EA: 0.7, RC: 0.3 },
  NEED_IDENTIFIED: { RC: 0.5, EA: 0.2, BS: 0.3 },
  CLEAR_REQUEST: { BS: 0.6, RC: 0.4 },
  BOUNDARY_ASSERTION: { BS: 0.8, RS: 0.2 },
  REGULATION_ATTEMPT: { RS: 0.8, RD: 0.2 },
  INTENSITY_REDUCTION: { RS: 0.7, RD: 0.3 },
  PATTERN_LINKED: { TI: 0.8, EA: 0.2 },
  PAST_MEMORY_REFERENCED: { TI: 0.6, EA: 0.2, RD: 0.2 },
  O_F_N_R_COMPLETED: { RC: 0.7, BS: 0.2, EA: 0.1 },
  REPAIR_ATTEMPT: { RD: 0.7, RC: 0.2, BS: 0.1 },
  POST_CONFLICT_RETURN: { RD: 0.8, RS: 0.2 },
  SELF_REFRAMING: { EA: 0.8, RS: 0.2 }, // v3 CD -> Core: EA+RS
};

// --- Map event_id -> core_stat_ids that receive this event (source_events reverse mapping) ---
export const SOURCE_EVENTS_TO_CORE_STATS: Readonly<Record<EventId, readonly CoreStatId[]>> = (() => {
  const map: Partial<Record<EventId, CoreStatId[]>> = {};
  for (const e of EVENT_IDS) {
    map[e] = [];
  }
  for (const stat of CORE_STATS) {
    for (const ev of stat.source_events) {
      if (map[ev]) map[ev]!.push(stat.id);
    }
  }
  return map as Readonly<Record<EventId, readonly CoreStatId[]>>;
})();

// --- Advanced stats (unlock conditions; evaluation in unlock.ts) ---
export const ADVANCED_STAT_IDS = [
  "PATTERN_RECOGNITION_MASTERY",
  "SECURE_ATTACHMENT_GROWTH",
  "EMOTIONAL_LEADERSHIP",
  "CONFLICT_NAVIGATION_SKILL",
  "COMPASSION_DEPTH",
  "IDENTITY_STABILITY",
] as const;

export type AdvancedStatId = (typeof ADVANCED_STAT_IDS)[number];

export interface AdvancedUnlockCondition {
  core_stat_id?: CoreStatId;
  min_value?: number;
  event_id?: EventId;
  event_min_count?: number;
  /** Optional custom counter key (e.g. CLEAR_REQUEST_success, self_reframing_count) */
  counter_key?: string;
  counter_min?: number;
}

export interface AdvancedStatDef {
  id: AdvancedStatId;
  name: string;
  conditions: readonly AdvancedUnlockCondition[];
}

/**
 * Advanced stats — unlock when all conditions are met.
 * Conditions reference core stat values and/or event counts (v3 advanced_unlock_conditions).
 */
export const ADVANCED_STATS: readonly AdvancedStatDef[] = [
  {
    id: "PATTERN_RECOGNITION_MASTERY",
    name: "Pattern Recognition Mastery",
    conditions: [
      { core_stat_id: "TI", min_value: 50 },
      { event_id: "PATTERN_LINKED", event_min_count: 5 },
    ],
  },
  {
    id: "SECURE_ATTACHMENT_GROWTH",
    name: "Secure Attachment Growth",
    conditions: [
      { core_stat_id: "BS", min_value: 40 },
      { core_stat_id: "RC", min_value: 40 },
      { counter_key: "CLEAR_REQUEST_success", counter_min: 3 },
    ],
  },
  {
    id: "EMOTIONAL_LEADERSHIP",
    name: "Emotional Leadership",
    conditions: [
      { core_stat_id: "RD", min_value: 60 },
      { event_id: "O_F_N_R_COMPLETED", event_min_count: 10 },
    ],
  },
  {
    id: "CONFLICT_NAVIGATION_SKILL",
    name: "Conflict Navigation Skill",
    conditions: [
      { event_id: "REPAIR_ATTEMPT", event_min_count: 5 },
      { event_id: "POST_CONFLICT_RETURN", event_min_count: 3 },
    ],
  },
  {
    id: "COMPASSION_DEPTH",
    name: "Compassion Depth",
    conditions: [
      { core_stat_id: "EA", min_value: 70 },
      { counter_key: "self_reframing_count", counter_min: 5 },
    ],
  },
  {
    id: "IDENTITY_STABILITY",
    name: "Identity Stability",
    conditions: [
      { core_stat_id: "RS", min_value: 70 },
      { event_id: "INTENSITY_REDUCTION", event_min_count: 3 },
    ],
  },
] as const;
