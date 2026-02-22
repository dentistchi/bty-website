import type { EliteResult, LeaderboardEntry, SeasonId, SeasonWindow, ISODateString } from "./types";

/**
 * Compare ISO dates (YYYY-MM-DD) lexicographically is safe.
 */
export function isDateWithin(date: ISODateString, win: SeasonWindow): boolean {
  return date >= win.startDate && date <= win.endDate;
}

/**
 * Compute top 5% elite list from leaderboard entries.
 * - If fewer than 20 users, we still pick at least 1.
 */
export function computeEliteTop5Percent(seasonId: SeasonId, entries: LeaderboardEntry[]): EliteResult {
  const sorted = [...entries].sort((a, b) => b.leagueXp - a.leagueXp);
  const n = sorted.length;
  const topN = Math.max(1, Math.ceil(n * 0.05));
  const eliteUserIds = sorted.slice(0, topN).map((e) => e.userId);
  return {
    seasonId,
    cutoffRank: topN,
    eliteUserIds,
  };
}
