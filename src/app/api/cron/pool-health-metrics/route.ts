import { NextRequest, NextResponse } from "next/server";
import { collectScenarioPoolHealthSnapshots } from "@/lib/bty/monitoring/scenarioPoolHealth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

/**
 * POST /api/cron/pool-health-metrics
 * SCENARIO_AUDIT_STANDARDS_V1 §3 — PH-CHOICE-CONC, PH-ZERO-EXIT, PH-DET-UUID-CATALOG snapshots + alert summary.
 * Secured by CRON_SECRET (Authorization: Bearer or x-cron-secret).
 */
export async function POST(req: NextRequest) {
  const secret =
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ||
    req.headers.get("x-cron-secret")?.trim();
  const expected = process.env.CRON_SECRET;
  if (!expected || secret !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Server misconfiguration (no admin client)" }, { status: 500 });
  }

  try {
    const result = await collectScenarioPoolHealthSnapshots(admin, [7, 30]);
    const alertCount = result.alerts.length;
    return NextResponse.json(
      {
        ok: true,
        inserted: result.inserted,
        alertCount,
        alerts: result.alerts,
        note:
          alertCount > 0
            ? "Review docs/POOL_HEALTH_MONITORING_C5.md playbook; triage content vs mapping vs instrumentation."
            : "No threshold alerts this run (snapshots still recorded if any rows computed).",
      },
      { status: 200 },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[pool-health-metrics]", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
