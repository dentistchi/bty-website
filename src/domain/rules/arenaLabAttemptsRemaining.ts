/**
 * Lab attempts remaining (display only — weekly/season unrelated).
 * Used by GET /api/arena/lab/usage and lab/complete.
 */

/**
 * Returns remaining attempts; used/limit clamped to non-negative.
 */
export function arenaLabAttemptsRemaining(
  attemptsUsed: number,
  dailyLimit: number,
): number {
  const used = Math.max(0, Number.isFinite(attemptsUsed) ? attemptsUsed : 0);
  const limit = Math.max(0, Number.isFinite(dailyLimit) ? dailyLimit : 0);
  return Math.max(0, limit - used);
}
