/**
 * Elite binding: create open `bty_action_contracts` row when `meaning.is_action_commitment === true`
 * on Action Decision — distinct from pattern-threshold {@link ensureActionContractWithAdmin} (done-run gate).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizePatternFamilyId } from "@/domain/pattern-family";
import {
  loadArenaRunOwnerUserId,
  logActionContractActorTrace,
} from "@/lib/bty/action-contract/arenaRunActor.server";
import { getEliteScenarioById } from "@/lib/bty/arena/eliteScenariosCanonical.server";
import { isEliteChainScenarioId } from "@/lib/bty/arena/postLoginEliteEntry";
import { getScenarioByDbId } from "@/data/scenario";

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
  if (error) return null;
  const id = (data as { id?: string } | null)?.id;
  return typeof id === "string" && id.length > 0 ? id : null;
}

async function loadContractIdByUserActionId(
  admin: SupabaseClient,
  userId: string,
  actionId: string,
): Promise<string | null> {
  const { data, error } = await admin
    .from("bty_action_contracts")
    .select("id")
    .eq("user_id", userId)
    .eq("action_id", actionId)
    .maybeSingle();
  if (error) return null;
  const id = (data as { id?: string } | null)?.id;
  return typeof id === "string" && id.length > 0 ? id : null;
}

async function loadOpenContractIdByPatternFamily(
  admin: SupabaseClient,
  userId: string,
  patternFamily: string,
): Promise<string | null> {
  const { data, error } = await admin
    .from("bty_action_contracts")
    .select("id, status")
    .eq("user_id", userId)
    .eq("pattern_family", patternFamily)
    .in("status", ["draft", "committed", "pending", "submitted", "escalated"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return null;
  const id = (data as { id?: string } | null)?.id;
  return typeof id === "string" && id.length > 0 ? id : null;
}

type EnsureContractFailureDetail = {
  code?: string | null;
  message?: string | null;
  hint?: string | null;
  details?: string | null;
  insert_payload?: {
    user_id: string;
    session_id: string;
    run_id: string;
    action_id: string;
    action_type: string;
    verification_type: string;
    verification_mode: string;
    status: string;
    pattern_family: string;
  };
};

/**
 * Idempotent insert for elite chain runs when the user commits to real-world action at Action Decision.
 */
export async function ensureEliteBindingActionCommitmentContract(
  admin: SupabaseClient,
  params: {
    userId: string;
    runId: string;
    dbScenarioId: string;
    /** From tradeoff (second tier) — required for canonical pattern_family on the row. */
    patternFamilyRaw: string | null | undefined;
    /** Action decision label from canonical content/adapter; used as contract description fallback. */
    actionLabelRaw?: string | null | undefined;
  },
): Promise<{ ok: boolean; contractId: string | null; created: boolean; detail?: EnsureContractFailureDetail }> {
  const { userId, runId, dbScenarioId, patternFamilyRaw } = params;

  const isEliteChainId = isEliteChainScenarioId(dbScenarioId);
  const canonicalScenario = !isEliteChainId ? getScenarioByDbId(dbScenarioId, "en") : null;
  if (!isEliteChainId && !canonicalScenario) {
    return { ok: false, contractId: null, created: false };
  }

  const normalized = normalizePatternFamilyId(patternFamilyRaw ?? null);
  const patternFamilyForRow = normalized ?? "unknown_pattern_family";

  let eliteSpec:
    | {
        description?: string | null;
        time_window_hours?: number | null;
      }
    | null = null;
  if (isEliteChainId) {
    try {
      const elite = getEliteScenarioById(dbScenarioId);
      eliteSpec = elite.action_contract;
    } catch {
      return { ok: false, contractId: null, created: false };
    }
  }

  const runOwnerUserId = await loadArenaRunOwnerUserId(admin, runId);
  if (!runOwnerUserId || runOwnerUserId !== userId) {
    console.error("[elite_binding] action_commitment_run_owner_mismatch", { runId, userId });
    return { ok: false, contractId: null, created: false };
  }
  const actorUserId = runOwnerUserId;

  const existingId = await loadContractIdByUserSession(admin, actorUserId, runId);
  if (existingId) {
    return { ok: true, contractId: existingId, created: false };
  }

  // Prevent duplicate contracts: if an open contract already exists for this pattern family
  // (e.g. status=submitted after QR scan), reuse it instead of creating a new pending one.
  // Mirrors the re_trigger_blocked guard in ensureActionContractWithAdmin.
  if (patternFamilyForRow && patternFamilyForRow !== "unknown_pattern_family") {
    const openFamilyId = await loadOpenContractIdByPatternFamily(admin, actorUserId, patternFamilyForRow);
    if (openFamilyId) {
      console.info("[elite_binding] open_contract_reuse_for_family", {
        userId: actorUserId,
        patternFamily: patternFamilyForRow,
        contractId: openFamilyId,
      });
      return { ok: true, contractId: openFamilyId, created: false };
    }
  }

  const actionLabel =
    typeof params.actionLabelRaw === "string" && params.actionLabelRaw.trim() !== ""
      ? params.actionLabelRaw.trim()
      : null;
  const spec = eliteSpec;
  const description =
    typeof actionLabel === "string" && actionLabel !== ""
      ? actionLabel
      : typeof spec?.description === "string" && spec.description.trim() !== ""
      ? spec.description.trim()
      : "Complete your committed leadership action from this session.";
  const hours =
    typeof spec?.time_window_hours === "number" &&
    Number.isFinite(spec.time_window_hours) &&
    spec.time_window_hours > 0
      ? spec.time_window_hours
      : 48;

  // If spec doesn't define a window, parse "Within N hours" from the action label.
  const labelHoursMatch = typeof params.actionLabelRaw === "string"
    ? /within\s+(\d+)\s+hours?/i.exec(params.actionLabelRaw)
    : null;
  const labelHours = labelHoursMatch ? parseInt(labelHoursMatch[1], 10) : null;
  const resolvedHours =
    hours !== 48 ? hours : (labelHours != null && labelHours > 0 && labelHours <= 168 ? labelHours : hours);
  const deadlineAt = new Date(Date.now() + resolvedHours * 60 * 60 * 1000).toISOString();
  const chosenAt = new Date().toISOString();
  const actionId = `arena_action_loop:${runId}`;
  const insertPayload = {
    user_id: actorUserId,
    session_id: runId,
    run_id: runId,
    contract_description: description,
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
  } as const;

  const { data: inserted, error: insErr } = await admin
    .from("bty_action_contracts")
    .insert(insertPayload)
    .select("id")
    .single();

  if (!insErr && inserted && typeof (inserted as { id?: string }).id === "string") {
    logActionContractActorTrace("ensureEliteBindingActionCommitmentContract", {
      incoming_actor_user_id: userId,
      source_run_id: runId,
      resolved_auth_user_id: userId,
      inserted_bty_action_contracts_user_id: actorUserId,
    });
    return { ok: true, contractId: (inserted as { id: string }).id, created: true };
  }

  const code = (insErr as { code?: string } | null)?.code;
  if (code === "23505") {
    const rid = await loadContractIdByUserSession(admin, actorUserId, runId);
    if (rid) return { ok: true, contractId: rid, created: false };
    const byActionId = await loadContractIdByUserActionId(admin, actorUserId, actionId);
    if (byActionId) return { ok: true, contractId: byActionId, created: false };
    const byPatternFamily = await loadOpenContractIdByPatternFamily(admin, actorUserId, patternFamilyForRow);
    if (byPatternFamily) return { ok: true, contractId: byPatternFamily, created: false };
  }

  const reconciled = await loadContractIdByUserSession(admin, actorUserId, runId);
  if (reconciled) return { ok: true, contractId: reconciled, created: false };

  console.error("[elite_binding] action_commitment_insert_failed", {
    runId,
    dbScenarioId,
    code: (insErr as { code?: string } | null)?.code ?? null,
    message: insErr?.message ?? insErr,
    detail: (insErr as { details?: string } | null)?.details ?? null,
    hint: (insErr as { hint?: string } | null)?.hint ?? null,
    insert_payload: {
      user_id: insertPayload.user_id,
      session_id: insertPayload.session_id,
      run_id: insertPayload.run_id,
      action_id: insertPayload.action_id,
      action_type: insertPayload.action_type,
      verification_type: insertPayload.verification_type,
      verification_mode: insertPayload.verification_mode,
      status: insertPayload.status,
      pattern_family: insertPayload.pattern_family,
    },
  });
  return {
    ok: false,
    contractId: null,
    created: false,
    detail: {
      code: (insErr as { code?: string } | null)?.code ?? null,
      message: (insErr as { message?: string } | null)?.message ?? null,
      hint: (insErr as { hint?: string } | null)?.hint ?? null,
      details: (insErr as { details?: string } | null)?.details ?? null,
      insert_payload: {
        user_id: insertPayload.user_id,
        session_id: insertPayload.session_id,
        run_id: insertPayload.run_id,
        action_id: insertPayload.action_id,
        action_type: insertPayload.action_type,
        verification_type: insertPayload.verification_type,
        verification_mode: insertPayload.verification_mode,
        status: insertPayload.status,
        pattern_family: insertPayload.pattern_family,
      },
    },
  };
}
