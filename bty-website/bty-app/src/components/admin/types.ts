export type Summary = {
  window: string;
  top_signatures: Array<{
    issues_signature: string;
    count: number;
    high_severity_count: number;
    avg_css: number | null;
    top_roles: string;
    top_intents: string;
    top_routes: string;
    latest_patch_id: string | null;
  }>;
  issue_frequencies: Array<{ issue: string; count: number; high_ratio: number }>;
  severity: { low: number; medium: number; high: number };
  avg_css: number | null;
  total_events: number;
  breakdown: {
    role: Array<{ value: string; count: number }>;
    route: Array<{ value: string; count: number }>;
    intent: Array<{ value: string; count: number }>;
  };
};

export type Trend = {
  day: string;
  issues_signature: string;
  count: number;
  rank_in_day: number;
};

export type PatchReport = {
  id: string;
  created_at: string;
  window_days: number;
  status?: "draft" | "approved" | "rejected" | "applied";
  report?: {
    summary_stats?: unknown;
    top_patterns?: Array<{
      issues_signature: string;
      count: number;
      high_severity_count?: number;
      suggested_patch?: string;
    }>;
    rule_patches?: Array<{
      target_issue: string;
      change: string;
      implementation?: { file: string; action: string; snippet: string };
      risk?: string;
      rollback?: string;
    }>;
    tests?: Array<{ name: string; given: string; expect: string }>;
  };
  suggestions?: unknown;
  summary?: string;
};
