import type { SupabaseClient } from "@supabase/supabase-js";
import { currentSourceIdentity } from "./sourceIdentity";

/**
 * ACKNOWLEDGE ONE REPAIRED SYSTEM BLOCK. SERVER ONLY.
 * Slice Practice Generation System-Block Recovery V1.
 *
 * ★ WHAT THIS IS FOR. A completed system-block attempt stops further spending on a draft, and
 * `20260805050000` made that DRAFT-scoped on purpose rather than clearing it on deploy — its own
 * header says "the reviewer-repair slice must clear it explicitly". This is how that acknowledgement
 * is made: by a named platform admin, at a named time, against ONE named failure.
 *
 * ★ IT CHANGES NO HISTORY. The failed attempt is evidence and is never touched — no flag, no
 * outcome rewrite, no deletion. Recovery is a separate append-only row, so "generation failed under
 * this deploy" remains permanently true and auditable.
 *
 * ★ IT IS NOT A RETRY BUDGET. The admission clause is keyed on the attempt id, so recovering one
 * failure says nothing about a later one, and refusal counts are a different predicate this never
 * touches. A draft at its refusal limit stays limited.
 *
 * ★ EVERY ELIGIBILITY RULE IS IN THE RPC, not here. This function resolves the runtime identity,
 * hands the server-derived granter id across, and reports what governance says afterwards.
 */

export type RecoveryRefusal =
  | "source_identity_unavailable"
  | "fixed_deploy_sha_not_current"
  | "unknown_source_identity"
  | "invalid_fixed_deploy_sha"
  | "blocked_attempt_not_found"
  | "attempt_draft_mismatch"
  | "attempt_not_completed"
  | "attempt_not_system_block"
  | "source_identity_unchanged"
  | "support_reference_mismatch"
  | "missing_granter"
  | "missing_recovery_reason_code"
  | "recovery_failed";

export type RecoveryResult =
  | {
      ok: true;
      recoveryId: string;
      blockedAttemptId: string;
      draftId: string;
      grantedAt: string;
      alreadyRecovered: boolean;
      /** What admission says now. Null when it could not be read — never guessed. */
      governanceState: string | null;
      canStartGeneration: boolean | null;
    }
  | { ok: false; reason: RecoveryRefusal };

/** The RPC raises named errors; this maps them back without inventing one. */
const REFUSALS: readonly RecoveryRefusal[] = [
  "unknown_source_identity",
  "invalid_fixed_deploy_sha",
  "fixed_deploy_sha_not_current",
  "blocked_attempt_not_found",
  "attempt_draft_mismatch",
  "attempt_not_completed",
  "attempt_not_system_block",
  "source_identity_unchanged",
  "support_reference_mismatch",
  "missing_granter",
  "missing_recovery_reason_code",
];

function refusalFrom(message: unknown): RecoveryRefusal {
  const text = typeof message === "string" ? message : "";
  return REFUSALS.find((code) => text.includes(code)) ?? "recovery_failed";
}

export async function recoverPracticeGenerationSystemBlock(
  admin: SupabaseClient,
  input: {
    draftId: string;
    blockedAttemptId: string;
    /** SERVER-DERIVED from the admin session. Never read from the request body. */
    grantedByUserId: string;
    recoveryReasonCode: string;
    fixedInDeploySha: string;
    supportReference?: string | null;
  },
): Promise<RecoveryResult> {
  /*
    FAIL CLOSED ON AN UNKNOWN RUNTIME. Without a source identity we cannot tell whether anything
    changed since the failure, and not knowing must never be treated as fine. This is the same
    resolver the generation path uses, so recovery and generation can never disagree about which
    build they are on.
  */
  const identity = currentSourceIdentity();
  if (!identity?.sourceCommitSha) return { ok: false, reason: "source_identity_unavailable" };

  const { data, error } = await admin.rpc("recover_foundry_practice_generation_system_block_v1", {
    p_draft_id: input.draftId,
    p_blocked_attempt_id: input.blockedAttemptId,
    p_granted_by_user_id: input.grantedByUserId,
    p_recovery_reason_code: input.recoveryReasonCode,
    p_fixed_in_deploy_sha: input.fixedInDeploySha,
    p_current_deploy_sha: identity.sourceCommitSha,
    p_support_reference: input.supportReference ?? null,
  });

  if (error) {
    // The code alone is a breadcrumb; an unrestricted database string never travels to an operator.
    console.error(`[practiceGenRecovery] refused code=${(error as { code?: string }).code ?? "unknown"}`);
    return { ok: false, reason: refusalFrom((error as { message?: string }).message) };
  }

  const row = (Array.isArray(data) ? data[0] : data) as
    | { recovery_id?: string; recovered_attempt_id?: string; recovered_draft_id?: string; recovered_at?: string; already_recovered?: boolean }
    | null;
  if (!row?.recovery_id) return { ok: false, reason: "recovery_failed" };

  const governance = await readGovernanceAfterRecovery(admin, input.draftId, input.blockedAttemptId);

  return {
    ok: true,
    recoveryId: row.recovery_id,
    blockedAttemptId: row.recovered_attempt_id ?? input.blockedAttemptId,
    draftId: row.recovered_draft_id ?? input.draftId,
    grantedAt: row.recovered_at ?? new Date().toISOString(),
    alreadyRecovered: row.already_recovered === true,
    governanceState: governance.state,
    canStartGeneration: governance.canStart,
  };
}

/**
 * What admission says now — read through the SAME function the Host's own screen reads, so an
 * operator is never told something the product would contradict.
 *
 * Additive: a failure here reports null rather than blocking or guessing. The recovery already
 * happened and is durable; this is only the confirmation shown alongside it.
 */
async function readGovernanceAfterRecovery(
  admin: SupabaseClient,
  draftId: string,
  blockedAttemptId: string,
): Promise<{ state: string | null; canStart: boolean | null }> {
  try {
    const { data: draft } = await admin
      .from("foundry_arena_scenario_drafts")
      .select("owner_user_id")
      .eq("id", draftId)
      .maybeSingle<{ owner_user_id: string }>();
    if (!draft?.owner_user_id) return { state: null, canStart: null };

    // The locale the blocked attempt ran in, so the read matches the failure being recovered.
    const { data: attempt } = await admin
      .from("foundry_practice_generation_attempts")
      .select("locale")
      .eq("id", blockedAttemptId)
      .maybeSingle<{ locale: string | null }>();
    const locale = attempt?.locale === "ko" ? "ko" : "en";

    const { data, error } = await admin.rpc("get_foundry_practice_generation_governance_v1", {
      p_draft_id: draftId,
      p_owner_user_id: draft.owner_user_id,
      p_locale: locale,
    });
    if (error) return { state: null, canStart: null };
    const row = (Array.isArray(data) ? data[0] : data) as
      | { state?: string; can_start_generation?: boolean }
      | null;
    return { state: row?.state ?? null, canStart: row?.can_start_generation ?? null };
  } catch {
    return { state: null, canStart: null };
  }
}
