/**
 * SCENARIO_AUDIT_STANDARDS_V1.md §3 — pool health snapshots (C3).
 * Inserts into `scenario_pool_health_snapshots` via service role; non-blocking for users.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type PoolHealthCronResult = {
  inserted: number;
  alerts: PoolHealthAlert[];
  windows: number[];
};

export type PoolHealthAlert = {
  metric_id: string;
  scenario_id: string;
  step: number | null;
  message: string;
  value_primary: number | null;
  sample_size: number | null;
};

/** SCENARIO_AUDIT_STANDARDS_V1 §3.2 — concentration (tunable per env). */
const WARN_MAX_SHARE = Number(process.env.POOL_HEALTH_WARN_MAX_CHOICE_SHARE ?? "0.80");
const CRIT_MAX_SHARE = Number(process.env.POOL_HEALTH_CRIT_MAX_CHOICE_SHARE ?? "0.90");
const CRIT_HHI = Number(process.env.POOL_HEALTH_CRIT_HHI ?? "0.82");

/** Zero-exit rate thresholds (§3.2). */
const WARN_ZERO_EXIT_RATE = Number(process.env.POOL_HEALTH_WARN_ZERO_EXIT_RATE ?? "0.85");
const CRIT_ZERO_EXIT_RATE = Number(process.env.POOL_HEALTH_CRIT_ZERO_EXIT_RATE ?? "0.95");

/** Minimum committed choices / runs before WARN/CRIT alerts (§3 statistical floor). */
const MIN_RUNS = Number(process.env.POOL_HEALTH_MIN_RUNS ?? "30");

type RpcChoiceRow = {
  scenario_id: string;
  step: number;
  max_share: number;
  hhi: number;
  total_commits: number;
};

type RpcZeroExitRow = {
  scenario_id: string;
  runs_with_signals: number;
  runs_with_no_exit: number;
  zero_exit_rate: number;
};

const UUID_LIKE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-([0-9a-f])[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * PH-DET-UUID-CATALOG — catalog `scenarios.scenario_id` only (§3.1.1).
 * Synthetic `mirror:<uuid>` ids are **excluded**: mirror pool row ids are intentionally UUID v5-stable.
 * @returns reasons or empty if no issue
 */
export function detectScenarioIdUuidIssues(scenarioId: string): string[] {
  const raw = scenarioId.trim();
  if (!raw) return [];
  if (raw.toLowerCase().startsWith("mirror:")) {
    return [];
  }
  const id = raw;
  const lower = id.toLowerCase();
  if (lower === "00000000-0000-0000-0000-000000000000") {
    return ["nil_uuid"];
  }
  if (!UUID_LIKE.test(id)) return [];
  const reasons: string[] = [];
  const m = id.match(UUID_LIKE);
  const versionNibble = m?.[1]?.toLowerCase();
  if (versionNibble === "1") {
    reasons.push("uuid_v1_time_embedded");
  }
  if (/^0{8}-0{4}-0{4}-0{4}-0{12}$/i.test(id)) {
    reasons.push("all_zero_segments");
  }
  return reasons;
}

export async function collectScenarioPoolHealthSnapshots(
  admin: SupabaseClient,
  windows: number[] = [7, 30],
): Promise<PoolHealthCronResult> {
  const alerts: PoolHealthAlert[] = [];
  let inserted = 0;
  const rows: Array<{
    window_days: number;
    metric_id: string;
    scenario_id: string;
    step: number | null;
    value_primary: number | null;
    value_secondary: number | null;
    sample_size: number | null;
    details: Record<string, unknown>;
  }> = [];

  for (const d of windows) {
    const { data: conc, error: cErr } = await admin.rpc("ph_choice_conc_rollup", { p_days: d });
    if (cErr) {
      throw new Error(`ph_choice_conc_rollup: ${cErr.message}`);
    }
    /** Scenarios with PH-CHOICE-CONC at Warning+ in this window (for PH-ZERO-EXIT correlation, §3.2). */
    const concWarnPlusScenarioIds = new Set<string>();
    for (const r of (conc ?? []) as RpcChoiceRow[]) {
      const maxShare = Number(r.max_share);
      const hhi = Number(r.hhi);
      rows.push({
        window_days: d,
        metric_id: "PH-CHOICE-CONC",
        scenario_id: r.scenario_id,
        step: r.step,
        value_primary: maxShare,
        value_secondary: hhi,
        sample_size: r.total_commits,
        details: { hhi, total_commits: r.total_commits },
      });
      const n = Number(r.total_commits);
      if (n < MIN_RUNS) continue;
      if (maxShare >= WARN_MAX_SHARE || hhi >= CRIT_HHI || maxShare >= CRIT_MAX_SHARE) {
        concWarnPlusScenarioIds.add(r.scenario_id);
      }
      if (maxShare >= CRIT_MAX_SHARE || hhi >= CRIT_HHI) {
        alerts.push({
          metric_id: "PH-CHOICE-CONC",
          scenario_id: r.scenario_id,
          step: r.step,
          message: `CRIT: max_share ${maxShare.toFixed(3)} / HHI ${hhi.toFixed(3)} (thresholds ${CRIT_MAX_SHARE} share or ${CRIT_HHI} HHI)`,
          value_primary: maxShare,
          sample_size: n,
        });
      } else if (maxShare >= WARN_MAX_SHARE) {
        alerts.push({
          metric_id: "PH-CHOICE-CONC",
          scenario_id: r.scenario_id,
          step: r.step,
          message: `WARN: max_choice_share ${maxShare.toFixed(3)} >= ${WARN_MAX_SHARE} (possible de-facto correct answer / funneling)`,
          value_primary: maxShare,
          sample_size: n,
        });
      }
    }

    const { data: zx, error: zErr } = await admin.rpc("ph_zero_exit_rollup", { p_days: d });
    if (zErr) {
      throw new Error(`ph_zero_exit_rollup: ${zErr.message}`);
    }
    for (const r of (zx ?? []) as RpcZeroExitRow[]) {
      const rate = Number(r.zero_exit_rate);
      rows.push({
        window_days: d,
        metric_id: "PH-ZERO-EXIT",
        scenario_id: r.scenario_id,
        step: null,
        value_primary: rate,
        value_secondary: null,
        sample_size: r.runs_with_signals,
        details: {
          runs_with_signals: r.runs_with_signals,
          runs_with_no_exit: r.runs_with_no_exit,
        },
      });
      const runs = Number(r.runs_with_signals);
      if (runs < MIN_RUNS) continue;
      if (!concWarnPlusScenarioIds.has(r.scenario_id)) continue;
      if (rate >= CRIT_ZERO_EXIT_RATE) {
        alerts.push({
          metric_id: "PH-ZERO-EXIT",
          scenario_id: r.scenario_id,
          step: null,
          message: `CRIT: zero_exit_rate ${rate.toFixed(3)} >= ${CRIT_ZERO_EXIT_RATE} with PH-CHOICE-CONC Warning+`,
          value_primary: rate,
          sample_size: runs,
        });
      } else if (rate >= WARN_ZERO_EXIT_RATE) {
        alerts.push({
          metric_id: "PH-ZERO-EXIT",
          scenario_id: r.scenario_id,
          step: null,
          message: `WARN: zero_exit_rate ${rate.toFixed(3)} >= ${WARN_ZERO_EXIT_RATE} with PH-CHOICE-CONC Warning+`,
          value_primary: rate,
          sample_size: runs,
        });
      }
    }
  }

  const { data: catRows, error: catErr } = await admin.from("scenarios").select("scenario_id").limit(8000);
  if (catErr) {
    throw new Error(`scenarios select: ${catErr.message}`);
  }
  for (const row of catRows ?? []) {
    const sid = typeof row.scenario_id === "string" ? row.scenario_id : "";
    const issues = detectScenarioIdUuidIssues(sid);
    if (issues.length === 0) continue;
    rows.push({
      window_days: 7,
      metric_id: "PH-DET-UUID-CATALOG",
      scenario_id: sid,
      step: null,
      value_primary: null,
      value_secondary: null,
      sample_size: null,
      details: { reasons: issues, source: "scenarios.scenario_id" },
    });
    alerts.push({
      metric_id: "PH-DET-UUID-CATALOG",
      scenario_id: sid,
      step: null,
      message: `UUID-shaped id flags: ${issues.join(", ")}`,
      value_primary: null,
      sample_size: null,
    });
  }

  if (rows.length > 0) {
    const { error: insErr } = await admin.from("scenario_pool_health_snapshots").insert(rows);
    if (insErr) {
      throw new Error(`scenario_pool_health_snapshots insert: ${insErr.message}`);
    }
    inserted = rows.length;
  }

  return { inserted, alerts, windows };
}
