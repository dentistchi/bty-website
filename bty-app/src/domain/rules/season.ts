/**
 * Season lifecycle rules: window boundaries, carryover.
 * See docs/spec/arena-domain-rules.md.
 *
 * **Season boundary** = `SeasonWindow.startDate`–`endDate` (ISODate, inclusive). Independent of **weekly**
 * leaderboard windows (`week_id`); weekly rank reset must not be inferred from season dates alone.
 * Carryover at season rollover = `carryoverWeeklyXp` × `SEASON_CARRYOVER_FRACTION`. Season id = `SeasonWindow.id` (API/DB).
 * **Core XP:** 이 모듈은 Core XP를 읽거나 줄이지 않음. 시즌 전환·캐리오버는 주간 풀/표시 규칙용; 영구 Core 저장은 감소하지 않음 (Arena 불변식).
 * @see weeklyXp — weekly rank window (`week_id`) is separate; do not derive from season dates.
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
