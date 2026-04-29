/**
 * Leaderboard week query param validation (current week only).
 * Used by GET /api/arena/leaderboard via lib parseLeaderboardQuery.
 * Pure: accepts currentMondayUtc so tests need no Date.
 */

export type ArenaLeaderboardWeekParamResult =
  | { ok: true }
  | { ok: false; error: "INVALID_WEEK"; message: string };

/**
 * Validates week param. Omit/empty/current → valid. Else YYYY-MM-DD must be Monday UTC and equal to currentMondayUtc.
 */
export function arenaLeaderboardWeekParamValid(
  weekParam: string | null | undefined,
  currentMondayUtc: string,
): ArenaLeaderboardWeekParamResult {
  const w = weekParam == null ? "" : String(weekParam).trim();
  if (w === "" || w === "current") return { ok: true };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(w)) {
    return {
      ok: false,
      error: "INVALID_WEEK",
      message: "week must be current or YYYY-MM-DD (Monday UTC)",
    };
  }
  const d = new Date(`${w}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime()) || d.getUTCDay() !== 1) {
    return {
      ok: false,
      error: "INVALID_WEEK",
      message: "week must be a Monday UTC",
    };
  }
  if (w !== currentMondayUtc) {
    return {
      ok: false,
      error: "INVALID_WEEK",
      message: "only the current leaderboard week is supported",
    };
  }
  return { ok: true };
}
