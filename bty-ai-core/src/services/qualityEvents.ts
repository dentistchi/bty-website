/**
 * Quality events tracking for bty_quality_events.
 * Store issue signatures only (no userText or draft).
 * Used to see what fails most and patch rules weekly.
 */

import { getDbClient } from "../config/db";

export type QualityEventRoute = "web" | "teams" | "app";

export type QualityEventInput = {
  role: string;
  intent: string;
  issues: string[];
  severity: "low" | "medium" | "high";
  cssScore?: number | null;
  modelVersion?: string | null;
  route: QualityEventRoute;
};

/**
 * Extracts issue signatures from full issue strings.
 * e.g. "context_drift: draft does not reflect..." -> "context_drift"
 */
export function issueSignaturesFromIssues(issues: string[]): string[] {
  return issues
    .map((s) => {
      const colon = s.indexOf(":");
      return colon >= 0 ? s.slice(0, colon).trim() : s.trim();
    })
    .filter((s) => s.length > 0);
}

/**
 * Records a quality event when critic fails.
 */
export async function recordQualityEvent(input: QualityEventInput): Promise<void> {
  const pool = getDbClient();
  if (!pool) return;

  let signatures = issueSignaturesFromIssues(input.issues);
  if (signatures.length === 0 && input.issues.length > 0) {
    signatures = input.issues.map((s) => (s.trim().split(/\s+/)[0] || s.trim())).filter(Boolean);
  }

  // Log event payload at model response completion
  console.log("[qualityEvents] Recording event:", {
    issues: input.issues,
    css_score: input.cssScore ?? null,
    severity: input.severity,
    route: input.route,
    intent: input.intent,
  });

  try {
    const r = await pool.query<{ id: string }>(
      `INSERT INTO bty_quality_events (role, intent, issues, severity, css_score, model_version, route)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        input.role,
        input.intent,
        signatures,
        input.severity,
        input.cssScore ?? null,
        input.modelVersion ?? null,
        input.route,
      ]
    );
    const id = r.rows[0]?.id;
    if (id) {
      console.log(`Quality event inserted: ${id}`);
    }
  } catch (err) {
    console.error("[qualityEvents] Insert failed:", {
      error: err instanceof Error ? err.message : String(err),
      issues: input.issues,
      severity: input.severity,
      route: input.route,
      intent: input.intent,
    });
    if (err instanceof Error && err.stack) {
      console.error("[qualityEvents] Stack:", err.stack);
    }
  }
}
