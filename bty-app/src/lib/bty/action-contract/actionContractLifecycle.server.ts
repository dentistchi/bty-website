/**
 * Action contract draft lifecycle — draft rows only when pattern exit threshold is met (same gate as ensureActionContract).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { isCanonicalPatternFamily, normalizePatternFamilyId } from "@/domain/pattern-family";
import { resolveActionContractSpecForPatternFamily } from "@/lib/bty/action-contract/ensureActionContract";

const ENSURE_DRAFT_LOG_PREFIX = "[ensureDraftActionContractWithAdmin]";

/** Same run as `sessionId` (arena run id) even if `(user_id, session_id)` lookup missed the row. */
function isSameArenaSessionContractRow(
  row: { session_id?: unknown; action_id?: unknown },
  sessionId: string,
): boolean {
  const sid = typeof row.session_id === "string" ? row.session_id.trim() : "";
  if (sid !== "" && sid === sessionId.trim()) return true;
  const expectedAction = `arena_action_loop:${sessionId.trim()}`;
  const aid = typeof row.action_id === "string" ? row.action_id.trim() : "";
  return aid !== "" && aid === expectedAction;
}

type PgLikeError = {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
};

function pickPgErrorFields(e: PgLikeError | null | undefined): {
  supabaseMessage: string | null;
  supabaseCode: string | null;
  supabaseDetails: string | null;
  supabaseHint: string | null;
} {
  if (!e) {
    return {
      supabaseMessage: null,
      supabaseCode: null,
      supabaseDetails: null,
      supabaseHint: null,
    };
  }
  return {
    supabaseMessage: e.message ?? null,
    supabaseCode: e.code ?? null,
    supabaseDetails: e.details ?? null,
    supabaseHint: e.hint ?? null,
  };
}

export function logActionContractLifecycle(
  op: string,
  fields: { contractId?: string; userId?: string; scenarioId?: string },
): void {
  console.log("[action_contract]", {
    op,
    contractId: fields.contractId ?? null,
    userId: fields.userId ?? null,
    scenarioId: fields.scenarioId ?? null,
  });
}

export type EnsureDraftActionContractResult =
  | { ok: true; contractId: string | null; created: boolean }
  | {
      ok: false;
      error: "load_failed" | "family_check_failed" | "open_contract_exists_for_family" | "insert_failed";
      failedStep:
        | "existing_select"
        | "family_open_select"
        | "reconcile_session_select"
        | "open_contract_same_family"
        | "insert";
      supabaseMessage: string | null;
      supabaseCode: string | null;
      supabaseDetails: string | null;
      supabaseHint: string | null;
    };

export async function loadContractForUser(
  supabase: SupabaseClient,
  contractId: string,
  userId: string,
): Promise<{
  id: string;
  status: string;
  user_id: string;
} | null> {
  const { data, error } = await supabase
    .from("bty_action_contracts")
    .select("id, status, user_id")
    .eq("id", contractId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("[action_contract] loadContractForUser", error.message);
    return null;
  }
  if (!data) return null;
  return data as { id: string; status: string; user_id: string };
}

/**
 * Idempotent: returns existing row id for (user_id, session_id) if any; else inserts draft only when threshold family is resolved.
 */
export async function ensureDraftActionContractWithAdmin(
  admin: SupabaseClient,
  params: {
    userId: string;
    sessionId: string;
    scenarioId: string;
    primaryChoice: string;
    patternFamily: string | null;
  },
): Promise<EnsureDraftActionContractResult> {
  const { userId, sessionId, scenarioId, primaryChoice } = params;

  const { data: existing, error: selErr } = await admin
    .from("bty_action_contracts")
    .select("id, status")
    .eq("user_id", userId)
    .eq("session_id", sessionId)
    .maybeSingle();

  if (selErr) {
    const pg = pickPgErrorFields(selErr);
    console.error(`${ENSURE_DRAFT_LOG_PREFIX} existing_select failed`, {
      failedStep: "existing_select",
      ...pg,
      userId,
      sessionId,
    });
    return {
      ok: false,
      error: "load_failed",
      failedStep: "existing_select",
      ...pg,
    };
  }

  const existingId = (existing as { id?: string } | null)?.id;
  if (typeof existingId === "string" && existingId.length > 0) {
    logActionContractLifecycle("draft_ensure_existing", {
      contractId: existingId,
      userId,
      scenarioId,
    });
    return { ok: true, contractId: existingId, created: false };
  }

  const normalizedFamily = normalizePatternFamilyId(params.patternFamily ?? null);
  const patternFamilyForRow =
    normalizedFamily && isCanonicalPatternFamily(normalizedFamily) ? normalizedFamily : null;

  if (!patternFamilyForRow) {
    return { ok: true, contractId: null, created: false };
  }

  const { data: openRow, error: openErr } = await admin
    .from("bty_action_contracts")
    .select("id, session_id, action_id")
    .eq("user_id", userId)
    .eq("pattern_family", patternFamilyForRow)
    .in("status", ["draft", "committed", "pending", "submitted", "escalated"])
    .maybeSingle();
  if (openErr) {
    const pg = pickPgErrorFields(openErr);
    console.error(`${ENSURE_DRAFT_LOG_PREFIX} family_open_select failed`, {
      failedStep: "family_open_select",
      ...pg,
      userId,
      pattern_family: patternFamilyForRow,
    });
    return {
      ok: false,
      error: "family_check_failed",
      failedStep: "family_open_select",
      ...pg,
    };
  }
  if (openRow) {
    const row = openRow as { id?: string; session_id?: unknown; action_id?: unknown };
    const conflictingId = row.id ?? null;
    if (isSameArenaSessionContractRow(row, sessionId) && typeof conflictingId === "string" && conflictingId.length > 0) {
      logActionContractLifecycle("draft_ensure_reuse_open_family_same_session", {
        contractId: conflictingId,
        userId,
        scenarioId,
      });
      return { ok: true, contractId: conflictingId, created: false };
    }
    const { data: reconcileSession, error: recErr } = await admin
      .from("bty_action_contracts")
      .select("id")
      .eq("user_id", userId)
      .eq("session_id", sessionId)
      .maybeSingle();
    if (recErr) {
      const pg = pickPgErrorFields(recErr);
      console.error(`${ENSURE_DRAFT_LOG_PREFIX} reconcile_session_after_family_hit failed`, {
        failedStep: "reconcile_session_select",
        ...pg,
        userId,
        sessionId,
      });
      return {
        ok: false,
        error: "load_failed",
        failedStep: "reconcile_session_select",
        ...pg,
      };
    }
    const reconciledId = (reconcileSession as { id?: string } | null)?.id;
    if (typeof reconciledId === "string" && reconciledId.length > 0) {
      logActionContractLifecycle("draft_ensure_reconcile_session_after_family_hit", {
        contractId: reconciledId,
        userId,
        scenarioId,
      });
      return { ok: true, contractId: reconciledId, created: false };
    }
    const pg = {
      supabaseMessage: "Open pipeline contract already exists for this user and pattern_family",
      supabaseCode: null as string | null,
      supabaseDetails: conflictingId != null ? JSON.stringify({ conflictingContractId: conflictingId }) : null,
      supabaseHint: null as string | null,
    };
    console.warn(`${ENSURE_DRAFT_LOG_PREFIX} blocked_open_contract_same_family`, {
      failedStep: "open_contract_same_family",
      ...pg,
      userId,
      pattern_family: patternFamilyForRow,
    });
    return {
      ok: false,
      error: "open_contract_exists_for_family",
      failedStep: "open_contract_same_family",
      ...pg,
    };
  }

  const spec = resolveActionContractSpecForPatternFamily(patternFamilyForRow);
  const deadlineAt = new Date(Date.now() + spec.time_window_hours * 60 * 60 * 1000).toISOString();
  const chosenAt = new Date().toISOString();
  const actionId = `arena_action_loop:${sessionId}`;

  const { data: inserted, error: insErr } = await admin
    .from("bty_action_contracts")
    .insert({
      user_id: userId,
      session_id: sessionId,
      contract_description: spec.description,
      deadline_at: deadlineAt,
      verification_mode: "hybrid",
      status: "draft",
      required: false,
      action_id: actionId,
      action_type: "arena_run_completion",
      le_activation_type: "micro_win",
      verification_type: "hybrid",
      weight: 1.0,
      mode: "arena",
      chosen_at: chosenAt,
      arena_scenario_id: scenarioId,
      primary_choice_id: primaryChoice,
      pattern_family: patternFamilyForRow,
    })
    .select("id")
    .single();

  if (!insErr && inserted && typeof (inserted as { id?: string }).id === "string") {
    const id = (inserted as { id: string }).id;
    logActionContractLifecycle("draft_created", { contractId: id, userId, scenarioId });
    return { ok: true, contractId: id, created: true };
  }

  const code = (insErr as { code?: string } | null)?.code;
  if (code === "23505") {
    const { data: again } = await admin
      .from("bty_action_contracts")
      .select("id")
      .eq("user_id", userId)
      .eq("session_id", sessionId)
      .maybeSingle();
    const rid = (again as { id?: string } | null)?.id;
    if (typeof rid === "string" && rid.length > 0) {
      return { ok: true, contractId: rid, created: false };
    }
  }

  const insPg = pickPgErrorFields(insErr as PgLikeError | undefined);
  console.error(`${ENSURE_DRAFT_LOG_PREFIX} insert failed`, {
    failedStep: "insert",
    ...insPg,
    userId,
    scenarioId,
    sessionId,
    pattern_family: patternFamilyForRow,
  });
  return {
    ok: false,
    error: "insert_failed",
    failedStep: "insert",
    ...insPg,
  };
}
