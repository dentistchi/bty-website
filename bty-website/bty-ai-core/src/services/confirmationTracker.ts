/**
 * Tracks confirmation usage per user session.
 * Used by ConfirmationControl to enforce lastConfirmationWithin3Turns and confirmationCountInSession limits.
 */

import { getPool } from "../config/database";

/**
 * Returns { lastConfirmationWithin3Turns, confirmationCountInSession }
 */
export async function getConfirmationState(userId: string): Promise<{
  lastConfirmationWithin3Turns: boolean;
  confirmationCountInSession: number;
}> {
  const pool = getPool();
  if (!pool) {
    return { lastConfirmationWithin3Turns: false, confirmationCountInSession: 0 };
  }

  try {
    const result = await pool.query(
      `SELECT 
        COALESCE(confirmation_count_in_session, 0) as confirmation_count_in_session,
        COALESCE(turns_since_last_confirmation, 999) as turns_since_last_confirmation
       FROM user_sessions WHERE user_id = $1`,
      [userId]
    );
    const row = result.rows[0];
    const count = row?.confirmation_count_in_session ?? 0;
    const turnsSince = row?.turns_since_last_confirmation ?? 999;
    return {
      lastConfirmationWithin3Turns: turnsSince <= 3,
      confirmationCountInSession: count,
    };
  } catch (err) {
    console.error("[confirmationTracker] Error:", err);
    return { lastConfirmationWithin3Turns: false, confirmationCountInSession: 0 };
  }
}

/**
 * Call after sending a confirmation phrase.
 * Increments confirmation_count_in_session and resets turns_since_last_confirmation to 0.
 */
export async function recordConfirmationUsed(userId: string): Promise<void> {
  const pool = getPool();
  if (!pool) return;

  try {
    await pool.query(
      `INSERT INTO user_sessions (user_id, confirmation_count_in_session, turns_since_last_confirmation, last_updated)
       VALUES ($1, 1, 0, now())
       ON CONFLICT (user_id)
       DO UPDATE SET
         confirmation_count_in_session = COALESCE(user_sessions.confirmation_count_in_session, 0) + 1,
         turns_since_last_confirmation = 0,
         last_updated = now()`,
      [userId]
    );
  } catch (err) {
    console.error("[confirmationTracker] Error recording confirmation:", err);
  }
}

/**
 * Call every turn (when NOT using confirmation).
 * Increments turns_since_last_confirmation.
 */
export async function incrementTurnsSinceConfirmation(
  userId: string
): Promise<void> {
  const pool = getPool();
  if (!pool) return;

  try {
    await pool.query(
      `INSERT INTO user_sessions (user_id, turns_since_last_confirmation, last_updated)
       VALUES ($1, 1, now())
       ON CONFLICT (user_id)
       DO UPDATE SET
         turns_since_last_confirmation = COALESCE(user_sessions.turns_since_last_confirmation, 999) + 1,
         last_updated = now()`,
      [userId]
    );
  } catch (err) {
    console.error("[confirmationTracker] Error incrementing turns:", err);
  }
}
