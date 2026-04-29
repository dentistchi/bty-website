/**
 * GET /api/arena/runs cursor max length (opaque URL-safe string).
 * Pagination only — weekly/season unrelated.
 */

export const ARENA_RUNS_CURSOR_MAX_LENGTH = 512;

export function isArenaRunsCursorOverMax(cursor: string): boolean {
  return cursor.length > ARENA_RUNS_CURSOR_MAX_LENGTH;
}
