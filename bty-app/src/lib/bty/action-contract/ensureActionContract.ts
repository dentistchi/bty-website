/**
 * Recoverable compensation: idempotent Action Contract row for a completed Arena run.
 * Uses `user_id` + `session_id` (= run_id) per `bty_action_contracts` schema.
 *
 * Identifiers:
 * - **contract row id** — UUID from `gen_random_uuid()` on insert; returned as `contractId`.
 * - **`action_id` (DB)** — same logical id as QR: `arena_action_loop:${runId}` (see `signArenaActionLoopToken`).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  type CanonicalPatternFamily,
  isCanonicalPatternFamily,
  normalizePatternFamilyId,
} from "@/domain/pattern-family";
import {
  loadArenaRunOwnerUserId,
  logActionContractActorTrace,
} from "@/lib/bty/action-contract/arenaRunActor.server";

/** Bundled elite copy (extend as elite catalog ships). Used by tests + production IDs. */
export const BUNDLED_ELITE_ACTION_CONTRACT_FIXTURE: Record<
  string,
  { description: string; time_window_hours: number }
> = {
  elite_bundled_fixture_001: {
    description: "Elite fixture: complete your committed leadership action from this session.",
    time_window_hours: 72,
  },
};

export function getBundledEliteScenarioById(scenarioId: string): {
  action_contract: { description: string; time_window_hours: number };
} | null {
  const spec = BUNDLED_ELITE_ACTION_CONTRACT_FIXTURE[scenarioId];
  if (!spec) return null;
  return { action_contract: spec };
}

const DEFAULT_DESCRIPTION =
  "Complete your committed leadership action from this session.";
const DEFAULT_WINDOW_HOURS = 48 as const;

/** Synthetic scenario ids from pool rotation (same prefixes as scenario router). */
const MIRROR_SCENARIO_ID_PREFIX = "mirror:" as const;
const PERSPECTIVE_SWITCH_SCENARIO_PREFIX = "pswitch_" as const;

export type ActionContractSpecSource = "elite" | "mirror" | "perspective_switch" | "default";

/**
 * Window + copy for a contract row. `mirror:` / `pswitch_*` never match elite fixtures — they use defaults
 * (elite lookup null does **not** mean contract insert is skipped or `contractId` is null).
 */
export function resolveActionContractSpecForScenario(scenarioId: string): {
  description: string;
  time_window_hours: number;
  source: ActionContractSpecSource;
} {
  const trimmed = typeof scenarioId === "string" ? scenarioId.trim() : "";
  if (!trimmed) {
    return {
      description: DEFAULT_DESCRIPTION,
      time_window_hours: DEFAULT_WINDOW_HOURS,
      source: "default",
    };
  }
  if (trimmed.startsWith(MIRROR_SCENARIO_ID_PREFIX)) {
    return {
      description: DEFAULT_DESCRIPTION,
      time_window_hours: DEFAULT_WINDOW_HOURS,
      source: "mirror",
    };
  }
  if (trimmed.startsWith(PERSPECTIVE_SWITCH_SCENARIO_PREFIX)) {
    return {
      description: DEFAULT_DESCRIPTION,
      time_window_hours: DEFAULT_WINDOW_HOURS,
      source: "perspective_switch",
    };
  }
  const elite = getBundledEliteScenarioById(trimmed);
  if (elite) {
    return {
      description: elite.action_contract.description,
      time_window_hours: elite.action_contract.time_window_hours,
      source: "elite",
    };
  }
  return {
    description: DEFAULT_DESCRIPTION,
    time_window_hours: DEFAULT_WINDOW_HOURS,
    source: "default",
  };
}

const PATTERN_ACTION_DEFAULT_WINDOW_HOURS = 72 as const;

/**
 * Contract seed copy + window when a row is created at pattern exit threshold (ENGINE §5).
 * QR / execution verification references the same committed action text downstream.
 */
export function resolveActionContractSpecForPatternFamily(family: CanonicalPatternFamily): {
  description: string;
  time_window_hours: number;
} {
  const descriptions: Record<CanonicalPatternFamily, string> = {
    ownership_escape:
      "Take one concrete ownership action tied to this pattern—name the decision you will own and when it will be done (verify via QR when executed).",
    repair_avoidance:
      "Close one repair you have been deferring: schedule the conversation or send the message this week (verify via QR when executed).",
    explanation_substitution:
      "Replace one explanation loop with a direct commitment: state the ask, the owner, and the deadline (verify via QR when executed).",
    delegation_deflection:
      "Reclaim one delegated item: name the task, the decision only you can make, and the handoff you will complete (verify via QR when executed).",
    future_deferral:
      "Collapse one future deferral into a dated next step on your calendar—no new promises without a timebox (verify via QR when executed).",
  };
  return {
    description: descriptions[family],
    time_window_hours: PATTERN_ACTION_DEFAULT_WINDOW_HOURS,
  };
}

async function loadContractIdByUserSession(
  admin: SupabaseClient,
  userId: string,
  sessionId: string,
): Promise<string | null> {
  const { data, error } = await admin
    .from("bty_action_contracts")
    .select("id")
    .eq("user_id", userId)
    .eq("session_id", sessionId)
    .maybeSingle();

  if (error) {
    console.error("[ensureActionContract] RECONCILE_SELECT_FAILED", {
      userId,
      sessionId,
      error: error.message,
    });
    return null;
  }
  const id = (data as { id?: string } | null)?.id;
  return typeof id === "string" && id.length > 0 ? id : null;
}

/** Service-role insert/select; pass admin from `getSupabaseAdmin()`. */
export async function ensureActionContractWithAdmin(
  admin: SupabaseClient,
  params: {
    userId: string;
    runId: string;
    scenarioId: string;
    nbaLogId: string | null;
    /** When set, ENGINE §5 rule 4 — no second open contract for same family. */
    patternFamily?: string | null;
  },
): Promise<{
  ok: boolean;
  contractId: string | null;
  created: boolean;
}> {
  void params.nbaLogId;

  const runOwnerUserId = await loadArenaRunOwnerUserId(admin, params.runId);
  if (!runOwnerUserId) {
    console.error("[ensureActionContract] run_not_found_for_contract", {
      runId: params.runId,
      incoming_actor_user_id: params.userId,
    });
    return { ok: false, contractId: null, created: false };
  }
  const actorUserId = runOwnerUserId;
  if (actorUserId !== params.userId) {
    logActionContractActorTrace("ensureActionContractWithAdmin", {
      incoming_actor_user_id: params.userId,
      source_run_id: params.runId,
      resolved_run_owner_user_id: actorUserId,
      resolved_auth_user_id: params.userId,
    });
  }

  const normalizedFamily = normalizePatternFamilyId(params.patternFamily ?? null);
  const patternFamilyForRow =
    normalizedFamily && isCanonicalPatternFamily(normalizedFamily) ? normalizedFamily : null;

  if (patternFamilyForRow) {
    const { data: openRow, error: openErr } = await admin
      .from("bty_action_contracts")
      .select("id")
      .eq("user_id", actorUserId)
      .eq("pattern_family", patternFamilyForRow)
      .in("status", ["pending", "submitted", "escalated"])
      .maybeSingle();
    if (openErr) {
      console.error("[ensureActionContract] open_contract_check_failed", openErr.message);
      return { ok: false, contractId: null, created: false };
    }
    if (openRow) {
      console.warn("[ensureActionContract] re_trigger_blocked_for_family", {
        userId: actorUserId,
        pattern_family: patternFamilyForRow,
      });
      return { ok: false, contractId: null, created: false };
    }
  }

  const { data: existing, error: selErr } = await admin
    .from("bty_action_contracts")
    .select("id, status")
    .eq("user_id", actorUserId)
    .eq("session_id", params.runId)
    .maybeSingle();

  if (selErr) {
    console.error("[ensureActionContract] SELECT_FAILED", {
      userId: actorUserId,
      runId: params.runId,
      error: selErr.message,
    });
    return { ok: false, contractId: null, created: false };
  }

  const existingId = (existing as { id?: string } | null)?.id;
  if (typeof existingId === "string" && existingId.length > 0) {
    return { ok: true, contractId: existingId, created: false };
  }

  if (!patternFamilyForRow) {
    return { ok: true, contractId: null, created: false };
  }

  /** Product guard: pattern threshold alone is not enough — require at least two completed Arena runs. */
  const { count: doneArenaRuns, error: doneCntErr } = await admin
    .from("arena_runs")
    .select("run_id", { count: "exact", head: true })
    .eq("user_id", actorUserId)
    .eq("status", "DONE");
  if (doneCntErr) {
    console.error("[ensureActionContract] done_run_count_failed", { error: doneCntErr.message });
    return { ok: false, contractId: null, created: false };
  }
  if ((doneArenaRuns ?? 0) < 2) {
    return { ok: true, contractId: null, created: false };
  }

  const actionContractSpec = resolveActionContractSpecForPatternFamily(patternFamilyForRow);

  const deadlineAt = new Date(
    Date.now() + actionContractSpec.time_window_hours * 60 * 60 * 1000,
  ).toISOString();

  const chosenAt = new Date().toISOString();
  const actionId = `arena_action_loop:${params.runId}`;

  const { data: inserted, error: insErr } = await admin
    .from("bty_action_contracts")
    .insert({
      user_id: actorUserId,
      session_id: params.runId,
      run_id: params.runId,
      contract_description: actionContractSpec.description,
      deadline_at: deadlineAt,
      verification_mode: "hybrid",
      status: "pending",
      required: false,
      action_id: actionId,
      action_type: "arena_run_completion",
      le_activation_type: "micro_win",
      verification_type: "hybrid",
      weight: 1.0,
      mode: "arena",
      chosen_at: chosenAt,
      pattern_family: patternFamilyForRow,
    })
    .select("id")
    .single();

  if (!insErr && inserted && typeof (inserted as { id?: string }).id === "string") {
    logActionContractActorTrace("ensureActionContractWithAdmin", {
      incoming_actor_user_id: params.userId,
      source_run_id: params.runId,
      resolved_run_owner_user_id: actorUserId,
      inserted_bty_action_contracts_user_id: actorUserId,
    });
    return {
      ok: true,
      contractId: (inserted as { id: string }).id,
      created: true,
    };
  }

  // Insert may have committed but `.single()` returned no row (client/RLS edge) — reconcile before failing.
  if (!insErr) {
    const reconciled = await loadContractIdByUserSession(admin, actorUserId, params.runId);
    if (reconciled) {
      return { ok: true, contractId: reconciled, created: false };
    }
  }

  const code = (insErr as { code?: string } | null)?.code;
  if (code === "23505") {
    const rid = await loadContractIdByUserSession(admin, actorUserId, params.runId);
    if (rid) {
      return { ok: true, contractId: rid, created: false };
    }
  }

  const afterError = await loadContractIdByUserSession(admin, actorUserId, params.runId);
  if (afterError) {
    return { ok: true, contractId: afterError, created: false };
  }

  console.error("[ensureActionContract] PERSIST_FAILED", {
    userId: actorUserId,
    runId: params.runId,
    scenarioId: params.scenarioId,
    pattern_family: patternFamilyForRow,
    error: insErr?.message ?? insErr,
  });
  return { ok: false, contractId: null, created: false };
}
