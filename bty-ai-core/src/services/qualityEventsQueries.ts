/**
 * Quality events aggregation queries.
 * Run migration 015_quality_events_aggregation.sql first.
 */

import { getDbClient } from "../config/db";

export type TopIssuePatternRow = {
  issues_signature: string;
  count: string;
  high_severity_count: string;
  avg_css: string | null;
  top_roles: string | null;
  top_intents: string | null;
  top_routes: string | null;
};

export type IssueCodeFrequencyRow = {
  issue_code: string;
  count: string;
};

export type SeverityDistributionRow = {
  severity: string;
  count: string;
};

export type DailyTrendRow = {
  day: string;
  issues_signature: string;
  count: string;
  rank_in_day: number;
};

/**
 * 1) Top 10 issue patterns (7d or 30d window).
 */
export async function getTopIssuePatterns(
  daysBack: number = 7
): Promise<TopIssuePatternRow[]> {
  const pool = getDbClient();
  if (!pool) return [];
  const r = await pool.query<TopIssuePatternRow>(
    "SELECT * FROM bty_top_issue_patterns($1)",
    [daysBack]
  );
  return r.rows;
}

/**
 * 2) Issue code frequency (unnest single issues).
 */
export async function getIssueCodeFrequency(
  daysBack: number = 7
): Promise<IssueCodeFrequencyRow[]> {
  const pool = getDbClient();
  if (!pool) return [];
  const r = await pool.query<IssueCodeFrequencyRow>(
    "SELECT * FROM bty_issue_code_frequency($1)",
    [daysBack]
  );
  return r.rows;
}

/**
 * 3) Severity distribution.
 */
export async function getSeverityDistribution(
  daysBack: number = 7
): Promise<SeverityDistributionRow[]> {
  const pool = getDbClient();
  if (!pool) return [];
  const r = await pool.query<SeverityDistributionRow>(
    "SELECT * FROM bty_severity_distribution($1)",
    [daysBack]
  );
  return r.rows;
}

/**
 * 4) Daily trend for top 5 signatures (last 14 days).
 */
export async function getDailyTrendTopSignatures(
  daysBack: number = 14,
  topN: number = 5
): Promise<DailyTrendRow[]> {
  const pool = getDbClient();
  if (!pool) return [];
  const r = await pool.query<DailyTrendRow>(
    "SELECT * FROM bty_daily_trend_top_signatures($1, $2)",
    [daysBack, topN]
  );
  return r.rows;
}

export type IssueFrequencyWithSeverityRow = {
  issue_code: string;
  count: string;
  high_count: string;
};

export type SummaryStatsRow = {
  total_events: string;
  avg_css: string | null;
  severity_low: string;
  severity_medium: string;
  severity_high: string;
};

export type BreakdownRow = {
  dimension: string;
  value: string;
  count: string;
};

export async function getIssueCodeFrequencyWithSeverity(
  daysBack: number = 7
): Promise<IssueFrequencyWithSeverityRow[]> {
  const pool = getDbClient();
  if (!pool) return [];
  const r = await pool.query<IssueFrequencyWithSeverityRow>(
    "SELECT * FROM bty_issue_code_frequency_with_severity($1)",
    [daysBack]
  );
  return r.rows;
}

export async function getSummaryStats(
  daysBack: number = 7
): Promise<SummaryStatsRow | null> {
  const pool = getDbClient();
  if (!pool) return null;
  const r = await pool.query<SummaryStatsRow>(
    "SELECT * FROM bty_quality_summary_stats($1)",
    [daysBack]
  );
  return r.rows[0] ?? null;
}

export async function getBreakdown(
  daysBack: number = 7
): Promise<BreakdownRow[]> {
  const pool = getDbClient();
  if (!pool) return [];
  const r = await pool.query<BreakdownRow>(
    "SELECT * FROM bty_quality_breakdown($1)",
    [daysBack]
  );
  return r.rows;
}
