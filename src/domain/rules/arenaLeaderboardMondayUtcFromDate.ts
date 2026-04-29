/**
 * Monday 00:00 UTC as YYYY-MM-DD for the week containing the given instant.
 * Leaderboard `week` query uses this anchor vs `arenaLeaderboardWeekParamValid`.
 */

export function arenaLeaderboardMondayUtcFromDate(d: Date): string {
  const day = d.getUTCDay();
  const off = day === 0 ? -6 : 1 - day;
  const m = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + off));
  const y = m.getUTCFullYear();
  const mo = String(m.getUTCMonth() + 1).padStart(2, "0");
  const da = String(m.getUTCDate()).padStart(2, "0");
  return `${y}-${mo}-${da}`;
}
