/**
 * Organization-level emotional analytics for leadership dashboard.
 * Reads from organization_emotional_metrics (metadata only).
 */

import { getPool } from "../config/database";

export type TimeRange = {
  start: Date;
  end: Date;
};

export type OrganizationEmotionalSnapshot = {
  dominant_emotion: string;
  high_risk_ratio: number;
  medium_risk_ratio: number;
  low_risk_ratio: number;
  emotional_volatility_index: number;
};

/**
 * Returns an emotional snapshot for the organization over the given time range.
 * Ratios and emotional_volatility_index are 0–1 (multiply by 100 for percentage).
 * emotional_volatility_index = percentage of high-risk interactions over total interactions.
 */
export async function getOrganizationEmotionalSnapshot(
  timeRange: TimeRange
): Promise<OrganizationEmotionalSnapshot> {
  const pool = getPool();
  const empty: OrganizationEmotionalSnapshot = {
    dominant_emotion: "",
    high_risk_ratio: 0,
    medium_risk_ratio: 0,
    low_risk_ratio: 0,
    emotional_volatility_index: 0,
  };

  if (!pool) return empty;

  try {
    const { start, end } = timeRange;
    const rows = await pool.query<{
      detected_emotion: string;
      maturity_risk_level: string;
    }>(
      `SELECT detected_emotion, maturity_risk_level
       FROM organization_emotional_metrics
       WHERE timestamp >= $1 AND timestamp <= $2`,
      [start, end]
    );

    const total = rows.rowCount ?? 0;
    if (total === 0) return empty;

    const emotionCounts: Record<string, number> = {};
    let high = 0,
      medium = 0,
      low = 0;

    for (const row of rows.rows) {
      emotionCounts[row.detected_emotion] =
        (emotionCounts[row.detected_emotion] ?? 0) + 1;
      const level = (row.maturity_risk_level || "").toLowerCase();
      if (level === "high") high++;
      else if (level === "medium") medium++;
      else if (level === "low") low++;
    }

    const dominant_emotion =
      Object.entries(emotionCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";

    return {
      dominant_emotion,
      high_risk_ratio: high / total,
      medium_risk_ratio: medium / total,
      low_risk_ratio: low / total,
      emotional_volatility_index: high / total,
    };
  } catch (err) {
    console.error("[orgAnalytics] getOrganizationEmotionalSnapshot failed:", err);
    return empty;
  }
}
