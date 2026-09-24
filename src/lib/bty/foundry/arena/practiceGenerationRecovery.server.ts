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
  | "blocked_attempt_source_identity_unavailable"
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
  "blocked_attempt_source_identity_unavailable",
  "source_identity_unchanged",
  "support_reference_mismatch",
  "missing_granter",
  "missing_recovery_reason_code",
];

function refusalFrom(message: unknown): RecoveryRefusal {
  const text = typeof message === "string" ? message : "";
  return REFUSALS.find((code) => text.includes(code)) ?? "recovery_failed";
}

export type RecoverableSystemBlock = {
  draftId: string;
  blockedAttemptId: string;
  outcome: string | null;
  terminalReasonCode: string | null;
  failedDeploySha: string | null;
  currentDeploySha: string;
};

export type RecoverableListResult =
  | { ok: true; recoverable: RecoverableSystemBlock[] }
  | { ok: false; reason: "source_identity_unavailable" | "discovery_failed" };

/** Build identity is an authorization fact here, not display text. */
const LOWER_SHA40 = /^[0-9a-f]{40}$/;

/**
 * WHICH SYSTEM BLOCKS ARE STILL WAITING TO BE ACKNOWLEDGED.
 *
 * ★ THE SET IS DEFINED IN SQL, NOT HERE. It comes from
 * `foundry_practice_generation_recoverable_blocks_v1`, which applies the same canonical
 * `is_system_block_v1` predicate the admission clause applies and excludes anything already
 * recovered. No terminal reason code is named in this file, so the vocabulary cannot fork between
 * what governance blocks and what an operator is offered.
 *
 * ★ IT CARRIES BUILD IDENTITY, NOT CONTENT. Ids, the classifying outcome, and the two shas. The
 * decision an operator makes is "may a repaired build try again", and nothing about the draft's
 * contents informs it.
 *
 * ★ AN UNKNOWN RUNTIME RETURNS NOTHING, NOT AN EMPTY LIST. Without a current sha there is no
 * recovery any of these rows could be authorized against, so offering them would be offering a
 * button that must refuse.
 */
export async function listRecoverableSystemBlocks(admin: SupabaseClient): Promise<RecoverableListResult> {
  const identity = currentSourceIdentity();
  if (!identity?.sourceCommitSha) return { ok: false, reason: "source_identity_unavailable" };

  const { data, error } = await admin.rpc("foundry_practice_generation_recoverable_blocks_v1");
  if (error) {
    console.error(`[practiceGenRecovery] discovery failed code=${(error as { code?: string }).code ?? "unknown"}`);
    return { ok: false, reason: "discovery_failed" };
  }

  const rows = Array.isArray(data) ? data : [];
  return {
    ok: true,
    recoverable: rows.flatMap((raw) => {
      const r = raw as {
        recoverable_draft_id?: string;
        recoverable_attempt_id?: string;
        recoverable_outcome?: string | null;
        recoverable_terminal_reason_code?: string | null;
        recoverable_failed_deploy_sha?: string | null;
      };
      // A row missing a coordinate or a usable older build names nothing an operator can act on.
      // SQL owns system-block membership. This boundary only removes rows which the recovery RPC
      // would necessarily refuse because no verifiable repaired-build relationship exists.
      if (
        !r.recoverable_draft_id ||
        !r.recoverable_attempt_id ||
        typeof r.recoverable_failed_deploy_sha !== "string" ||
        !LOWER_SHA40.test(r.recoverable_failed_deploy_sha) ||
        r.recoverable_failed_deploy_sha === identity.sourceCommitSha
      ) return [];
      return [{
        draftId: r.recoverable_draft_id,
        blockedAttemptId: r.recoverable_attempt_id,
        outcome: r.recoverable_outcome ?? null,
        terminalReasonCode: r.recoverable_terminal_reason_code ?? null,
        failedDeploySha: r.recoverable_failed_deploy_sha,
        currentDeploySha: identity.sourceCommitSha,
      }];
    }),
  };
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
  if (
    !row ||
    typeof row.recovery_id !== "string" || row.recovery_id.length === 0 ||
    typeof row.recovered_attempt_id !== "string" || row.recovered_attempt_id.length === 0 ||
    typeof row.recovered_draft_id !== "string" || row.recovered_draft_id.length === 0 ||
    typeof row.recovered_at !== "string" || row.recovered_at.length === 0 ||
    typeof row.already_recovered !== "boolean"
  ) return { ok: false, reason: "recovery_failed" };

  const governance = await readGovernanceAfterRecovery(admin, input.draftId, input.blockedAttemptId);

  return {
    ok: true,
    recoveryId: row.recovery_id,
    blockedAttemptId: row.recovered_attempt_id,
    draftId: row.recovered_draft_id,
    grantedAt: row.recovered_at,
    alreadyRecovered: row.already_recovered,
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
