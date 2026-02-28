/**
 * Emotional stats formula — pure functions only.
 * Q = session quality (0..1), Δ = stat delta, clamp per session.
 * Single source: docs/specs/healing-coaching-spec-v3.json gain_algorithm.
 */

import {
  type EmotionalEventId,
  getQualityWeight,
  getSessionMaxPossibleWeight,
  SESSION_MAX_POSSIBLE_EVENTS_CAP,
  type CoreStatId,
  STAT_DISTRIBUTION,
} from "./coreStats";
import { getPhaseMultiplier, getConsistencyCap } from "./phase";

/** Base gain per spec. */
export const BASE_GAIN = 0.8;

/** Max gain per stat per session. */
export const MAX_GAIN_PER_STAT_PER_SESSION = 1.5;

/**
 * Session quality Q: sum(event weights) / max_possible, capped by event count.
 * Q in [0, 1].
 */
export function computeSessionQualityQ(eventIdsInSession: EmotionalEventId[]): number {
  const capped = eventIdsInSession.slice(0, SESSION_MAX_POSSIBLE_EVENTS_CAP);
  const sum = capped.reduce((s, id) => s + getQualityWeight(id), 0);
  const maxPossible = getSessionMaxPossibleWeight();
  if (maxPossible <= 0) return 0;
  return Math.min(1, sum / maxPossible);
}

/**
 * Delta for one stat: base_gain * Q * novelty * consistency [* phase_multiplier].
 * Clamp per stat per session by clampDelta.
 * When userDay is provided, consistency is capped by phase (v3 consistency_cap) and result is multiplied by phase multiplier.
 */
export function computeStatDelta(
  Q: number,
  novelty: number,
  consistency: number,
  baseGain: number = BASE_GAIN,
  userDay?: number
): number {
  const nov = Math.max(0.2, Math.min(1, novelty));
  const cons =
    userDay !== undefined
      ? Math.max(1, Math.min(getConsistencyCap(userDay), consistency))
      : Math.max(1, Math.min(1.4, consistency));
  const phaseMult = userDay !== undefined ? getPhaseMultiplier(userDay) : 1;
  return baseGain * Q * nov * cons * phaseMult;
}

/**
 * Clamp delta so that per-stat-per-session gain does not exceed max.
 */
export function clampDelta(
  delta: number,
  maxPerSession: number = MAX_GAIN_PER_STAT_PER_SESSION
): number {
  if (maxPerSession <= 0) return 0;
  return Math.max(0, Math.min(maxPerSession, delta));
}

/**
 * For a session with given events, compute the gain to apply to each core stat.
 * Returns record of stat_id -> clamped delta (distributed by STAT_DISTRIBUTION).
 * When userDay is provided, v3 30-day acceleration and phase_tuning are applied.
 */
export function computeSessionGains(
  eventIdsInSession: EmotionalEventId[],
  novelty: number,
  consistency: number,
  userDay?: number
): Record<CoreStatId, number> {
  const Q = computeSessionQualityQ(eventIdsInSession);
  const rawDelta = computeStatDelta(Q, novelty, consistency, BASE_GAIN, userDay);
  const clamped = clampDelta(rawDelta);

  const gains: Record<CoreStatId, number> = {
    EA: 0,
    RS: 0,
    BS: 0,
    TI: 0,
    RC: 0,
    RD: 0,
  };

  const capped = eventIdsInSession.slice(0, SESSION_MAX_POSSIBLE_EVENTS_CAP);
  const perEventGain = capped.length > 0 ? clamped / capped.length : 0;

  for (const eventId of capped) {
    const weights = STAT_DISTRIBUTION[eventId];
    if (!weights) continue;
    for (const [stat, w] of Object.entries(weights)) {
      const k = stat as CoreStatId;
      if (gains[k] !== undefined && typeof w === "number") {
        gains[k] += perEventGain * w;
      }
    }
  }

  // Clamp each stat's total gain to max per session
  for (const k of Object.keys(gains) as CoreStatId[]) {
    gains[k] = clampDelta(gains[k]);
  }

  return gains;
}
