import type { SupabaseClient } from "@supabase/supabase-js";
import { blockingAttempt, type LeaseAttempt } from "@/domain/foundry/module/program-generation-lease";

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
      required_kind_count: input.requiredKindCount ?? null,
    })
    .eq("id", input.attemptId);
}

/** Record that the Host actually applied the proposal. Authorship ≠ adoption. */
export async function markProgramAttemptApplied(admin: SupabaseClient, attemptId: string, ownerUserId: string): Promise<void> {
  await admin
    .from(ATTEMPTS)
    .update({ applied_at: new Date().toISOString() })
    .eq("id", attemptId)
    .eq("owner_user_id", ownerUserId);
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
