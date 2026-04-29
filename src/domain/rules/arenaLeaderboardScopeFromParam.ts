/**
 * Leaderboard scope from query param (overall|role|office).
 * Used by GET /api/arena/leaderboard via lib parseLeaderboardQuery; weekly/season unrelated.
 */

export const ARENA_LEADERBOARD_SCOPE_VALUES = ["overall", "role", "office"] as const;
export type ArenaLeaderboardScopeParam =
  (typeof ARENA_LEADERBOARD_SCOPE_VALUES)[number] | null;

/**
 * Returns valid scope for param, or null if invalid.
 * Null/undefined/empty/whitespace → "overall". Valid trimmed values → scope; else null.
 */
export function arenaLeaderboardScopeFromParam(
  param: string | null | undefined,
): ArenaLeaderboardScopeParam {
  if (param == null || typeof param !== "string") return "overall";
  const s = param.trim();
  if (s === "") return "overall";
  if (s === "overall" || s === "role" || s === "office") return s;
  return null;
}
