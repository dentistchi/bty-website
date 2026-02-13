import { Router, Request, Response } from "express";
import {
  getTopIssuePatterns,
  getIssueCodeFrequencyWithSeverity,
  getDailyTrendTopSignatures,
  getSummaryStats,
  getBreakdown,
} from "../services/qualityEventsQueries";
import { getDbClient } from "../config/db";
import { getLatestPatchIdBySignature } from "../services/patchGenerator";
import { recordQualityEvent } from "../services/qualityEvents";

const router = Router();

const ADMIN_API_KEY = process.env.ADMIN_API_KEY;

function requireAdmin(req: Request, res: Response, next: () => void) {
  const providedKey = req.headers["x-admin-api-key"];
  if (!ADMIN_API_KEY || providedKey !== ADMIN_API_KEY) {
    res.status(401).json({ error: "Unauthorized: Admin access required" });
    return;
  }
  next();
}

function parseWindow(window: string | undefined, defaultDays: number): number {
  const m = (window || "").match(/^(\d+)d$/);
  if (!m) return defaultDays;
  const n = parseInt(m[1], 10);
  return n > 0 ? n : defaultDays;
}

/** Public health check (no auth) for end-to-end verification */
router.get("/health", async (req: Request, res: Response) => {
  try {
    const pool = getDbClient();
    if (!pool) {
      return res.json({
        db_ok: false,
        total_events_30d: 0,
        latest_event_at: null,
        ...(process.env.NODE_ENV === "development" && { error: "DB pool not configured" }),
      });
    }
    const r = await pool.query<{ total: string; latest: string | null }>(
      `SELECT count(*)::TEXT as total, max(timestamp)::TEXT as latest
       FROM bty_quality_events WHERE timestamp >= now() - interval '30 days'`
    );
    const row = r.rows[0];
    const total = row ? parseInt(row.total, 10) : 0;
    const latest = row?.latest ?? null;
    res.json({ db_ok: true, total_events_30d: total, latest_event_at: latest });
  } catch (err: any) {
    res.json({
      db_ok: false,
      total_events_30d: 0,
      latest_event_at: null,
      ...(process.env.NODE_ENV === "development" && { error: err?.message || "DB error" }),
    });
  }
});

router.get("/top", requireAdmin, async (req: Request, res: Response) => {
  try {
    const days = parseWindow(req.query.window as string, 7);
    const [rows, patchMap] = await Promise.all([
      getTopIssuePatterns(days),
      getLatestPatchIdBySignature(),
    ]);
    res.json({
      window: `${days}d`,
      top_signatures: rows.map((r) => ({
        issues_signature: r.issues_signature,
        count: Number(r.count),
        high_severity_count: Number(r.high_severity_count),
        avg_css: r.avg_css != null ? Number(r.avg_css) : null,
        top_roles: r.top_roles ?? "",
        top_intents: r.top_intents ?? "",
        top_routes: r.top_routes ?? "",
        latest_patch_id: patchMap[r.issues_signature] ?? null,
      })),
    });
  } catch (err: any) {
    console.error("[quality] /top error:", err);
    res.status(500).json({ error: "Failed to fetch top patterns" });
  }
});

router.get("/frequencies", requireAdmin, async (req: Request, res: Response) => {
  try {
    const days = parseWindow(req.query.window as string, 7);
    const rows = await getIssueCodeFrequencyWithSeverity(days);
    res.json({
      window: `${days}d`,
      issue_frequencies: rows.map((r) => {
        const cnt = Number(r.count);
        const high = Number(r.high_count);
        return {
          issue: r.issue_code,
          count: cnt,
          high_ratio: cnt > 0 ? Math.round((high / cnt) * 100) / 100 : 0,
        };
      }),
    });
  } catch (err: any) {
    console.error("[quality] /frequencies error:", err);
    res.status(500).json({ error: "Failed to fetch issue frequencies" });
  }
});

router.get("/trends", requireAdmin, async (req: Request, res: Response) => {
  try {
    const days = parseWindow(req.query.window as string, 14);
    const topN = Math.min(parseInt(req.query.top as string) || 5, 20);
    const rows = await getDailyTrendTopSignatures(days, topN);
    res.json({
      window: `${days}d`,
      trends: rows.map((r) => ({
        day: r.day,
        issues_signature: r.issues_signature,
        count: Number(r.count),
        rank_in_day: r.rank_in_day,
      })),
    });
  } catch (err: any) {
    console.error("[quality] /trends error:", err);
    res.status(500).json({ error: "Failed to fetch trends" });
  }
});

router.get("/summary", requireAdmin, async (req: Request, res: Response) => {
  try {
    const days = parseWindow(req.query.window as string, 7);
    console.log("[quality] /summary called with days:", days);
    const [topRows, freqRows, stats, breakdownRows, patchMap] = await Promise.all([
      getTopIssuePatterns(days),
      getIssueCodeFrequencyWithSeverity(days),
      getSummaryStats(days),
      getBreakdown(days),
      getLatestPatchIdBySignature(),
    ]);
    console.log("[quality] /summary query results:", {
      topRows: topRows.length,
      freqRows: freqRows.length,
      stats: stats ? "present" : "null",
      breakdownRows: breakdownRows.length,
      patchMap: Object.keys(patchMap).length,
    });

    const breakdown: Record<string, Array<{ value: string; count: number }>> = {
      role: [],
      route: [],
      intent: [],
    };
    for (const r of breakdownRows) {
      const list = breakdown[r.dimension];
      if (list) list.push({ value: r.value, count: Number(r.count) });
    }

    res.json({
      window: `${days}d`,
      top_signatures: topRows.map((r) => ({
        issues_signature: r.issues_signature,
        count: Number(r.count),
        high_severity_count: Number(r.high_severity_count),
        avg_css: r.avg_css != null ? Number(r.avg_css) : null,
        top_roles: r.top_roles ?? "",
        top_intents: r.top_intents ?? "",
        top_routes: r.top_routes ?? "",
        latest_patch_id: patchMap[r.issues_signature] ?? null,
      })),
      issue_frequencies: freqRows.map((r) => {
        const cnt = Number(r.count);
        const high = Number(r.high_count);
        return {
          issue: r.issue_code,
          count: cnt,
          high_ratio: cnt > 0 ? Math.round((high / cnt) * 100) / 100 : 0,
        };
      }),
      severity: stats
        ? {
            low: Number(stats.severity_low),
            medium: Number(stats.severity_medium),
            high: Number(stats.severity_high),
          }
        : { low: 0, medium: 0, high: 0 },
      avg_css: stats?.avg_css != null ? Number(stats.avg_css) : null,
      total_events: stats ? Number(stats.total_events) : 0,
      breakdown,
    });
  } catch (err: any) {
    console.error("[quality] /summary error:", {
      message: err?.message,
      stack: err?.stack,
      code: err?.code,
      detail: err?.detail,
      hint: err?.hint,
    });
    res.status(500).json({ 
      error: "Failed to fetch summary",
      detail: process.env.NODE_ENV === "development" ? err?.message : undefined,
    });
  }
});

/** Dev only: insert sample quality events for testing dashboard */
router.post("/sample", requireAdmin, async (req: Request, res: Response) => {
  if (process.env.NODE_ENV !== "development") {
    return res.status(403).json({ error: "Only available in development" });
  }
  try {
    const samples = [
      { role: "user", intent: "share_story", issues: ["context_drift: draft does not reflect key point"], severity: "high" as const, route: "web" as const },
      { role: "user", intent: "seek_advice", issues: ["context_drift: draft does not reflect key point", "verbosity: too many sentences"], severity: "medium" as const, route: "web" as const },
      { role: "user", intent: "venting", issues: ["context_drift: draft does not reflect key point"], severity: "high" as const, route: "teams" as const },
      { role: "user", intent: "share_story", issues: ["verbosity: draft has more than 3 sentences"], severity: "low" as const, route: "web" as const },
      { role: "user", intent: "leadership_reflection", issues: ["context_drift: draft does not reflect key point"], severity: "high" as const, route: "web" as const },
      { role: "user", intent: "conflict", issues: ["context_drift: draft does not reflect key point", "coach_tone: uses directive phrasing"], severity: "medium" as const, route: "teams" as const },
      { role: "user", intent: "share_story", issues: ["context_drift: draft does not reflect key point"], severity: "high" as const, route: "web" as const },
      { role: "user", intent: "seek_advice", issues: ["verbosity: draft has more than 3 sentences"], severity: "low" as const, route: "web" as const },
    ];
    for (const s of samples) {
      await recordQualityEvent({
        ...s,
        cssScore: Math.floor(Math.random() * 40) + 60,
        modelVersion: "gpt-4o",
      });
    }
    res.json({ inserted: samples.length });
  } catch (err: any) {
    console.error("[quality] /sample error:", err);
    res.status(500).json({ error: "Failed to insert sample events" });
  }
});

const SEED_ISSUES = ["false_persona", "context_drift", "question_overload", "coach_tone", "verbosity"];
const ROLES = ["user", "assistant"];
const INTENTS = ["share_story", "seek_advice", "venting", "leadership_reflection", "conflict", "debug_product", "relationship", "clinical", "other"];
const ROUTES = ["web", "teams"] as const;
const SEVERITIES = ["low", "medium", "high"] as const;

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Dev only: insert 30 sample quality events with varied issues */
router.post("/seed", requireAdmin, async (req: Request, res: Response) => {
  if (process.env.NODE_ENV !== "development") {
    return res.status(403).json({ error: "Only available in development" });
  }
  const pool = getDbClient();
  if (!pool) {
    return res.status(503).json({
      error: "DB pool not configured. Set DATABASE_URL in bty-ai-core .env",
      inserted: 0,
    });
  }
  try {
    const count = 30;
    for (let i = 0; i < count; i++) {
      const numIssues = 1 + Math.floor(Math.random() * 2); // 1–3 issues per event
      const issues: string[] = [];
      const used = new Set<string>();
      while (issues.length < numIssues) {
        const issue = pick(SEED_ISSUES);
        if (!used.has(issue)) {
          used.add(issue);
          issues.push(issue);
        }
      }
      await recordQualityEvent({
        role: pick([...ROLES]),
        intent: pick(INTENTS),
        issues,
        severity: pick([...SEVERITIES]),
        cssScore: Math.floor(Math.random() * 50) + 50,
        modelVersion: "gpt-4o",
        route: pick([...ROUTES]) as "web" | "teams",
      });
    }
    res.json({ inserted: count });
  } catch (err: any) {
    console.error("[quality] /seed error:", err);
    res.status(500).json({ error: "Failed to seed sample events" });
  }
});

export default router;
