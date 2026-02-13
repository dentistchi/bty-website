import { getPool } from "../config/database";

export type InsertEmotionalMetricRow = {
  user_id: string;
  role: string;
  detected_emotion: string;
  maturity_risk_level: string;
  response_stability?: number; // +1 if <=3 sentences, -2 if >=5 sentences, 0 otherwise
};

/**
 * Saves one emotional metrics row (metadata only, no conversation).
 * No-op if DATABASE_URL is not set. Errors are logged but not thrown.
 */
export async function insertEmotionalMetric(
  row: InsertEmotionalMetricRow
): Promise<void> {
  const pool = getPool();
  if (!pool) return;

  try {
    await pool.query(
      `INSERT INTO organization_emotional_metrics (user_id, role, detected_emotion, maturity_risk_level, response_stability)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        row.user_id,
        row.role,
        row.detected_emotion,
        row.maturity_risk_level,
        row.response_stability ?? 0,
      ]
    );
  } catch (err) {
    console.error("[organization_emotional_metrics] insert failed:", err);
  }
}
