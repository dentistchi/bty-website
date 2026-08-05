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
    })
    .eq("id", input.callId);
}

/**
 * The generation attempt currently holding `draftId`, or null.
 *
 * This is the authority publication consults (Slice 3.2L-R1). It is scoped to ONE draft
 * and reads only unfinished rows, so it can never become a global lock, and the pure
 * lease rule decides whether an unfinished row still counts — an attempt lost to a crash
 * stops blocking on its own, without a reaper and without rewriting the row.
 *
 * Fails OPEN on a query error: an observability outage must not make the product
 * unpublishable. The consequence is stated honestly rather than hidden — if this read
 * fails, the race it guards against is momentarily possible again.
 */
export async function findActiveProgramGeneration(
  admin: SupabaseClient,
  draftId: string,
  now: Date = new Date(),
): Promise<LeaseAttempt | null> {
  try {
    const { data, error } = await admin
      .from(ATTEMPTS)
      .select("id,draft_id,lifecycle_state,started_at,finished_at")
      .eq("draft_id", draftId)
      .eq("lifecycle_state", "started");
    if (error || !Array.isArray(data)) return null;
    // `finished_at` is deliberately NOT filtered in SQL. `classifyAttempt` already treats a
    // set `finished_at` as terminal, so the pure rule stays the single authority on what
    // "active" means — one place to read, one place to change.
    return blockingAttempt(data as LeaseAttempt[], draftId, now);
  } catch {
    // An unavailable or unexpected client shape must not break publication. Fail open,
    // with the consequence stated in the docblock above.
    return null;
  }
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
