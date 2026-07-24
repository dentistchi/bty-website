/**
 * Action Review Decision — canonical server command (Slice 3.1B-3N-5C).
 *
 * ONE server-side command for the two reviewer decisions (approve | request_revision).
 * Order (Commander Refinement A):
 *   1. Validate decision + revision note (pure domain policy).
 *   2. Re-resolve authority via resolveActionReviewAuthority immediately before mutating
 *      (defense in depth — the RPC ALSO revalidates the edge from DB truth).
 *   3. Call the atomic SECURITY DEFINER RPC bty_resolve_action_review: it locks the
 *      contract, confirms status='submitted' + verified_at NULL + reviewable mode,
 *      derives reviewer/learner memberships from DB truth, revalidates the ACTION_REVIEWER
 *      edge, compare-and-sets the transition, and writes exactly one immutable audit row.
 *   4. Side-effect gate (Refinement C): the verified-completion chain (Run complete_verified
 *      + Level + XP + AIR) runs ONLY when transition_applied === true AND decision === approve.
 *      Every effect is per-run/per-contract idempotent (Option 2 hardening).
 *
 * NO authority decision relies on queue membership, prior detail data, client-held ids,
 * cached reviewer state, prior identity, hidden fields, or an enabled button. Reviewer /
 * learner membership ids are NEVER accepted from the caller.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  validateActionReviewDecisionInput,
  type ActionReviewDecisionKind,
} from "@/domain/arena/actionReviewDecision";
import { resolveActionReviewAuthority } from "@/lib/bty/arena/actionReviewAuthorityResolver.server";
import { completeArenaRunAfterContractVerification } from "@/lib/bty/action-contract/actionContractLifecycle.server";
import { onArenaRunCompleteVerified } from "@/lib/bty/level-engine/arenaLevelRecords";
import {
  applyArenaRunRewardsOnVerifiedCompletion,
  reflectContractVerificationToAir,
} from "@/lib/bty/arena/reflectionRewards.server";

export type ActionReviewDecisionResult =
  | {
      ok: true;
      decision: ActionReviewDecisionKind;
      previousStatus: string;
      resultingStatus: string;
      reviewedAt: string | null;
      revisionNote: string | null;
      decisionAuditId: string | null;
      /** True when APPROVE actually completed the run + applied verified effects. */
      completionApplied: boolean;
    }
  | {
      ok: false;
      /**
       * invalid_decision / note_required / note_too_long → 400/422 (client-fixable);
       * unauthorized → 404 generic (existence never leaked, no reason exposed);
       * already_resolved / not_found → 409/404 stale (re-read canonical truth);
       * server_error → 500.
       */
      code:
        | "invalid_decision"
        | "note_required"
        | "note_too_long"
        | "unauthorized"
        | "already_resolved"
        | "not_found"
        | "unsupported_source"
        | "server_error";
      currentStatus?: string | null;
    };

/**
 * Server-recognized contract sources for Action Review (5C.3). `action_type` is the
 * AUTHORITATIVE, server-authored discriminator — never inferred from run_id/session_id and
 * never trusted from the client. An unsupported source fails closed BEFORE any mutation.
 */
const SUPPORTED_ACTION_TYPES = new Set(["arena_run_completion", "field_action"]);
const ARENA_ACTION_TYPE = "arena_run_completion";

type ReviewRpcRow = {
  transition_applied: boolean;
  stale_reason: string | null;
  decision: string;
  previous_status: string | null;
  resulting_status: string | null;
  reviewed_at: string | null;
  revision_note: string | null;
  decision_audit_id: string | null;
  learner_user_id: string | null;
  verification_mode: string | null;
  contract_run_id: string | null;
  contract_session_id: string | null;
  arena_scenario_id: string | null;
  le_activation_type: string | null;
  weight: number | null;
  chosen_at: string | null;
  deadline_at: string | null;
};

/**
 * APPROVE completion chain — mirrors qr/validate's awaitingVerification branch. Runs ONLY
 * after the RPC actually won the transition. Each effect is per-run/per-contract idempotent,
 * so even a duplicate/concurrent path cannot double-reward. Best-effort: a downstream failure
 * is logged but does not un-approve the (already committed, audited) contract transition.
 */
async function applyApproveCompletionEffects(
  admin: SupabaseClient,
  /** The LEARNER (run/XP/AIR/Level owner) — NOT the Host actor. */
  userId: string,
  row: ReviewRpcRow,
  contractId: string,
): Promise<void> {
  const runId =
    (typeof row.contract_run_id === "string" && row.contract_run_id.trim() !== ""
      ? row.contract_run_id.trim()
      : "") ||
    (typeof row.contract_session_id === "string" && row.contract_session_id.trim() !== ""
      ? row.contract_session_id.trim()
      : "");
  const verifiedAtIso = row.reviewed_at ?? new Date().toISOString();

  if (!runId) {
    console.error("[action_review_decision] approve completion skipped — no run id", {
      contractId,
    });
    return;
  }

  const finalized = await completeArenaRunAfterContractVerification(admin, {
    userId,
    runId,
    verifiedAtIso,
  });
  if (!finalized.runUpdated) {
    console.error("[action_review_decision] arena_runs completion after approve failed", {
      contractId,
      runId,
    });
  }

  const levelRes = await onArenaRunCompleteVerified(admin, userId, runId);
  if (!levelRes.ok) {
    console.error("[action_review_decision] level effect after approve failed", levelRes.error);
  }

  const reward = await applyArenaRunRewardsOnVerifiedCompletion({
    supabase: admin,
    userId,
    run: {
      run_id: runId,
      scenario_id:
        typeof row.arena_scenario_id === "string" ? row.arena_scenario_id : null,
    },
  });
  if (!reward.ok) {
    console.error("[action_review_decision] XP reward after approve failed", reward.error);
  }

  const airReflection = await reflectContractVerificationToAir({
    supabase: admin,
    userId,
    runId,
    contractId,
    method: "host_review_approval",
    verifiedAtIso,
    activationType:
      typeof row.le_activation_type === "string" ? row.le_activation_type : null,
    weight: typeof row.weight === "number" ? row.weight : null,
    chosenAtIso: typeof row.chosen_at === "string" ? row.chosen_at : null,
    dueAtIso: typeof row.deadline_at === "string" ? row.deadline_at : null,
  });
  if (!airReflection.ok) {
    console.error("[action_review_decision] AIR reflection after approve failed", airReflection.error);
  }
}

export async function resolveActionReviewDecision(
  admin: SupabaseClient,
  input: {
    actorUserId: string;
    actionContractId: string;
    decision: string;
    revisionNote?: string | null;
  },
  options?: { now?: Date },
): Promise<ActionReviewDecisionResult> {
  const actorUserId = typeof input.actorUserId === "string" ? input.actorUserId.trim() : "";
  const actionContractId =
    typeof input.actionContractId === "string" ? input.actionContractId.trim() : "";

  // 1. Pure input policy (decision + revision note).
  const validated = validateActionReviewDecisionInput({
    decision: input.decision,
    revisionNote: input.revisionNote ?? null,
  });
  if (!validated.ok) {
    if (validated.reason === "INVALID_DECISION") return { ok: false, code: "invalid_decision" };
    if (validated.reason === "NOTE_REQUIRED") return { ok: false, code: "note_required" };
    return { ok: false, code: "note_too_long" };
  }

  if (!actorUserId || !actionContractId) {
    return { ok: false, code: "unauthorized" };
  }

  // 2. Authority recheck immediately before mutation (defense in depth with the RPC).
  const authority = await resolveActionReviewAuthority(
    admin,
    { actorUserId, actionContractId },
    { now: options?.now },
  );
  if (!authority.allowed) {
    return { ok: false, code: "unauthorized" };
  }

  // 2b. Source-aware precheck (5C.3): load the canonical action_type from server truth and
  // fail closed on an unsupported source BEFORE calling the RPC — no status change, no audit,
  // no effects. Approve effects are later dispatched by THIS server-measured source, never the
  // client's. (Arena approval keeps the full 5C chain; field_action gets none.)
  const { data: srcRow, error: srcErr } = await admin
    .from("bty_action_contracts")
    .select("action_type")
    .eq("id", actionContractId)
    .maybeSingle();
  if (srcErr) return { ok: false, code: "server_error" };
  const actionType =
    typeof (srcRow as { action_type?: string } | null)?.action_type === "string"
      ? (srcRow as { action_type: string }).action_type
      : null;
  if (actionType == null) return { ok: false, code: "not_found", currentStatus: null };
  if (!SUPPORTED_ACTION_TYPES.has(actionType)) {
    console.error("[action_review_decision] unsupported action_type — fail closed", {
      contract: actionContractId.slice(0, 8),
      actionType,
    });
    return { ok: false, code: "unsupported_source" };
  }

  // 3. Canonical atomic transition + audit (authority revalidated inside the RPC too).
  const { data, error } = await admin.rpc("bty_resolve_action_review", {
    p_action_contract_id: actionContractId,
    p_actor_user_id: actorUserId,
    p_decision: validated.decision,
    p_revision_note: validated.revisionNote,
  });

  if (error) {
    // The RPC raises for hard policy violations (self-review, bad note, invalid decision).
    console.error("[action_review_decision] rpc error", {
      contract: actionContractId.slice(0, 8),
      message: error.message,
    });
    const msg = String(error.message ?? "");
    if (msg.includes("action_review_note_required")) return { ok: false, code: "note_required" };
    if (msg.includes("action_review_note_too_long")) return { ok: false, code: "note_too_long" };
    if (msg.includes("action_review_invalid_decision")) return { ok: false, code: "invalid_decision" };
    if (msg.includes("action_review_self_forbidden")) return { ok: false, code: "unauthorized" };
    return { ok: false, code: "server_error" };
  }

  const row = (Array.isArray(data) ? data[0] : data) as ReviewRpcRow | null;
  if (!row) {
    return { ok: false, code: "server_error" };
  }

  if (!row.transition_applied) {
    // 4b. Stale / already resolved / unauthorized / not found — no side effects.
    const reason = row.stale_reason ?? "already_resolved";
    if (reason === "not_found") return { ok: false, code: "not_found", currentStatus: null };
    if (reason === "unauthorized" || reason === "ambiguous_authority") {
      return { ok: false, code: "unauthorized" };
    }
    return { ok: false, code: "already_resolved", currentStatus: row.resulting_status ?? null };
  }

  // 4a. SOURCE-AWARE effect dispatch (5C.3), on applied APPROVE only:
  //   arena_run_completion → full existing Arena verified-completion chain (LEARNER-scoped).
  //   field_action        → NO Arena effects at all. The approved contract state + verified_at
  //                         + the immutable Host decision audit ARE the canonical Field Action
  //                         evidence. No arena_runs completion, no Level sentinel/increment, no
  //                         Weekly/Core Arena XP, no le_activation_log/le_verification_log (AIR).
  let completionApplied = false;
  if (validated.decision === "approve" && actionType === ARENA_ACTION_TYPE) {
    const learnerUserId =
      typeof row.learner_user_id === "string" && row.learner_user_id.trim() !== ""
        ? row.learner_user_id.trim()
        : "";
    if (learnerUserId) {
      await applyApproveCompletionEffects(admin, learnerUserId, row, actionContractId);
      completionApplied = true;
    } else {
      console.error("[action_review_decision] approve completion skipped — no learner id", {
        contract: actionContractId.slice(0, 8),
      });
    }
  }

  return {
    ok: true,
    decision: validated.decision,
    previousStatus: row.previous_status ?? "submitted",
    resultingStatus: row.resulting_status ?? (validated.decision === "approve" ? "approved" : "rejected"),
    reviewedAt: row.reviewed_at ?? null,
    revisionNote: row.revision_note ?? null,
    decisionAuditId: row.decision_audit_id ?? null,
    completionApplied,
  };
}
