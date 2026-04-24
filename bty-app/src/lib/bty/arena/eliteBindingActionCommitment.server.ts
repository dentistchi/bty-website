/**
 * Elite binding: create open `bty_action_contracts` row when `meaning.is_action_commitment === true`
 * on Action Decision — distinct from pattern-threshold {@link ensureActionContractWithAdmin} (done-run gate).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { isCanonicalPatternFamily, normalizePatternFamilyId } from "@/domain/pattern-family";
import {
  loadArenaRunOwnerUserId,
  logActionContractActorTrace,
} from "@/lib/bty/action-contract/arenaRunActor.server";
import { getEliteScenarioById } from "@/lib/bty/arena/eliteScenariosCanonical.server";
import { isEliteChainScenarioId } from "@/lib/bty/arena/postLoginEliteEntry";

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
  },
): Promise<{ ok: boolean; contractId: string | null; created: boolean }> {
  const { userId, runId, dbScenarioId, patternFamilyRaw } = params;

  if (!isEliteChainScenarioId(dbScenarioId)) {
    return { ok: false, contractId: null, created: false };
  }

  const normalized = normalizePatternFamilyId(patternFamilyRaw ?? null);
  const patternFamilyForRow =
    normalized && isCanonicalPatternFamily(normalized) ? normalized : null;
  if (!patternFamilyForRow) {
    console.error("[elite_binding] action_commitment_missing_pattern_family", { runId, dbScenarioId });
    return { ok: false, contractId: null, created: false };
  }

  let elite: ReturnType<typeof getEliteScenarioById>;
  try {
    elite = getEliteScenarioById(dbScenarioId);
  } catch {
    return { ok: false, contractId: null, created: false };
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

  const spec = elite.action_contract;
  const description =
    typeof spec.description === "string" && spec.description.trim() !== ""
      ? spec.description.trim()
      : "Complete your committed leadership action from this session.";
  const hours =
    typeof spec.time_window_hours === "number" && Number.isFinite(spec.time_window_hours) && spec.time_window_hours > 0
      ? spec.time_window_hours
      : 48;

  const deadlineAt = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
  const chosenAt = new Date().toISOString();
  const actionId = `arena_action_loop:${runId}`;

  const { data: inserted, error: insErr } = await admin
    .from("bty_action_contracts")
    .insert({
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
    })
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
  }

  const reconciled = await loadContractIdByUserSession(admin, actorUserId, runId);
  if (reconciled) return { ok: true, contractId: reconciled, created: false };

  console.error("[elite_binding] action_commitment_insert_failed", {
    runId,
    dbScenarioId,
    message: insErr?.message ?? insErr,
  });
  return { ok: false, contractId: null, created: false };
}
