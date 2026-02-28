/**
 * League leaderboard domain rules.
 * Ranking = Weekly XP only. Display = Code Name + Sub Name only (no real name).
 */

import { ELITE_MIN_COUNT, ELITE_TOP_FRACTION } from "../constants";
import type { EliteResult, LeaderboardEntry, SeasonId, UserId, WeeklyXp } from "../types";

/** Leaderboard ranking is based exclusively on Weekly XP. */
export const LEADERBOARD_RANK_BY_WEEKLY_XP_ONLY = true;

/** Season progression (e.g. Season 1/2/3) must NOT affect leaderboard rank. */
export const SEASON_PROGRESSION_DOES_NOT_AFFECT_RANK = true;

/** Leaderboard display: Code Name and Sub Name only. No real name exposure. */
export const LEADERBOARD_DISPLAY_CODE_NAME_ONLY = true;

/**
 * Sort leaderboard entries by Weekly XP descending (rank order).
 */
export function sortByWeeklyXpDesc(entries: LeaderboardEntry[]): LeaderboardEntry[] {
  return [...entries].sort((a, b) => b.weeklyXp - a.weeklyXp);
}

/**
 * Compute elite (top N% by Weekly XP). At least ELITE_MIN_COUNT if there are any entries.
 */
export function computeEliteTopFraction(
  seasonId: SeasonId,
  entries: LeaderboardEntry[]
): EliteResult {
  const sorted = sortByWeeklyXpDesc(entries);
  const n = sorted.length;
  const topN = Math.max(ELITE_MIN_COUNT, Math.ceil(n * ELITE_TOP_FRACTION));
  const eliteUserIds = sorted.slice(0, topN).map((e) => e.userId);
  return {
    seasonId,
    cutoffRank: topN,
    eliteUserIds,
  };
}
