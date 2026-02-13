import { getPool } from "../config/database";

/**
 * Gets current tone_drift value for user
 */
export async function getToneDrift(userId: string): Promise<number> {
  const pool = getPool();
  if (!pool) return 0;

  try {
    const result = await pool.query(
      `SELECT tone_drift FROM user_sessions WHERE user_id = $1`,
      [userId]
    );
    return result.rows[0]?.tone_drift ?? 0;
  } catch (err) {
    console.error("[toneTracking] Error getting tone_drift:", err);
    return 0;
  }
}

/**
 * Increments tone_drift by 1
 */
export async function incrementToneDrift(userId: string): Promise<number> {
  const pool = getPool();
  if (!pool) return 0;

  try {
    const currentDrift = await getToneDrift(userId);
    const newDrift = currentDrift + 1;

    await pool.query(
      `INSERT INTO user_sessions (user_id, tone_drift, last_updated)
       VALUES ($1, $2, now())
       ON CONFLICT (user_id)
       DO UPDATE SET
         tone_drift = $2,
         last_updated = now()`,
      [userId, newDrift]
    );

    return newDrift;
  } catch (err) {
    console.error("[toneTracking] Error incrementing tone_drift:", err);
    return 0;
  }
}

/**
 * Resets tone_drift to 0
 */
export async function resetToneDrift(userId: string): Promise<void> {
  const pool = getPool();
  if (!pool) return;

  try {
    await pool.query(
      `UPDATE user_sessions SET tone_drift = 0, last_updated = now() WHERE user_id = $1`,
      [userId]
    );
  } catch (err) {
    console.error("[toneTracking] Error resetting tone_drift:", err);
  }
}
