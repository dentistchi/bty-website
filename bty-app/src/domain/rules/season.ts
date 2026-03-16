/**
 * Season lifecycle rules: window boundaries, carryover.
 * See docs/spec/arena-domain-rules.md.
 * 경계: SeasonWindow (types), carryover = constants.SEASON_CARRYOVER_FRACTION. 시즌 ID = SeasonWindow.id (API/DB 제공).
 */

import type { ISODateString } from "../types";
import type { SeasonWindow } from "../types";
import { SEASON_CARRYOVER_FRACTION } from "../constants";

/** Whether date (YYYY-MM-DD) is within the season window (inclusive). */
export function isDateWithinSeason(
  date: ISODateString,
  window: SeasonWindow
): boolean {
  return date >= window.startDate && date <= window.endDate;
}

/** Carryover amount: floor(weeklyXpTotal * SEASON_CARRYOVER_FRACTION). */
export function carryoverWeeklyXp(weeklyXpTotal: number): number {
  return Math.floor(weeklyXpTotal * SEASON_CARRYOVER_FRACTION);
}
