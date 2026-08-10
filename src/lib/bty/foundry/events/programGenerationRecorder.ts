import type { SupabaseClient } from "@supabase/supabase-js";
import type { JourneyElementKind } from "@/domain/foundry/module/journey";
import type { DependencyBranch } from "@/domain/foundry/module/program-coherence";

import { blockingAttempt, type LeaseAttempt } from "@/domain/foundry/module/program-generation-lease";

/**
 * Live schema support for the three dependency columns (migration 20260809000000).
 *
 * TRUE since the Founder executed that migration (Slice 3.2L-R6.1): the columns exist, all
 * eight historical rows hold NULL, and the pre-existing-column digest was unchanged by the
 * DDL. It was false through the preceding deploy because writing a column that does not
 * exist would fail the whole insert and lose the diagnosis entirely — strictly worse than
 * recording nothing.
 */
export const DEPENDENCY_DIAGNOSTICS_ENABLED = true;

/**
 * Live schema support for the two behaviour-contract columns (migration 20260810000000).
 *
 * TRUE since the Founder executed that migration (Slice 3.2L-R7): both columns exist and are
 * nullable, all nine historical rows hold NULL, and the pre-existing-column digest was
 * unchanged by the DDL. It was false through the preceding commit because writing a column
 * that does not exist would fail the whole insert and lose the diagnosis — strictly worse
 * than recording nothing.
 */
export const BEHAVIOR_CONTRACT_DIAGNOSTICS_ENABLED = true;

/**
 * The reason vocabulary the LIVE CHECK accepts, which is not automatically the same thing as
 * the vocabulary the domain can produce (Slice 3.2P-R2.1).
 *
 * Migration 20260810000000 pinned six values. `interrogative_action` is the seventh, added by
 * the observable-action grammar floor, and writing it before the constraint was widened would
 * have made the whole child update fail — losing every other diagnostic on that row to record
 * one. So it was withheld and stored as NULL for one deploy.
 *
 * WIDENED AND VERIFIED TWICE. `20260816000000` (3.2P-R3) added `interrogative_action`;
 * `20260818000000` (3.2P-R3.2-R2A) added `confirmer_unauthorized`. Both live CHECKs were proven —
 * not assumed — by a non-writing probe: an insert carrying an attempt_id that does not exist
 * fails either way, and Postgres names the constraint it hit first. All eight allowed reasons
 * passed the reason CHECK and were stopped by an unrelated lifecycle constraint; a nonsense
 * value, and `actor_unauthorized` (deliberately never added), were named by
 * `foundry_program_call_behavior_contract_reason_check` itself. No row was written by any probe.
 *
 * This list stays explicit rather than deriving from `CONTRACT_DEFECT_REASONS`: the point is
 * to record what the SCHEMA accepts, and deriving it from the domain would silently re-create
 * the failure it exists to prevent the next time the domain adds a reason first.
 */
const LIVE_CONTRACT_REASONS: readonly string[] = [
  "missing", "too_long", "meta_only", "not_a_role", "no_moment", "no_confirmation",
  "interrogative_action",
  "confirmer_unauthorized",
];

function storableContractReason(reason: string | undefined): string | null {
  if (!reason) return null;
  return LIVE_CONTRACT_REASONS.includes(reason) ? reason : null;
}

/**
 * Live schema support for the two child refusal columns (migration 20260815000000).
 *
 * TRUE since the Founder executed that migration (Slice 3.2P-R0.2): both columns exist and
 * are nullable, and all thirty historical rows hold NULL — verified live before this flag was
 * flipped. It was false through the preceding deploy for the same reason as its two
 * predecessors: writing a column that does not exist fails the whole update and loses the
 * diagnosis entirely, which is strictly worse than recording nothing.
 *
 * WHY THE COLUMNS EXIST AT ALL. The PARENT stores one refusal — the last one. A repaired
 * attempt makes two calls that can fail for different reasons, and the fourth pilot window
 * proved the cost: its first call was refused on `elements.reflection`, its repair was refused
 * for a different fault, and afterwards nothing could say which honesty rule the first refusal
 * had been. Each call now carries its own answer.
 */
export const CHILD_REFUSAL_DIAGNOSTICS_ENABLED = true;

/**
 * Live schema support for the repair-freeze verdict (migration 20260817000000).
 *
 * TRUE since the Founder executed that migration (Slice 3.2P-R0.3A). Verified live before this
 * flag was flipped, not inferred from the migration text: the column resolves through a direct
 * projection; all 32 historical rows hold NULL and none holds a value; and a non-writing type
 * probe — an insert whose `attempt_id` does not exist, so no row is ever created — was rejected
 * `22P02` for `'banana'` and for `7`, while `true`, `false` and `null` passed the column and
 * were stopped later by an unrelated constraint. That is a boolean column, nullable, holding
 * nothing historical. It was false through the preceding commit for the same reason as its
 * three predecessors: writing a column that does not exist fails the whole update and loses
 * every other diagnostic on the row.
 *
 * WHY THE COLUMN EXISTS. W2's two child calls record the same refusal, and the ledger could not
 * say whether the licensed retry stayed inside its envelope and failed honestly, or left it and
 * was discarded — because the freeze overwrites the validation result BEFORE the child is
 * finalized, so both outcomes wrote identical rows. The distinction lived only in a
 * `console.info` on a Worker that retains no logs.
 */
export const REPAIR_FREEZE_VERDICT_ENABLED = true;

/**
 * EXACT PROPOSAL IDENTITY (Slice 3.2L-R11.3) — OFF until the Founder executes
 * `20260811000000_foundry_program_proposal_digest_v1.sql`.
 *
 * The column now exists live — Founder-executed and independently verified, with both CHECK
 * constraints in place and zero rows backfilled. So generation records the digest and Apply
 * requires it.
 *
 * FAIL-CLOSED, not fall-back. With this true, a journey being adopted always produces a
 * digest to compare, so an attempt whose own digest is NULL can never satisfy the check.
 * That is deliberate: the twelve historical attempts — 15108cf3 included — stay ineligible,
 * and a generation whose digest failed to persist is treated as unadoptable rather than
 * quietly judged by the older newest-success heuristic.
 */
export const PROPOSAL_DIGEST_ENABLED = true;

/**
 * Durable observability for whole-program authorship (Slice 3.2L).
 *
 * One parent per Host instruction, one child per provider call. Recording NEVER blocks or
 * fails the product: if the ledger is unavailable the generation still runs, because
 * losing a record is strictly better than refusing a Host who asked for a draft. Every
 * write is best-effort and returns null rather than throwing.
 *
 * NEVER RECORDED: prompts, model responses, participant-facing prose, Host prose,
 * credentials. Shape, outcome, cost and digests only.
 */

export type ProgramAttemptOutcome =
  | "success"
  | "provider_unavailable"
  | "provider_timeout"
  | "provider_transport_error"
  | "provider_http_error"
  | "provider_empty_output"
  | "provider_malformed_output"
  | "validation_refused"
  | "stale_context"
  | "user_cancelled"
  | "internal_failure";

export type ProgramCallOutcome =
  | "success"
  | "timeout"
  | "transport_error"
  | "http_error"
  | "empty_output"
  | "malformed_output"
  | "schema_invalid"
  | "internal_failure";

export type StartProgramAttemptInput = {
  draftId: string;
  ownerUserId: string;
  submissionIntentId: string;
  contextFingerprint: string;
  proposalVersion: string;
  locale: "en" | "ko";
  deployVersion: string;
  correlationId: string;
};

export type FinalizeProgramAttemptInput = {
  attemptId: string;
  outcome: ProgramAttemptOutcome;
  /** Server-computed identity of the exact proposal returned for review (Slice 3.2L-R11.3). */
  proposalDigest?: string | null;
  durationMs: number;
  refusalCode?: string | null;
  refusalKind?: string | null;
  elementCount?: number | null;
  requiredKindCount?: number | null;
};

export type StartProgramCallInput = {
  attemptId: string;
  callKind: "authorship" | "authorship_retry";
  callSequence: number;
  model: string;
  providerTimeoutMs: number;
  structuredOutputMode: "json_object" | "json_schema_strict" | "none";
  maxTokens: number | null;
};

export type FinalizeProgramCallInput = {
  callId: string;
  outcome: ProgramCallOutcome;
  durationMs: number;
  providerHttpStatus?: number | null;
  providerErrorCategory?: string | null;
  finishReason?: string | null;
  promptTokens?: number | null;
  completionTokens?: number | null;
  totalTokens?: number | null;
  responseBytes?: number | null;
  responseSha256?: string | null;
  /**
   * Shape-only diagnosis for THIS call (Slice 3.2L-R3). A structural fault belongs to one
   * provider call: an attempt makes up to two, and they can fail differently. Recording it
   * here means call 2's result can never overwrite call 1's evidence. `call_sequence` on
   * this row already identifies which call it was.
   *
   * A path, an expected type and a received type describe SHAPE only — never the value.
   */
  /**
   * Dependency facts for THIS call, when the refusal was a dependency inversion. A closed
   * vocabulary only: the construct's generated LABEL is prose and is never passed here.
   */
  /**
   * The refusal THIS call produced, exactly as the validator reported it (Slice 3.2P-R0.2).
   * Passed from the same result that controls runtime behaviour — never re-derived from the
   * parent, the offending path, or whether a repair was eligible. Absent for every outcome
   * that is not a semantic/validation refusal, where NULL is the honest value.
   */
  refusal?: {
    code: string;
    kind: string | null;
  } | null;
  dependency?: {
    branch: DependencyBranch;
    constructKind: string | null;
    counterpartKind: JourneyElementKind | null;
  } | null;
  /**
   * Which of the four behaviour-contract roles failed, and why, when the refusal was
   * `non_observable_standard`. Closed vocabulary only — the rejected phrase is never passed.
   */
  behaviorContract?: { field: string; reason: string } | null;
  /**
   * Did THIS call's licensed repair stay inside its envelope? (Slice 3.2P-R0.3)
   *
   * Three-valued on purpose. `undefined`/`null` means the freeze was NOT EVALUATED for this
   * call — the initial authorship call, or a refusal outside the repairable set — and must
   * never be read as "it held". Only a retry that was actually measured passes true or false.
   */
  repairFreezeViolated?: boolean | null;
  diagnosis?: {
    stage: "structural" | "semantic";
    path: string;
    expected: string;
    actual: string;
    retryable: boolean;
  } | null;
};

const ATTEMPTS = "foundry_program_generation_attempts";
const CALLS = "foundry_program_generation_attempt_calls";

/**
 * Open a parent attempt. Returns null when the ledger rejects the write — including the
 * duplicate-intent case, which is the unique index doing its job: one Host instruction
 * buys one generation. The caller distinguishes the two through `duplicate`.
 */
export async function startProgramAttempt(
  admin: SupabaseClient,
  input: StartProgramAttemptInput,
): Promise<{ ok: true; attemptId: string } | { ok: false; duplicate: boolean }> {
  const { data, error } = await admin
    .from(ATTEMPTS)
    .insert({
      draft_id: input.draftId,
      owner_user_id: input.ownerUserId,
      submission_intent_id: input.submissionIntentId,
      context_fingerprint: input.contextFingerprint,
      proposal_version: input.proposalVersion,
      locale: input.locale,
      deploy_version: input.deployVersion,
      correlation_id: input.correlationId,
      lifecycle_state: "started",
    })
    .select("id")
    .maybeSingle<{ id: string }>();

  if (error || !data) {
    // 23505 = the partial unique index refused a re-delivered instruction.
    return { ok: false, duplicate: error?.code === "23505" };
  }
  return { ok: true, attemptId: data.id };
}

export async function finalizeProgramAttempt(admin: SupabaseClient, input: FinalizeProgramAttemptInput): Promise<void> {
  await admin
    .from(ATTEMPTS)
    .update({
      lifecycle_state: "completed",
      finished_at: new Date().toISOString(),
      duration_ms: Math.max(0, Math.round(input.durationMs)),
      outcome: input.outcome,
      refusal_code: input.outcome === "validation_refused" ? (input.refusalCode ?? null) : null,
      refusal_kind: input.outcome === "validation_refused" ? (input.refusalKind ?? null) : null,
      element_count: input.elementCount ?? null,
      ...(PROPOSAL_DIGEST_ENABLED && input.proposalDigest ? { proposal_digest: input.proposalDigest } : {}),
      required_kind_count: input.requiredKindCount ?? null,
    })
    .eq("id", input.attemptId);
}

/**
 * The facts the adoption decision needs, read owner-scoped in one pass (Slice 3.2L-R11.2).
 *
 * Returns the claimed attempt AND the newest successful sibling for this draft at this
 * fingerprint, so the caller can refuse an older proposal without trusting the client to
 * tell the truth about which one it adopted.
 */
export async function readAdoptionFacts(
  admin: SupabaseClient,
  input: { attemptId: string; draftId: string; ownerUserId: string; currentFingerprint: string },
): Promise<{
  attempt: {
    id: string; draftId: string; outcome: string; contextFingerprint: string;
    proposalDigest: string | null;
    /** The acceptance contract it was generated under (Slice 3.2P-W4-R1). */
    proposalVersion: string | null;
  } | null;
  latestSuccessfulAttemptId: string | null;
}> {
  const { data: row } = await admin
    .from(ATTEMPTS)
    .select(PROPOSAL_DIGEST_ENABLED ? "id,draft_id,outcome,context_fingerprint,proposal_version,proposal_digest" : "id,draft_id,outcome,context_fingerprint,proposal_version")
    .eq("id", input.attemptId)
    .eq("owner_user_id", input.ownerUserId)
    .maybeSingle<{ id: string; draft_id: string; outcome: string; context_fingerprint: string; proposal_version?: string | null; proposal_digest?: string | null }>();

  const { data: latest } = await admin
    .from(ATTEMPTS)
    .select("id")
    .eq("owner_user_id", input.ownerUserId)
    .eq("draft_id", input.draftId)
    .eq("outcome", "success")
    .eq("context_fingerprint", input.currentFingerprint)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string }>();

  return {
    attempt: row
      ? {
          id: row.id,
          draftId: row.draft_id,
          outcome: row.outcome,
          contextFingerprint: row.context_fingerprint,
          proposalDigest: row.proposal_digest ?? null,
          proposalVersion: row.proposal_version ?? null,
        }
      : null,
    latestSuccessfulAttemptId: latest?.id ?? null,
  };
}

/**
 * Record that the Host actually applied the proposal. Authorship ≠ adoption.
 *
 * `applied_at is null` makes the FIRST receipt win (Slice 3.2L-R11.1). The draft carries a
 * durable adoption marker, so every later save re-offers the same stamp; without this guard
 * the column would drift into "time of the last save" instead of the moment of adoption.
 * Returns whether the attempt now carries a receipt, so a caller can retry rather than guess.
 */
export async function markProgramAttemptApplied(admin: SupabaseClient, attemptId: string, ownerUserId: string): Promise<boolean> {
  const { error } = await admin
    .from(ATTEMPTS)
    .update({ applied_at: new Date().toISOString() })
    .eq("id", attemptId)
    .eq("owner_user_id", ownerUserId)
    .is("applied_at", null);
  if (error) return false;
  const { data } = await admin.from(ATTEMPTS).select("applied_at").eq("id", attemptId).eq("owner_user_id", ownerUserId).maybeSingle<{ applied_at: string | null }>();
  return data?.applied_at != null;
}

export async function startProgramCall(admin: SupabaseClient, input: StartProgramCallInput): Promise<string | null> {
  const { data, error } = await admin
    .from(CALLS)
    .insert({
      attempt_id: input.attemptId,
      call_kind: input.callKind,
      call_sequence: input.callSequence,
      model: input.model,
      provider_timeout_ms: input.providerTimeoutMs,
      structured_output_mode: input.structuredOutputMode,
      max_tokens: input.maxTokens,
      lifecycle_state: "in_flight",
      provider_invoked_at: new Date().toISOString(),
    })
    .select("id")
    .maybeSingle<{ id: string }>();
  if (error || !data) return null;
  return data.id;
}

export async function finalizeProgramCall(admin: SupabaseClient, input: FinalizeProgramCallInput): Promise<void> {
  await admin
    .from(CALLS)
    .update({
      lifecycle_state: "completed",
      finished_at: new Date().toISOString(),
      duration_ms: Math.max(0, Math.round(input.durationMs)),
      outcome: input.outcome,
      provider_http_status: input.providerHttpStatus ?? null,
      provider_error_category: input.providerErrorCategory ?? null,
      finish_reason: input.finishReason ?? null,
      prompt_tokens: input.promptTokens ?? null,
      completion_tokens: input.completionTokens ?? null,
      total_tokens: input.totalTokens ?? null,
      response_bytes: input.responseBytes ?? null,
      response_sha256: input.responseSha256 ?? null,
      validation_stage: input.diagnosis?.stage ?? null,
      offending_path: input.diagnosis?.path ?? null,
      expected_type: input.diagnosis?.expected ?? null,
      actual_type: input.diagnosis?.actual ?? null,
      structural_retryable: input.diagnosis?.retryable ?? null,
      /**
       * PRECISE DEPENDENCY DIAGNOSTICS (Slice 3.2L-R6.1). Written ONLY for a dependency
       * refusal; every other outcome — structural, other semantic, success, provider,
       * timeout — leaves all three NULL, which is the honest value.
       *
       * Gated on `DEPENDENCY_DIAGNOSTICS_ENABLED`, which is now true: the live columns
       * exist. While it was false the update payload stayed byte-identical to the
       * pre-migration one, which is what made the preceding deploy safe.
       */
      ...(BEHAVIOR_CONTRACT_DIAGNOSTICS_ENABLED
        ? {
            behavior_contract_field: input.behaviorContract?.field ?? null,
            behavior_contract_reason: storableContractReason(input.behaviorContract?.reason),
          }
        : {}),
      ...(DEPENDENCY_DIAGNOSTICS_ENABLED
        ? {
            dependency_branch: input.dependency?.branch ?? null,
            dependency_construct_kind: input.dependency?.constructKind ?? null,
            dependency_counterpart_kind: input.dependency?.counterpartKind ?? null,
          }
        : {}),
      /**
       * THIS CALL'S OWN REFUSAL (Slice 3.2P-R0.2). Written only when the caller passes one —
       * a provider timeout, a transport error, an unparseable body or a success all leave both
       * NULL, because none of them produced a named semantic refusal and inventing one would
       * be worse than recording nothing. Coexists with every other diagnostic: a dependency
       * refusal carries its code, its kind AND its three dependency facts.
       */
      /**
       * THE FREEZE VERDICT (Slice 3.2P-R0.3). Written from the same evaluation that decided
       * whether to discard the repair, and deliberately INDEPENDENT of `refusal_code`: on a
       * violation the code stays the ORIGINAL frozen refusal — that truth-preservation is the
       * whole point of the freeze — so this boolean is the only thing that can say the
       * candidate was discarded rather than honestly refused again.
       */
      ...(REPAIR_FREEZE_VERDICT_ENABLED
        ? { repair_freeze_violated: input.repairFreezeViolated ?? null }
        : {}),
      ...(CHILD_REFUSAL_DIAGNOSTICS_ENABLED
        ? {
            refusal_code: input.refusal?.code ?? null,
            refusal_kind: input.refusal?.kind ?? null,
          }
        : {}),
    })
    .eq("id", input.callId);
}

/**
 * Whether a program generation currently holds `draftId` — a THREE-state answer.
 *
 * Slice 3.2L-R1 returned `LeaseAttempt | null` and collapsed "no active attempt" with
 * "could not tell", failing open on a query error. That was wrong: publication is the
 * IRREVERSIBLE side, so an authority that cannot answer must not be read as permission.
 * The two cases are now distinguishable, and the caller refuses on both `active` and
 * `unavailable` (Slice 3.2L-R1.1).
 *
 * Scoped to ONE draft: a failure or an active attempt on draft A says nothing about
 * draft B, so this can never become a global lock or a global outage.
 */
export type ProgramGenerationAuthority =
  | { state: "clear" }
  | { state: "active"; attempt: LeaseAttempt }
  /** `reason` is for server logs only — never surfaced to a Host. */
  | { state: "unavailable"; reason: "query_error" | "unexpected_shape" | "client_unavailable" };

export async function resolveProgramGenerationAuthority(
  admin: SupabaseClient,
  draftId: string,
  now: Date = new Date(),
): Promise<ProgramGenerationAuthority> {
  try {
    // A client that cannot be queried at all is UNAVAILABLE, never clear.
    if (!admin || typeof (admin as { from?: unknown }).from !== "function") {
      return { state: "unavailable", reason: "client_unavailable" };
    }
    const res = await admin
      .from(ATTEMPTS)
      .select("id,draft_id,lifecycle_state,started_at,finished_at")
      .eq("draft_id", draftId)
      .eq("lifecycle_state", "started");

    if (!res || typeof res !== "object") return { state: "unavailable", reason: "unexpected_shape" };
    const { data, error } = res as { data?: unknown; error?: unknown };
    if (error) return { state: "unavailable", reason: "query_error" };
    if (!Array.isArray(data)) return { state: "unavailable", reason: "unexpected_shape" };

    // `finished_at` is deliberately NOT filtered in SQL. `classifyAttempt` already treats a
    // set `finished_at` as terminal, so the pure rule stays the single authority on what
    // "active" means — one place to read, one place to change.
    const attempt = blockingAttempt(data as LeaseAttempt[], draftId, now);
    return attempt ? { state: "active", attempt } : { state: "clear" };
  } catch {
    // A malformed or partially-mocked client throws on some chain method. That is an
    // inability to establish state, not permission to publish.
    return { state: "unavailable", reason: "unexpected_shape" };
  }
}

/**
 * Convenience read for INFORMATIONAL surfaces only (the Builder's pending indicator).
 *
 * Deliberately collapses `unavailable` to "not active": the UI hint is a convenience, and
 * the server refuses authoritatively at publish. It must NEVER be used to decide whether
 * publication may proceed — use `resolveProgramGenerationAuthority` for that.
 */
export async function findActiveProgramGeneration(
  admin: SupabaseClient,
  draftId: string,
  now: Date = new Date(),
): Promise<LeaseAttempt | null> {
  const authority = await resolveProgramGenerationAuthority(admin, draftId, now);
  return authority.state === "active" ? authority.attempt : null;
}

/** SHA-256 of the raw response, so two runs can be compared without storing either. */
export async function digestProgramResponse(raw: string): Promise<{ bytes: number; sha256: string } | null> {
  try {
    const bytes = new TextEncoder().encode(raw);
    const buf = await crypto.subtle.digest("SHA-256", bytes);
    const sha256 = Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    return { bytes: bytes.byteLength, sha256 };
  } catch {
    return null;
  }
}

/**
 * RESUME ELIGIBILITY (Slice 3.2L-R11.4K-R1).
 *
 * R11.4K let the browser keep an unapplied proposal across navigation, which fixed the loss
 * — but it decided on its own whether to show it again, from a draft id and a fingerprint it
 * also held itself. That is enough to avoid rendering a stale program, and not enough to be
 * truthful: an attempt applied in another tab, superseded by a newer generation, or no longer
 * owned would still have been presented with "Add this program to my training".
 *
 * So the server answers the question. It returns ELIGIBILITY ONLY — never the proposal, never
 * a sentence of it. The browser still holds the words; the server decides whether they may
 * still be offered.
 */
export type ResumeIneligibility =
  | "attempt_not_found"
  | "attempt_other_draft"
  | "attempt_not_successful"
  | "proposal_identity_missing"
  | "already_applied"
  | "context_moved"
  | "superseded_attempt";

export type ResumeEligibility = { ok: true } | { ok: false; reason: ResumeIneligibility };

export async function readResumeEligibility(
  admin: SupabaseClient,
  input: { attemptId: string; draftId: string; ownerUserId: string; currentFingerprint: string },
): Promise<ResumeEligibility> {
  // Owner-scoped: another Host's attempt is indistinguishable from one that does not exist.
  const { data: row } = await admin
    .from(ATTEMPTS)
    .select("id,draft_id,outcome,context_fingerprint,proposal_digest,applied_at")
    .eq("id", input.attemptId)
    .eq("owner_user_id", input.ownerUserId)
    .maybeSingle<{
      id: string;
      draft_id: string;
      outcome: string;
      context_fingerprint: string;
      proposal_digest: string | null;
      applied_at: string | null;
    }>();

  if (!row) return { ok: false, reason: "attempt_not_found" };
  if (row.draft_id !== input.draftId) return { ok: false, reason: "attempt_other_draft" };
  if (row.outcome !== "success") return { ok: false, reason: "attempt_not_successful" };
  if (!row.proposal_digest) return { ok: false, reason: "proposal_identity_missing" };
  if (row.applied_at !== null) return { ok: false, reason: "already_applied" };
  if (row.context_fingerprint !== input.currentFingerprint) return { ok: false, reason: "context_moved" };

  /*
    The newest DIGEST-BEARING success for these inputs. A Host who generated again is looking
    at that one; offering the earlier sibling would be offering work they replaced.
  */
  const { data: newest } = await admin
    .from(ATTEMPTS)
    .select("id")
    .eq("owner_user_id", input.ownerUserId)
    .eq("draft_id", input.draftId)
    .eq("outcome", "success")
    .eq("context_fingerprint", input.currentFingerprint)
    .not("proposal_digest", "is", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string }>();

  if (newest && newest.id !== row.id) return { ok: false, reason: "superseded_attempt" };
  return { ok: true };
}
