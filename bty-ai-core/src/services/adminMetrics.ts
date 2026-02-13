/**
 * Admin-only aggregated metrics.
 * These metrics are NOT exposed in public API responses.
 * Accessible only through admin dashboard endpoints.
 */

import { getPool } from "../config/database";

export type AdminMetrics = {
  leadership_ownership_index: number; // 0-1: average ownership_level for leaders
  organizational_blame_ratio: number; // 0-1: ratio of blame patterns vs ownership patterns
  decision_alignment_trend: number; // -1 to 1: trend in integrity_alignment_score over time
  average_seri: number; // 0-5: average SERI composite index across all users
};

/**
 * Calculates leadership ownership index (average ownership_level for leaders).
 * Returns 0-1 scale (normalized from 0-5).
 */
export async function calculateLeadershipOwnershipIndex(
  timeRange?: { start: Date; end: Date }
): Promise<number> {
  const pool = getPool();
  if (!pool) return 0;

  try {
    let query = `
      SELECT COALESCE(AVG(CAST(ownership_level AS FLOAT)) / 5.0, 0) as index
      FROM maturity_scores
      WHERE role = 'leader'
    `;

    const params: any[] = [];
    if (timeRange) {
      query += ` AND timestamp >= $1 AND timestamp <= $2`;
      params.push(timeRange.start, timeRange.end);
    }

    const result = await pool.query<{ index: number }>(query, params);
    return result.rows[0]?.index ?? 0;
  } catch (err) {
    console.error("[adminMetrics] Error calculating ownership index:", err);
    return 0;
  }
}

/**
 * Calculates organizational blame ratio.
 * Returns 0-1: ratio of blame patterns vs ownership patterns across all users.
 */
export async function calculateOrganizationalBlameRatio(
  timeRange?: { start: Date; end: Date }
): Promise<number> {
  const pool = getPool();
  if (!pool) return 0;

  try {
    let timeFilter = "";
    const params: any[] = [];
    if (timeRange) {
      timeFilter = ` AND timestamp >= $1 AND timestamp <= $2`;
      params.push(timeRange.start, timeRange.end);
    }

    const query = `
      WITH counts AS (
        SELECT 
          COUNT(*) FILTER (WHERE ownership_level < 2) as blame_count,
          COUNT(*) FILTER (WHERE ownership_level >= 3) as ownership_count
        FROM maturity_scores
        WHERE 1=1 ${timeFilter}
      )
      SELECT 
        CASE 
          WHEN (blame_count + ownership_count) = 0 THEN 0
          ELSE CAST(blame_count AS FLOAT) / NULLIF(blame_count + ownership_count, 0)
        END as ratio
      FROM counts
    `;

    const result = await pool.query<{ ratio: number }>(query, params);
    return result.rows[0]?.ratio ?? 0;
  } catch (err) {
    console.error("[adminMetrics] Error calculating blame ratio:", err);
    return 0;
  }
}

/**
 * Calculates decision alignment trend.
 * Returns -1 to 1: trend direction of integrity_alignment_score over time.
 * Positive = improving, Negative = declining.
 */
export async function calculateDecisionAlignmentTrend(
  timeRange?: { start: Date; end: Date }
): Promise<number> {
  const pool = getPool();
  if (!pool) return 0;

  try {
    let timeFilter = "";
    const params: any[] = [];
    if (timeRange) {
      timeFilter = ` AND ms.timestamp >= $1 AND ms.timestamp <= $2`;
      params.push(timeRange.start, timeRange.end);
    }

    const query = `
      WITH leader_scores AS (
        SELECT 
          ms.integrity_alignment_score,
          ms.timestamp
        FROM maturity_scores ms
        JOIN organization_emotional_metrics oem ON ms.user_id = oem.user_id
        WHERE oem.role = 'leader'
          AND ms.integrity_alignment_score > 0
          ${timeFilter}
      ),
      time_buckets AS (
        SELECT 
          DATE_TRUNC('day', timestamp) as day,
          AVG(integrity_alignment_score) as avg_score
        FROM leader_scores
        GROUP BY DATE_TRUNC('day', timestamp)
        HAVING COUNT(*) > 0
        ORDER BY day
      ),
      trend_calc AS (
        SELECT 
          (SELECT avg_score FROM time_buckets ORDER BY day DESC LIMIT 1) as latest,
          (SELECT avg_score FROM time_buckets ORDER BY day ASC LIMIT 1) as earliest
      )
      SELECT 
        CASE 
          WHEN earliest IS NULL OR latest IS NULL THEN 0
          WHEN earliest = 0 THEN 0
          ELSE (latest - earliest) / 5.0
        END as trend
      FROM trend_calc
    `;

    const result = await pool.query<{ trend: number }>(query, params);
    return result.rows[0]?.trend ?? 0;
  } catch (err) {
    console.error("[adminMetrics] Error calculating alignment trend:", err);
    return 0;
  }
}

/**
 * Calculates average SERI index across all users.
 * Returns 0-5: average SERI composite score.
 */
export async function calculateAverageSERI(
  timeRange?: { start: Date; end: Date }
): Promise<number> {
  const pool = getPool();
  if (!pool) return 0;

  try {
    let query = `
      SELECT COALESCE(AVG(seri), 0) as avg_seri
      FROM maturity_scores
      WHERE 1=1
    `;

    const params: any[] = [];
    if (timeRange) {
      query += ` AND timestamp >= $1 AND timestamp <= $2`;
      params.push(timeRange.start, timeRange.end);
    }

    const result = await pool.query<{ avg_seri: number }>(query, params);
    return result.rows[0]?.avg_seri ?? 0;
  } catch (err) {
    console.error("[adminMetrics] Error calculating average SERI:", err);
    return 0;
  }
}

/**
 * Gets all admin metrics for dashboard.
 * Requires admin authentication (to be implemented in route).
 */
export async function getAdminMetrics(
  timeRange?: { start: Date; end: Date }
): Promise<AdminMetrics> {
  const [ownershipIndex, blameRatio, alignmentTrend, avgSERI] = await Promise.all([
    calculateLeadershipOwnershipIndex(timeRange),
    calculateOrganizationalBlameRatio(timeRange),
    calculateDecisionAlignmentTrend(timeRange),
    calculateAverageSERI(timeRange),
  ]);

  return {
    leadership_ownership_index: ownershipIndex,
    organizational_blame_ratio: blameRatio,
    decision_alignment_trend: alignmentTrend,
    average_seri: avgSERI,
  };
}
