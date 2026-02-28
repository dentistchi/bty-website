/**
 * Season lifecycle rules: start, end, reset.
 * Pure logic only; no I/O.
 */

import { SEASON_CARRYOVER_FRACTION } from "../constants";
import type { ISODateString, SeasonWindow } from "../types";

/** Season progression must NOT affect leaderboard ranking. */
export const SEASON_PROGRESSION_INDEPENDENT_OF_LEADERBOARD = true;

/**
 * Whether a date falls within a season window (inclusive).
 */
export function isDateWithinSeason(date: ISODateString, window: SeasonWindow): boolean {
  return date >= window.startDate && date <= window.endDate;
}

/**
 * Weekly XP after season reset: only carryover fraction remains.
 * New total = floor(currentWeeklyXp * carryoverFraction).
 */
export function weeklyXpAfterReset(currentWeeklyXp: number): number {
  return Math.floor(currentWeeklyXp * SEASON_CARRYOVER_FRACTION);
}

/** Core XP is unchanged by season reset. */
export const CORE_XP_UNAFFECTED_BY_SEASON_RESET = true;
