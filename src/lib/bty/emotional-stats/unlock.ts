/**
 * Advanced stats unlock conditions — pure functions.
 * DB stores short names (PRM, SAG, EL, CNS, CD, IS); conditions use core stat + event counts.
 */

import type { AdvancedStatId, CoreStatId } from "./coreStats";
import { CORE_STAT_IDS } from "./coreStats";

export type UserCoreValues = Partial<Record<CoreStatId, number>>;

export interface EventCounts {
  [eventId: string]: number;
}

/** Short advanced stat IDs used in DB (user_advanced_unlocks.advanced_stat_name). */
const ADVANCED_SHORT_IDS = ["PRM", "SAG", "EL", "CNS", "CD", "IS"] as const;
type AdvancedShortId = (typeof ADVANCED_SHORT_IDS)[number];

/** Unlock condition from v3 (core minimums + event/counter minimums). */
const ADVANCED_UNLOCK_CONDITIONS: Record<
  AdvancedShortId,
  { coreMins: Partial<Record<CoreStatId, number>>; eventCounts: Record<string, number> }
> = {
  PRM: { coreMins: { TI: 50 }, eventCounts: { PATTERN_LINKED: 5 } },
  SAG: { coreMins: { BS: 40, RC: 40 }, eventCounts: { CLEAR_REQUEST: 3 } },
  EL: { coreMins: { RD: 60 }, eventCounts: { O_F_N_R_COMPLETED: 10 } },
  CNS: { eventCounts: { REPAIR_ATTEMPT: 5, POST_CONFLICT_RETURN: 3 }, coreMins: {} },
  CD: { coreMins: { EA: 70 }, eventCounts: { SELF_REFRAMING: 5 } },
  IS: { coreMins: { RS: 70 }, eventCounts: { INTENSITY_REDUCTION: 3 } },
};

/**
 * Returns true if the user meets the unlock conditions for the given advanced stat (short id).
 * Pure function: no DB/API.
 */
export function checkAdvancedUnlock(
  advancedShortId: AdvancedShortId,
  userCoreValues: UserCoreValues,
  eventCounts: EventCounts
): boolean {
  const cond = ADVANCED_UNLOCK_CONDITIONS[advancedShortId];
  if (!cond) return false;

  for (const [stat, min] of Object.entries(cond.coreMins)) {
    const v = userCoreValues[stat as CoreStatId];
    if (v === undefined || v < (min as number)) return false;
  }

  for (const [eventId, required] of Object.entries(cond.eventCounts)) {
    const count = eventCounts[eventId] ?? 0;
    if (count < required) return false;
  }

  return true;
}

/**
 * Returns all advanced stat short IDs (for DB) that are currently unlocked for the user.
 */
export function getUnlockedAdvancedStats(
  userCoreValues: UserCoreValues,
  eventCounts: EventCounts
): AdvancedShortId[] {
  return ADVANCED_SHORT_IDS.filter((id) =>
    checkAdvancedUnlock(id, userCoreValues, eventCounts)
  );
}
