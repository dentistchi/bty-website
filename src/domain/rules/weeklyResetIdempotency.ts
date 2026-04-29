/**
 * Weekly leaderboard boundary reset — idempotency (pure).
 *
 * Rule: Core XP is never modified by weekly resets. Rows are keyed by `week_id`
 * (e.g. Monday UTC). Running the reset job multiple times for the same
 * `activeWeekId` must converge: if storage already matches `activeWeekId`,
 * weekly XP totals must not be cleared again (noop).
 *
 * @see weeklyXp — season vs weekly windows; weeklyXp.ts for award/level rules.
 */

export type WeeklyBoundaryLedgerOutcome =
  | { kind: "noop_already_active_week"; weekId: string; xpTotal: number }
  | { kind: "advance_week_zero_xp"; weekId: string; xpTotal: 0 };

/**
 * Desired ledger state after applying weekly boundary reset for `activeWeekId`.
 * Idempotent: same `storedWeekId === activeWeekId` → noop, preserves `storedXpTotal`.
 */
export function ledgerStateAfterWeeklyBoundaryReset(input: {
  storedWeekId: string;
  activeWeekId: string;
  storedXpTotal: number;
}): WeeklyBoundaryLedgerOutcome {
  const xp = Math.max(0, Math.floor(input.storedXpTotal));
  if (input.storedWeekId === input.activeWeekId) {
    return {
      kind: "noop_already_active_week",
      weekId: input.storedWeekId,
      xpTotal: xp,
    };
  }
  return {
    kind: "advance_week_zero_xp",
    weekId: input.activeWeekId,
    xpTotal: 0,
  };
}

/** True when reset application would be a no-op (safe to skip DB write). */
export function isWeeklyBoundaryResetNoop(
  storedWeekId: string,
  activeWeekId: string
): boolean {
  return storedWeekId === activeWeekId;
}
