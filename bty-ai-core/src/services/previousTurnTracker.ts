import { getPool } from "../config/database";

/**
 * Gets previous_was_question flag from user_sessions
 */
export async function getPreviousWasQuestion(userId: string): Promise<boolean> {
  const pool = getPool();
  if (!pool) return false;

  try {
    const result = await pool.query(
      `SELECT previous_was_question FROM user_sessions WHERE user_id = $1`,
      [userId]
    );
    return result.rows[0]?.previous_was_question ?? false;
  } catch (err) {
    console.error("[previousTurnTracker] Error getting previous_was_question:", err);
    return false;
  }
}

/**
 * Updates previous_was_question flag based on current response
 */
export async function updatePreviousWasQuestion(
  userId: string,
  responseHasQuestion: boolean
): Promise<void> {
  const pool = getPool();
  if (!pool) return;

  try {
    await pool.query(
      `INSERT INTO user_sessions (user_id, previous_was_question, last_updated)
       VALUES ($1, $2, now())
       ON CONFLICT (user_id)
       DO UPDATE SET
         previous_was_question = $2,
         last_updated = now()`,
      [userId, responseHasQuestion]
    );
  } catch (err) {
    console.error("[previousTurnTracker] Error updating previous_was_question:", err);
  }
}

/**
 * Checks if response contains a question
 */
export function responseHasQuestion(text: string): boolean {
  if (!text || text.trim().length === 0) return false;
  return /[?？]|까요|나요|인가요|을까요/.test(text);
}

/**
 * Gets previous_was_silence flag from user_sessions
 */
export async function getPreviousWasSilence(userId: string): Promise<boolean> {
  const pool = getPool();
  if (!pool) return false;

  try {
    const result = await pool.query(
      `SELECT previous_was_silence FROM user_sessions WHERE user_id = $1`,
      [userId]
    );
    return result.rows[0]?.previous_was_silence ?? false;
  } catch (err) {
    console.error("[previousTurnTracker] Error getting previous_was_silence:", err);
    return false;
  }
}

/**
 * Updates previous_was_silence flag based on current response
 */
export async function updatePreviousWasSilence(
  userId: string,
  wasSilence: boolean
): Promise<void> {
  const pool = getPool();
  if (!pool) return;

  try {
    await pool.query(
      `INSERT INTO user_sessions (user_id, previous_was_silence, last_updated)
       VALUES ($1, $2, now())
       ON CONFLICT (user_id)
       DO UPDATE SET
         previous_was_silence = $2,
         last_updated = now()`,
      [userId, wasSilence]
    );
  } catch (err) {
    console.error("[previousTurnTracker] Error updating previous_was_silence:", err);
  }
}
