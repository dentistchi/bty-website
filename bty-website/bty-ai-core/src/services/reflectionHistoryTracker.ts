/**
 * Tracks last 5 used reflection templates per user.
 * Used by KeyPointReflectionLibrary to avoid repetition.
 */

import { getPool } from "../config/database";

const MAX_HISTORY = 5;

/**
 * Returns the last N used reflection strings (full sentence) for this user.
 */
export async function getLastUsedReflections(
  userId: string
): Promise<string[]> {
  const pool = getPool();
  if (!pool) return [];

  try {
    const result = await pool.query(
      `SELECT COALESCE(last_reflection_templates, '[]'::jsonb) as arr 
       FROM user_sessions WHERE user_id = $1`,
      [userId]
    );
    const arr = result.rows[0]?.arr;
    if (!Array.isArray(arr)) return [];
    return arr.slice(-MAX_HISTORY).filter((x): x is string => typeof x === "string");
  } catch (err) {
    console.error("[reflectionHistoryTracker] Error:", err);
    return [];
  }
}

/**
 * Appends a used reflection to history (keeps last 5 only).
 */
export async function recordReflectionUsed(
  userId: string,
  reflection: string
): Promise<void> {
  const pool = getPool();
  if (!pool || !reflection?.trim()) return;

  try {
    const trimmed = reflection.trim();
    const existing = await getLastUsedReflections(userId);
    const updated = [...existing, trimmed].slice(-MAX_HISTORY);
    await pool.query(
      `INSERT INTO user_sessions (user_id, last_reflection_templates, last_updated)
       VALUES ($1, $2::jsonb, now())
       ON CONFLICT (user_id)
       DO UPDATE SET
         last_reflection_templates = $2::jsonb,
         last_updated = now()`,
      [userId, JSON.stringify(updated)]
    );
  } catch (err) {
    console.error("[reflectionHistoryTracker] Error recording:", err);
  }
}
