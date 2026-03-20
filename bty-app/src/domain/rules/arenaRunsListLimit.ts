/**
 * GET /api/arena/runs list limit bounds (pagination only — weekly/season unrelated).
 */

export const ARENA_RUNS_LIST_LIMIT_MIN = 1;
export const ARENA_RUNS_LIST_LIMIT_MAX = 50;
export const ARENA_RUNS_LIST_LIMIT_DEFAULT = 10;

/**
 * Clamps numeric limit to [min, max]; NaN/invalid → default.
 */
export function clampArenaRunsListLimit(value: number): number {
  const n = Number(value);
  if (Number.isNaN(n) || n < ARENA_RUNS_LIST_LIMIT_MIN) {
    return ARENA_RUNS_LIST_LIMIT_DEFAULT;
  }
  return Math.min(Math.floor(n), ARENA_RUNS_LIST_LIMIT_MAX);
}
