/**
 * Weekly XP tie-break rule for leaderboard. Single source of truth.
 * Rule: 1) weekly XP descending, 2) updated_at ascending (earlier first), 3) user_id ascending.
 * Season/Core XP must not affect order. Used by lib/bty/arena/leaderboardTieBreak and API ordering.
 */

export const LEADERBOARD_TIE_BREAK_ORDER =
  "xp_total desc, updated_at asc, user_id asc" as const;

export interface WeeklyXpRowForTieBreak {
  weeklyXp: number;
  updatedAt: string | null;
  userId: string;
}

/**
 * Compare two weekly XP rows for deterministic leaderboard order.
 * Returns negative if a should rank before b, positive if after, 0 if equal.
 * Rule: weeklyXp desc, then updatedAt asc (earlier first), then userId asc.
 */
export function compareWeeklyXpTieBreak(
  a: WeeklyXpRowForTieBreak,
  b: WeeklyXpRowForTieBreak
): number {
  if (b.weeklyXp !== a.weeklyXp) return b.weeklyXp - a.weeklyXp;

  const upA = a.updatedAt ?? "";
  const upB = b.updatedAt ?? "";
  const cmpTime = upA.localeCompare(upB);
  if (cmpTime !== 0) return cmpTime;

  return (a.userId ?? "").localeCompare(b.userId ?? "");
}
