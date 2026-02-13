/**
 * Patch generator: BTY Quality Autopilot.
 * Fetches aggregated failure stats, calls GPT-4o, saves structured patch proposals.
 * No raw conversation text. Only aggregates + proposed rules.
 */

import { getDbClient } from "../config/db";
import {
  getTopIssuePatterns,
  getIssueCodeFrequencyWithSeverity,
  getBreakdown,
  getDailyTrendTopSignatures,
} from "./qualityEventsQueries";
import { getBannedPhrases, getFalsePersonaPatterns } from "../config/patchConfig";
import { openai } from "../config/openai";

const MODEL_VERSION = "gpt-4o";

/** Context drift overlap threshold (selfCritic) */
const CONTEXT_DRIFT_OVERLAP_THRESHOLD = 0.2;

/** Guardrail thresholds */
const GUARDRAIL_THRESHOLDS = {
  max_sentences: 3,
  max_questions: 1,
  max_chars: 280,
};

/** Pacing profile defaults */
const PACING_DEFAULTS = {
  maxSentences: 3,
  allowQuestion: true,
  questionStyle: "one_short",
};

/** Intent categories from intentExtractor */
const INTENT_CATEGORIES = [
  "debug_product",
  "share_story",
  "seek_advice",
  "venting",
  "conflict",
  "money",
  "clinical",
  "relationship",
  "leadership_reflection",
  "other",
];

export type TopTarget = {
  issues_signature: string;
  why: string;
  impact: "high" | "med" | "low";
};

export type RulePatch = {
  id: string;
  type: "guardrail" | "prompt" | "library" | "classifier";
  target_issue: string;
  change: string;
  implementation: {
    file: string;
    action: "add" | "modify";
    snippet: string;
  };
  risk: "low" | "med" | "high";
  rollback: string;
};

export type PatchTest = {
  name: string;
  given: string;
  expect: string;
};

export type PatchSuggestion = {
  patch_version: string;
  top_targets: TopTarget[];
  rule_patches: RulePatch[];
  tests: PatchTest[];
};

export type PatchSuggestionRecord = {
  id: string;
  created_at: string;
  window: string;
  status: string;
  suggestion: PatchSuggestion;
};

const PATCH_SYSTEM_PROMPT = `You are BTY Quality Autopilot.
You receive ONLY aggregated failure signatures (no user text).
Your job is to propose safe, minimal, high-impact patches.

Output strictly JSON with:
{
  "patch_version": "YYYY-WW",
  "top_targets": [
    {"issues_signature": "...", "why": "...", "impact": "high|med|low"}
  ],
  "rule_patches": [
    {
      "id": "RULE-###",
      "type": "guardrail|prompt|library|classifier",
      "target_issue": "false_persona|context_drift|question_overload|coach_tone|...",
      "change": "precise change description",
      "implementation": {
        "file": "path",
        "action": "add|modify",
        "snippet": "short code/prompt snippet"
      },
      "risk": "low|med|high",
      "rollback": "how to rollback"
    }
  ],
  "tests": [
    {"name":"...", "given":"...", "expect":"..."}
  ]
}

Rules:
- Never propose storing raw user messages.
- Prefer guardrail/rewrites over new model calls.
- Keep changes small and reversible.
- Avoid philosophical drift; keep BTY Warm Mentor constraints.
Output ONLY valid JSON. No markdown, no explanation.`;

function isoWeek(): string {
  const d = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  const s = new Date(d);
  s.setDate(s.getDate() + 4 - (s.getDay() || 7));
  const y = s.getFullYear();
  const w = Math.ceil(((s.getTime() - new Date(y, 0, 1).getTime()) / 86400000 + 1) / 7);
  return `${y}-${pad(w)}`;
}

/**
 * Fetches aggregated stats from DB + current rules snapshot.
 */
async function fetchAggregatedStats(windowDays: number) {
  const days = windowDays === 30 ? 30 : 7;
  console.log("[patchGenerator] Fetching aggregated stats for", days, "days...");
  const [topPatterns, issueFreq, breakdown, trends] = await Promise.all([
    getTopIssuePatterns(days),
    getIssueCodeFrequencyWithSeverity(days),
    getBreakdown(days),
    getDailyTrendTopSignatures(14, 5),
  ]);
  console.log("[patchGenerator] Fetched stats:", {
    topPatterns: topPatterns.length,
    issueFreq: issueFreq.length,
    breakdown: breakdown.length,
    trends: trends.length,
  });

  const top10Signatures = topPatterns.slice(0, 10).map((r) => ({
    issues_signature: r.issues_signature,
    count: Number(r.count),
    high_severity_count: Number(r.high_severity_count),
    high_ratio: Number(r.high_severity_count) / Math.max(1, Number(r.count)),
    avg_css: r.avg_css != null ? Number(r.avg_css) : null,
    top_roles: r.top_roles ?? "",
    top_intents: r.top_intents ?? "",
    top_routes: r.top_routes ?? "",
  }));

  const top10SingleIssues = issueFreq.slice(0, 10).map((r) => {
    const cnt = Number(r.count);
    return {
      issue: r.issue_code,
      count: cnt,
      high_ratio: cnt > 0 ? Number(r.high_count) / cnt : 0,
    };
  });

  const breakdownByDim: Record<string, Array<{ value: string; count: number }>> = {
    role: [],
    intent: [],
    route: [],
  };
  for (const r of breakdown) {
    const list = breakdownByDim[r.dimension];
    if (list) list.push({ value: r.value, count: Number(r.count) });
  }

  const top5Trends = trends.slice(0, 25).map((t) => ({
    day: t.day,
    issues_signature: t.issues_signature,
    count: Number(t.count),
    rank_in_day: t.rank_in_day,
  }));

  return {
    top10_signatures: top10Signatures,
    top10_single_issues: top10SingleIssues,
    breakdown: breakdownByDim,
    top5_trends_14d: top5Trends,
    current_banned_phrases: [...getBannedPhrases()],
    current_false_persona_patterns: getFalsePersonaPatterns().map((p) => p.source),
    guardrail_thresholds: GUARDRAIL_THRESHOLDS,
    pacing_defaults: PACING_DEFAULTS,
    context_drift_overlap_threshold: CONTEXT_DRIFT_OVERLAP_THRESHOLD,
    intent_categories: INTENT_CATEGORIES,
  };
}

function parseGptJson(text: string): PatchSuggestion {
  const cleaned = text
    .replace(/^```json?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
  const parsed = JSON.parse(cleaned);
  return {
    patch_version: parsed.patch_version || isoWeek(),
    top_targets: Array.isArray(parsed.top_targets) ? parsed.top_targets : [],
    rule_patches: Array.isArray(parsed.rule_patches) ? parsed.rule_patches : [],
    tests: Array.isArray(parsed.tests) ? parsed.tests : [],
  };
}

/**
 * Generates patch suggestions from aggregated quality events.
 */
export async function generatePatchSuggestions(
  window: "7d" | "30d"
): Promise<PatchSuggestionRecord | null> {
  const windowDays = window === "30d" ? 30 : 7;
  console.log("[patchGenerator] Starting patch generation for window:", window, `(${windowDays} days)`);
  const stats = await fetchAggregatedStats(windowDays);

  console.log("[patchGenerator] Aggregated stats:", {
    top10_signatures: stats.top10_signatures.length,
    top10_single_issues: stats.top10_single_issues.length,
    breakdown_entries: Object.keys(stats.breakdown).length,
  });

  if (stats.top10_signatures.length === 0 && stats.top10_single_issues.length === 0) {
    console.log("[patchGenerator] No quality events found in window, returning null");
    return null;
  }

  let suggestion: PatchSuggestion;
  try {
    console.log("[patchGenerator] Calling GPT-4o to generate patch suggestions...");
    const completion = await openai.chat.completions.create({
      model: MODEL_VERSION,
      messages: [
        { role: "system", content: PATCH_SYSTEM_PROMPT },
        {
          role: "user",
          content: JSON.stringify(stats, null, 2),
        },
      ],
      temperature: 0.2,
      max_tokens: 900,
    });
    const text = completion.choices[0]?.message?.content?.trim();
    if (!text) throw new Error("Empty GPT response");
    console.log("[patchGenerator] GPT response received, parsing JSON...");
    suggestion = parseGptJson(text);
    console.log("[patchGenerator] Parsed suggestion:", {
      top_targets: suggestion.top_targets?.length || 0,
      rule_patches: suggestion.rule_patches?.length || 0,
    });
  } catch (err: any) {
    console.error("[patchGenerator] GPT failed:", err?.message);
    throw err;
  }

  const pool = getDbClient();
  if (!pool) {
    return {
      id: "",
      created_at: new Date().toISOString(),
      window,
      status: "draft",
      suggestion,
    };
  }

  const inputSummary = {
    top10_signatures: stats.top10_signatures,
    top10_single_issues: stats.top10_single_issues,
    breakdown: stats.breakdown,
    top5_trends_14d: stats.top5_trends_14d,
    current_banned_phrases: stats.current_banned_phrases,
    current_false_persona_patterns: stats.current_false_persona_patterns,
    guardrail_thresholds: stats.guardrail_thresholds,
    pacing_defaults: stats.pacing_defaults,
    context_drift_overlap_threshold: stats.context_drift_overlap_threshold,
    intent_categories: stats.intent_categories,
  };

  console.log("[patchGenerator] Saving patch suggestion to database...");
  const r = await pool.query(
    `INSERT INTO bty_patch_suggestions ("window", model_version, input_summary, suggestions, status)
     VALUES ($1, $2, $3, $4, 'draft') RETURNING id, created_at`,
    [
      window,
      MODEL_VERSION,
      JSON.stringify(inputSummary),
      JSON.stringify(suggestion),
    ]
  );
  const row = r.rows[0];
  console.log("[patchGenerator] Patch suggestion saved:", {
    id: row.id,
    created_at: row.created_at,
  });

  return {
    id: row.id,
    created_at: row.created_at,
    window,
    status: "draft",
    suggestion,
  };
}

/** Returns last N patch suggestions (drafts by default) with top_targets and status */
export async function getLatestPatchDrafts(
  limit: number = 3,
  statusFilter?: "draft" | "approved" | "rejected" | "applied"
): Promise<Array<{ id: string; created_at: string; window: string; status: string; top_targets: TopTarget[] }>> {
  const pool = getDbClient();
  if (!pool) return [];
  const where = statusFilter ? `WHERE status = $2` : "";
  const params = statusFilter ? [limit, statusFilter] : [limit];
  const r = await pool.query(
    `SELECT id, created_at, "window", status, suggestions FROM bty_patch_suggestions
     ${where} ORDER BY created_at DESC LIMIT $1`,
    params
  );
  return r.rows.map((row: any) => {
    const sugs = typeof row.suggestions === "object" ? row.suggestions : JSON.parse(row.suggestions || "{}");
    return {
      id: row.id,
      created_at: row.created_at,
      window: row.window,
      status: row.status,
      top_targets: sugs.top_targets || [],
    };
  });
}

/** Set patch status to applied. Returns true if patch was found and updated. */
export async function applyPatchById(id: string): Promise<boolean> {
  const pool = getDbClient();
  if (!pool) return false;
  const r = await pool.query(
    `UPDATE bty_patch_suggestions SET status = 'applied', applied_at = now() WHERE id = $1 RETURNING id`,
    [id]
  );
  return r.rowCount !== null && r.rowCount > 0;
}

/** Returns map of issues_signature -> latest patch suggestion id */
export async function getLatestPatchIdBySignature(): Promise<Record<string, string>> {
  const pool = getDbClient();
  if (!pool) return {};
  try {
    const r = await pool.query(
      `SELECT id, input_summary FROM bty_patch_suggestions ORDER BY created_at DESC LIMIT 1`
    );
    if (!r.rows[0]) return {};
    const summary = typeof r.rows[0].input_summary === "object"
      ? r.rows[0].input_summary
      : JSON.parse(r.rows[0].input_summary || "{}");
    const patchId = r.rows[0].id;
    const map: Record<string, string> = {};
    for (const p of summary.top10_signatures || []) {
      if (p.issues_signature) map[p.issues_signature] = patchId;
    }
    return map;
  } catch (err: any) {
    // Table doesn't exist or other DB error - return empty map
    console.warn("[patchGenerator] getLatestPatchIdBySignature failed (table may not exist):", err?.message);
    return {};
  }
}

/** Legacy: adapt for admin UI */
export type PatchReport = {
  id: string;
  created_at: string;
  window_days: number;
  report: {
    summary_stats: { total_events: number; avg_css: number | null; severity: Record<string, number> };
    top_patterns: Array<{
      issues_signature: string;
      count: number;
      high_severity_count: number;
      suggested_patch?: string;
    }>;
    issue_frequencies: Array<{ issue: string; count: number; high_ratio: number }>;
  };
  summary?: string;
};

export async function getRecentPatchReports(limit: number = 3): Promise<PatchReport[]> {
  const pool = getDbClient();
  if (!pool) {
    console.log("[patchGenerator] getRecentPatchReports: No DB pool, returning empty array");
    return [];
  }
  try {
    console.log("[patchGenerator] getRecentPatchReports: Querying database with limit:", limit);
    const r = await pool.query(
      `SELECT id, created_at, "window", status, input_summary, suggestions FROM bty_patch_suggestions
       ORDER BY created_at DESC LIMIT $1`,
      [limit]
    );
    console.log("[patchGenerator] getRecentPatchReports: Found", r.rows.length, "rows");
  return r.rows.map((row: any) => {
    const summary = typeof row.input_summary === "object" ? row.input_summary : JSON.parse(row.input_summary || "{}");
    const sugs = typeof row.suggestions === "object" ? row.suggestions : JSON.parse(row.suggestions || "{}");
    const rulePatches = sugs.rule_patches || [];
    const summaryStr = rulePatches
      .map((p: { change?: string }) => p?.change)
      .filter(Boolean)
      .join("; ");
    const topPatterns = (summary.top10_signatures || []).map((p: { issues_signature: string; count: number; high_severity_count?: number }) => ({
      issues_signature: p.issues_signature,
      count: p.count,
      high_severity_count: p.high_severity_count ?? 0,
    }));
    const issueFreq = (summary.top10_single_issues || []).map((p: { issue: string; count: number; high_ratio?: number }) => ({
      issue: p.issue,
      count: p.count,
      high_ratio: p.high_ratio ?? 0,
    }));
    return {
      id: row.id,
      created_at: row.created_at,
      window_days: row.window === "30d" ? 30 : 7,
      status: row.status || "draft",
      report: {
        summary_stats: {
          total_events: 0,
          avg_css: null,
          severity: {},
        },
        top_patterns: topPatterns,
        issue_frequencies: issueFreq,
        rule_patches: rulePatches,
        tests: sugs.tests || [],
      },
      summary: summaryStr,
    };
  });
  } catch (err: any) {
    console.error("[patchGenerator] getRecentPatchReports error:", {
      message: err?.message,
      code: err?.code,
      detail: err?.detail,
    });
    // Return empty array on error instead of throwing
    return [];
  }
}
