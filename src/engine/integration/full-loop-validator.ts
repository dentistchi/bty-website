/**
 * Health checks for the Arena → Foundry → Center integration loop.
 * Persists each step to `loop_health_log`; invoke via {@link runLoopHealthCheck} (e.g. admin API).
 */

import { randomUUID } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildArenaContext } from "@/engine/integration/arena-context.injector";
import {
  AIR_EJECTION_THRESHOLD,
  checkEjectionCondition,
  isUserArenaEjected,
  liftEjection,
} from "@/engine/integration/arena-center-ejection";
import { processSessionOutcome } from "@/engine/integration/arena-foundry-bridge";
import {
  getPhaseGateStatus,
  PHASE_GATE_MAP,
} from "@/engine/healing/healing-content.service";
import { HEALING_PHASE_ORDER } from "@/engine/healing/healing-phase.service";
import { resolveE2ETestUserId, seedFixtureUser } from "@/engine/integration/e2e-test-fixtures.service";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

/** Set in env for checks that need a real profile (optional for some synthetic checks). */
export const LOOP_HEALTH_TEST_USER_ID_ENV = "LOOP_HEALTH_TEST_USER_ID" as const;
/** When `true`/`1`, runs a destructive sub-40 AIR check on the test user (ejects them). Run last in CI/staging only. */
export const LOOP_HEALTH_VERIFY_SUB40_AIR_ENV = "LOOP_HEALTH_VERIFY_SUB40_AIR" as const;
/** Optional: user id that is EJECTED with incomplete Center phase gates — expects `liftEjection` → `center_phase_gate_incomplete`. */
export const LOOP_HEALTH_EJECTED_INCOMPLETE_GATES_USER_ID_ENV =
  "LOOP_HEALTH_EJECTED_INCOMPLETE_GATES_USER_ID" as const;

export type LoopHealthCheckStatus = "PASS" | "FAIL";

export type LoopHealthCheckRow = {
  key: string;
  status: LoopHealthCheckStatus;
  detail?: string;
};

export type LoopHealthReport = {
  runId: string;
  /** True when every check is PASS. */
  ok: boolean;
  checks: LoopHealthCheckRow[];
  startedAt: string;
  finishedAt: string;
};

function getTestUserId(): string {
  return resolveE2ETestUserId();
}

async function persistLogRow(
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
    check_version: 1,
  });
  if (error) {
    console.warn("[full-loop-validator] loop_health_log insert failed", error.message);
  }
}

function push(
  checks: LoopHealthCheckRow[],
  runId: string,
  admin: SupabaseClient | null,
  key: string,
  status: LoopHealthCheckStatus,
  detail?: string,
): void {
  checks.push({ key, status, detail });
  if (admin) {
    void persistLogRow(admin, runId, key, status, detail);
  }
}

/**
 * Runs the full loop health battery and writes one row per check to `loop_health_log`.
 */
export async function runLoopHealthCheck(): Promise<LoopHealthReport> {
  await seedFixtureUser();
  const runId = randomUUID();
  const startedAt = new Date().toISOString();
  const checks: LoopHealthCheckRow[] = [];
  const admin = getSupabaseAdmin();
  const testUserId = getTestUserId();

  if (!admin) {
    push(checks, runId, null, "supabase_admin", "FAIL", "Service role client unavailable");
    const finishedAt = new Date().toISOString();
    return {
      runId,
      ok: false,
      checks,
      startedAt,
      finishedAt,
    };
  }

  // --- Constant / synthetic checks (no test user) ---
  push(
    checks,
    runId,
    admin,
    "ejection_air_threshold_constant",
    AIR_EJECTION_THRESHOLD === 0.4 ? "PASS" : "FAIL",
    `AIR_EJECTION_THRESHOLD=${AIR_EJECTION_THRESHOLD}`,
  );

  push(
    checks,
    runId,
    admin,
    "check_ejection_sub40_numeric",
    0.35 < AIR_EJECTION_THRESHOLD ? "PASS" : "FAIL",
    "0.35 normalized AIR is below 40% threshold",
  );

  let foundryUnlockSeen = false;
  try {
    const r = await processSessionOutcome(
      testUserId ?? "00000000-0000-0000-0000-000000000000",
      {
        scenarioType: "loop_health_synthetic",
        previousAir: 0.5,
        newAir: 0.52,
        occurredAt: new Date(),
      },
      {
        emitFoundryUnlock: async () => {
          foundryUnlockSeen = true;
        },
      },
    );
    const pass =
      r.branch === "improved" && r.foundryUnlock != null && foundryUnlockSeen;
    push(
      checks,
      runId,
      admin,
      "process_session_outcome_foundry_unlock",
      pass ? "PASS" : "FAIL",
      pass ? undefined : `branch=${r.branch} foundryUnlock=${Boolean(r.foundryUnlock)} emit=${foundryUnlockSeen}`,
    );
  } catch (e) {
    push(
      checks,
      runId,
      admin,
      "process_session_outcome_foundry_unlock",
      "FAIL",
      e instanceof Error ? e.message : String(e),
    );
  }

  try {
    const r = await processSessionOutcome(
      testUserId ?? "00000000-0000-0000-0000-000000000000",
      {
        scenarioType: "loop_health_synthetic",
        previousAir: 0.5,
        newAir: 0.45,
        occurredAt: new Date(),
      },
    );
    push(
      checks,
      runId,
      admin,
      "process_session_outcome_mirror_queue",
      r.branch === "declined" && r.mirrorQueued ? "PASS" : "FAIL",
      `branch=${r.branch} mirrorQueued=${r.mirrorQueued}`,
    );
  } catch (e) {
    push(
      checks,
      runId,
      admin,
      "process_session_outcome_mirror_queue",
      "FAIL",
      e instanceof Error ? e.message : String(e),
    );
  }

  // --- Test user required from here ---
  try {
    const ctx = await buildArenaContext(testUserId, admin);
    const narrative = (ctx.patternNarrative ?? "").trim();
    const situation = (ctx.situation ?? "").trim();
    const hasNarrative =
      narrative.length > 0 || situation.length > 0 || ctx.pendingOutcomeIds.length > 0;
    push(
      checks,
      runId,
      admin,
      "build_arena_context_narrative",
      hasNarrative ? "PASS" : "FAIL",
      hasNarrative
        ? undefined
        : "patternNarrative and situation empty and no pending outcomes",
    );
  } catch (e) {
    push(
      checks,
      runId,
      admin,
      "build_arena_context_narrative",
      "FAIL",
      e instanceof Error ? e.message : String(e),
    );
  }

  try {
    const safe = await checkEjectionCondition(testUserId, {
      newAir: 0.41,
      now: new Date(),
      supabase: admin,
    });
    /** Sub-40 rule must not fire at 0.41; ejection path is covered by constant + DB write tests elsewhere. */
    const pass = !safe.ejectedNow;
    push(
      checks,
      runId,
      admin,
      "check_ejection_safe_above_threshold",
      pass ? "PASS" : "FAIL",
      pass ? undefined : JSON.stringify(safe),
    );
  } catch (e) {
    push(
      checks,
      runId,
      admin,
      "check_ejection_safe_above_threshold",
      "FAIL",
      e instanceof Error ? e.message : String(e),
    );
  }

  try {
    let phaseGateOk = true;
    const details: string[] = [];
    for (const phase of HEALING_PHASE_ORDER) {
      const g = await getPhaseGateStatus(testUserId, phase, admin);
      const expected = PHASE_GATE_MAP[phase].length;
      const sum = g.completed + g.missing.length;
      const shapeOk =
        g.required === expected && sum === g.required && g.completion_pct >= 0 && g.completion_pct <= 1;
      if (!shapeOk) {
        phaseGateOk = false;
        details.push(`${phase}:required=${g.required} expected=${expected} sum=${sum}`);
      }
    }
    push(
      checks,
      runId,
      admin,
      "phase_gate_status_each_phase",
      phaseGateOk ? "PASS" : "FAIL",
      phaseGateOk ? undefined : details.join("; "),
    );
  } catch (e) {
    push(
      checks,
      runId,
      admin,
      "phase_gate_status_each_phase",
      "FAIL",
      e instanceof Error ? e.message : String(e),
    );
  }

  try {
    await liftEjection(testUserId, admin);
    push(
      checks,
      runId,
      admin,
      "lift_ejection_not_when_active",
      "FAIL",
      "liftEjection resolved but user should not be EJECTED",
    );
  } catch (e) {
    const code = (e as Error & { code?: string }).code;
    const pass = code === "not_ejected";
    push(
      checks,
      runId,
      admin,
      "lift_ejection_not_when_active",
      pass ? "PASS" : "FAIL",
      pass ? undefined : e instanceof Error ? e.message : String(e),
    );
  }

  const verifySub40Raw = process.env[LOOP_HEALTH_VERIFY_SUB40_AIR_ENV];
  const verifySub40 = verifySub40Raw === "1" || verifySub40Raw?.toLowerCase() === "true";
  if (verifySub40) {
    const already = await isUserArenaEjected(testUserId, admin);
    if (already) {
      push(
        checks,
        runId,
        admin,
        "check_ejection_sub40_live",
        "FAIL",
        "User already EJECTED before sub-40 check; use ACTIVE test user or skip LOOP_HEALTH_VERIFY_SUB40_AIR",
      );
    } else {
      try {
        const sub = await checkEjectionCondition(testUserId, {
          newAir: 0.35,
          now: new Date(),
          supabase: admin,
        });
        const pass = sub.ejectedNow === true && sub.reason === "air_below_40";
        push(
          checks,
          runId,
          admin,
          "check_ejection_sub40_live",
          pass ? "PASS" : "FAIL",
          pass
            ? undefined
            : `ejectedNow=${sub.ejectedNow} reason=${sub.reason} alreadyEjected=${sub.alreadyEjected}`,
        );
      } catch (e) {
        push(
          checks,
          runId,
          admin,
          "check_ejection_sub40_live",
          "FAIL",
          e instanceof Error ? e.message : String(e),
        );
      }
    }
  }

  const ejectedIncompleteId = process.env[LOOP_HEALTH_EJECTED_INCOMPLETE_GATES_USER_ID_ENV]?.trim();
  if (ejectedIncompleteId) {
    try {
      await liftEjection(ejectedIncompleteId, admin);
      push(
        checks,
        runId,
        admin,
        "lift_ejection_blocked_until_phase_complete",
        "FAIL",
        "liftEjection cleared ejection; expected center_phase_gate_incomplete for staged user",
      );
    } catch (e) {
      const code = (e as Error & { code?: string }).code;
      const pass = code === "center_phase_gate_incomplete";
      push(
        checks,
        runId,
        admin,
        "lift_ejection_blocked_until_phase_complete",
        pass ? "PASS" : "FAIL",
        pass ? undefined : e instanceof Error ? e.message : String(e),
      );
    }
  }

  const ok = checks.every((c) => c.status === "PASS");
  const finishedAt = new Date().toISOString();
  return { runId, ok, checks, startedAt, finishedAt };
}
