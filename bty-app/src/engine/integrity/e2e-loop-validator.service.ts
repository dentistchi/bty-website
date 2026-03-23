/**
 * Extended Arena / Center / XP integration checks (v2) on top of {@link runLoopHealthCheck}.
 * Persists rows to `loop_health_log` with `check_version = 2` (same `run_id` as the base report).
 *
 * Destructive weekly reset: set `LOOP_HEALTH_ALLOW_WEEKLY_RESET=true` to run {@link triggerWeeklyReset}
 * and assert `weekly_xp_history` row count vs `usersSnapshotted`. Otherwise a read-only probe runs.
 *
 * @see POST /api/admin/arena/loop-health?extended=true
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { isUserArenaEjected } from "@/engine/integration/arena-center-ejection";
import { routeHealingToFoundry } from "@/engine/integration/center-foundry-router";
import { ELITE_SPEC_READINESS_THRESHOLD, handleEliteSpecNomination } from "@/engine/integration/elite-spec-flow";
import { getNextScenarioForSession } from "@/engine/integration/scenario-type-router";
import { resolveE2ETestUserId, seedFixtureUser } from "@/engine/integration/e2e-test-fixtures.service";
import {
  type LoopHealthCheckRow,
  type LoopHealthCheckStatus,
  type LoopHealthReport,
  runLoopHealthCheck,
} from "@/engine/integration/full-loop-validator";
import { getPromotionReadiness } from "@/engine/integrity/promotion-readiness.service";
import { scheduleOutcomes } from "@/engine/scenario/delayed-outcome-trigger.service";
import { triggerWeeklyReset } from "@/engine/xp/weekly-xp-reset.service";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const CHECK_VERSION_EXTENDED = 2 as const;

/** When `true`/`1`, extended check (5) calls {@link triggerWeeklyReset} (resets weekly XP for the week). */
export const LOOP_HEALTH_ALLOW_WEEKLY_RESET_ENV = "LOOP_HEALTH_ALLOW_WEEKLY_RESET" as const;

export type ExtendedHealthReport = {
  /** Same as `base.runId`; v2 rows share this `run_id`. */
  runId: string;
  base: LoopHealthReport;
  extendedChecks: LoopHealthCheckRow[];
  /** True when base.ok and every extended check is PASS. */
  ok: boolean;
  startedAt: string;
  finishedAt: string;
};

function getTestUserId(): string {
  return resolveE2ETestUserId();
}

function allowWeeklyResetTrigger(): boolean {
  const v = process.env[LOOP_HEALTH_ALLOW_WEEKLY_RESET_ENV];
  return v === "1" || v?.toLowerCase() === "true";
}

async function persistExtendedRow(
  admin: SupabaseClient,
  runId: string,
  checkKey: string,
  status: LoopHealthCheckStatus,
  detail?: string,
): Promise<void> {
  const { error } = await admin.from("loop_health_log").insert({
    run_id: runId,
    check_key: checkKey,
    status,
    detail: detail ?? null,
    check_version: CHECK_VERSION_EXTENDED,
  });
  if (error) {
    console.warn("[e2e-loop-validator] loop_health_log insert failed", error.message);
  }
}

function pushExtended(
  checks: LoopHealthCheckRow[],
  runId: string,
  admin: SupabaseClient | null,
  key: string,
  status: LoopHealthCheckStatus,
  detail?: string,
): void {
  checks.push({ key, status, detail });
  if (admin) {
    void persistExtendedRow(admin, runId, key, status, detail);
  }
}

function eliteSpecExtendedPass(
  readiness: number,
  res: Awaited<ReturnType<typeof handleEliteSpecNomination>>,
): boolean {
  if (!res.ok) return false;
  if (readiness < ELITE_SPEC_READINESS_THRESHOLD) {
    return res.action === "skipped" && res.reason === "below_threshold";
  }
  if (res.action === "nominated") return true;
  if (res.action === "skipped") {
    return (
      res.reason === "blocked" ||
      res.reason === "already_active" ||
      res.reason === "already_pending"
    );
  }
  return false;
}

/**
 * Runs {@link runLoopHealthCheck} then five additional integration checks; logs v2 rows.
 */
export async function runExtendedHealthCheck(): Promise<ExtendedHealthReport> {
  await seedFixtureUser();
  const extendedChecks: LoopHealthCheckRow[] = [];
  const base = await runLoopHealthCheck();
  const runId = base.runId;
  const startedAt = base.startedAt;
  const admin = getSupabaseAdmin();
  const testUserId = getTestUserId();

  if (!admin) {
    pushExtended(
      extendedChecks,
      runId,
      null,
      "e2e_supabase_admin",
      "FAIL",
      "Service role client unavailable",
    );
    return {
      runId,
      base,
      extendedChecks,
      ok: false,
      startedAt,
      finishedAt: new Date().toISOString(),
    };
  }

  // (1) getNextScenarioForSession returns a scenario for a non-ejected user
  try {
    const ejected = await isUserArenaEjected(testUserId, admin);
    if (ejected) {
      pushExtended(
        extendedChecks,
        runId,
        admin,
        "e2e_next_scenario_non_ejected",
        "FAIL",
        "Test user is Arena EJECTED; use an ACTIVE user for this check",
      );
    } else {
      const routed = await getNextScenarioForSession(testUserId, "ko");
      const pass =
        routed != null &&
        typeof routed.scenario?.scenarioId === "string" &&
        routed.scenario.scenarioId.length > 0;
      pushExtended(
        extendedChecks,
        runId,
        admin,
        "e2e_next_scenario_non_ejected",
        pass ? "PASS" : "FAIL",
        pass ? `route=${routed?.route}` : `routed=${routed === null ? "null" : "missing scenarioId"}`,
      );
    }
  } catch (e) {
    pushExtended(
      extendedChecks,
      runId,
      admin,
      "e2e_next_scenario_non_ejected",
      "FAIL",
      e instanceof Error ? e.message : String(e),
    );
  }

  // (2) Delayed outcome: scheduleOutcomes (choice-history → arena_pending_outcomes)
  try {
    const n = await scheduleOutcomes(testUserId, admin);
    pushExtended(
      extendedChecks,
      runId,
      admin,
      "e2e_delayed_outcome_schedule_choice_path",
      "PASS",
      `scheduleOutcomes_returned=${n}`,
    );
  } catch (e) {
    pushExtended(
      extendedChecks,
      runId,
      admin,
      "e2e_delayed_outcome_schedule_choice_path",
      "FAIL",
      e instanceof Error ? e.message : String(e),
    );
  }

  // (3) routeHealingToFoundry for REFLECTION (same hand-off as after advancePhase in center_diagnostic_complete)
  try {
    let sawAssign = false;
    const r = await routeHealingToFoundry(testUserId, "REFLECTION", {
      supabase: admin,
      emitProgramAssign: async () => {
        sawAssign = true;
      },
    });
    const pass = r.branch === "reflection" && sawAssign && r.programAssign != null;
    pushExtended(
      extendedChecks,
      runId,
      admin,
      "e2e_advance_phase_route_healing_to_foundry",
      pass ? "PASS" : "FAIL",
      pass
        ? "session-lifecycle: advancePhase → routeHealingToFoundry (REFLECTION)"
        : `branch=${r.branch} sawAssign=${sawAssign}`,
    );
  } catch (e) {
    pushExtended(
      extendedChecks,
      runId,
      admin,
      "e2e_advance_phase_route_healing_to_foundry",
      "FAIL",
      e instanceof Error ? e.message : String(e),
    );
  }

  // (4) elite_spec_nominations when readiness ≥ 85%
  try {
    const pr = await getPromotionReadiness(testUserId, { supabase: admin });
    const res = await handleEliteSpecNomination(testUserId);
    const pass = eliteSpecExtendedPass(pr.readiness_score, res);
    pushExtended(
      extendedChecks,
      runId,
      admin,
      "e2e_elite_spec_nomination_readiness_gate",
      pass ? "PASS" : "FAIL",
      pass
        ? `readiness=${pr.readiness_score.toFixed(3)} action=${res.ok ? res.action : "error"}`
        : `readiness=${pr.readiness_score.toFixed(3)} res=${JSON.stringify(res)}`,
    );
  } catch (e) {
    pushExtended(
      extendedChecks,
      runId,
      admin,
      "e2e_elite_spec_nomination_readiness_gate",
      "FAIL",
      e instanceof Error ? e.message : String(e),
    );
  }

  // (5) weekly_xp_history ↔ weekly reset (destructive only when LOOP_HEALTH_ALLOW_WEEKLY_RESET is set)
  try {
    if (allowWeeklyResetTrigger()) {
      const tr = await triggerWeeklyReset({ supabase: admin });
      if (!tr.ok) {
        pushExtended(
          extendedChecks,
          runId,
          admin,
          "e2e_weekly_reset_snapshots_history",
          "FAIL",
          tr.error ?? "triggerWeeklyReset failed",
        );
      } else if (tr.skipped) {
        pushExtended(
          extendedChecks,
          runId,
          admin,
          "e2e_weekly_reset_snapshots_history",
          "PASS",
          `skipped=${tr.reason ?? "already_reset_for_week"} endedWeekMonday=${tr.endedWeekMonday}`,
        );
      } else {
        const { count, error: cErr } = await admin
          .from("weekly_xp_history")
          .select("id", { count: "exact", head: true })
          .eq("ended_week_monday", tr.endedWeekMonday);

        if (cErr) {
          pushExtended(
            extendedChecks,
            runId,
            admin,
            "e2e_weekly_reset_snapshots_history",
            "FAIL",
            cErr.message,
          );
        } else {
          const n = count ?? 0;
          const pass = n === tr.usersSnapshotted;
          pushExtended(
            extendedChecks,
            runId,
            admin,
            "e2e_weekly_reset_snapshots_history",
            pass ? "PASS" : "FAIL",
            pass
              ? `history_rows=${n} matches usersSnapshotted endedWeekMonday=${tr.endedWeekMonday}`
              : `weekly_xp_history count=${n} usersSnapshotted=${tr.usersSnapshotted}`,
          );
        }
      }
    } else {
      const { data: logLatest, error: logErr } = await admin
        .from("weekly_reset_log")
        .select("ended_week_monday")
        .order("ended_week_monday", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (logErr) {
        pushExtended(
          extendedChecks,
          runId,
          admin,
          "e2e_weekly_reset_snapshots_history",
          "FAIL",
          logErr.message,
        );
      } else if (!logLatest || typeof (logLatest as { ended_week_monday?: string }).ended_week_monday !== "string") {
        pushExtended(
          extendedChecks,
          runId,
          admin,
          "e2e_weekly_reset_snapshots_history",
          "PASS",
          "read_only: no weekly_reset_log yet (set LOOP_HEALTH_ALLOW_WEEKLY_RESET for live reset assert)",
        );
      } else {
        const mon = (logLatest as { ended_week_monday: string }).ended_week_monday;
        const { count, error: cErr } = await admin
          .from("weekly_xp_history")
          .select("id", { count: "exact", head: true })
          .eq("ended_week_monday", mon);

        if (cErr) {
          pushExtended(
            extendedChecks,
            runId,
            admin,
            "e2e_weekly_reset_snapshots_history",
            "FAIL",
            cErr.message,
          );
        } else {
          pushExtended(
            extendedChecks,
            runId,
            admin,
            "e2e_weekly_reset_snapshots_history",
            "PASS",
            `read_only: weekly_xp_history rows for last reset week=${mon} count=${count ?? 0}`,
          );
        }
      }
    }
  } catch (e) {
    pushExtended(
      extendedChecks,
      runId,
      admin,
      "e2e_weekly_reset_snapshots_history",
      "FAIL",
      e instanceof Error ? e.message : String(e),
    );
  }

  const extendedOk = extendedChecks.every((c) => c.status === "PASS");
  const ok = base.ok && extendedOk;
  const finishedAt = new Date().toISOString();
  return { runId, base, extendedChecks, ok, startedAt, finishedAt };
}
