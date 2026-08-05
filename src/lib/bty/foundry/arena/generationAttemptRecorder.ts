import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  GenerationOutcome,
  ProviderErrorCategory,
} from "@/domain/foundry/arena-draft/generationOutcome";
import type { Attribution } from "@/domain/foundry/arena-draft/generationAttribution";

/**
 * DURABLE PRACTICE GENERATION ATTEMPT LIFECYCLE (Slice 3.2I-R5B2-R5A).
 *
 * 3.2K-R4 could not name the mechanism of a real failure because nothing about the attempt
 * survived the request. This is the writer that fixes that, and the gate that refuses to spend
 * provider resources when it cannot.
 *
 * Two rules govern everything here:
 *
 *   FAIL BEFORE SPEND. `startAttempt` runs before the provider is called, and its failure is
 *   terminal for the request. A generation that cannot be recorded does not happen — silently
 *   falling back to console evidence is precisely what produced an un-diagnosable outage.
 *
 *   SHAPE, NEVER CONTENT. Every field is a number, a timestamp, a digest, or a member of a closed
 *   vocabulary. No prompt, no response, no scenario, no boundary statement, no exception message.
 */

const TABLE = "foundry_practice_generation_attempts";

export type StartAttemptInput = {
  draftId: string;
  draftRevision: number;
  sourceEventId: string | null;
  ownerUserId: string;
  correlationId: string;
  deployVersion: string | null;
  /**
   * R5C-4A1 — the canonical generation-input epoch this attempt was started against. Recorded
   * ALONGSIDE `draftRevision`, not instead of it: the two answer different questions, and the
   * later governance slice needs the semantic one. NULL only for attempts predating the contract.
   */
  generationInputRevision: number | null;
  providerTimeoutMs: number;
  model: string;
  structuredOutputMode: "json_schema_strict" | "none";
  maxTokens: number;
  boundaryMode: string | null;
  boundaryConstraintCount: number;
  attemptNumber: number;
  locale: "en" | "ko";
};

/** Everything the taxonomy can carry. Every optional field is honestly absent when unmeasured. */
export type FinalizeAttemptInput = {
  outcome: GenerationOutcome;
  durationMs: number;
  providerHttpStatus?: number | null;
  providerErrorCategory?: ProviderErrorCategory | null;
  responseBytes?: number | null;
  responseSha256?: string | null;
  finishReason?: string | null;
  promptTokens?: number | null;
  completionTokens?: number | null;
  scenarioPersisted?: boolean;
  /**
   * R5C-1 — exact stage/reason attribution. Optional at the type level so the R5A contract still
   * compiles, but the service supplies it on every terminal branch: without it a refusal is only
   * as specific as its broad outcome, which is what R5B could not diagnose.
   */
  attribution?: Attribution | null;
};

export type StartAttemptResult = { ok: true; attemptId: string } | { ok: false };

/**
 * Create the attempt row BEFORE the provider is invoked.
 *
 * A false result must stop the request. The caller may not proceed to the provider, because the
 * outcome would then be unobservable — the exact condition this slice exists to make impossible.
 */
export async function startGenerationAttempt(
  admin: SupabaseClient,
  input: StartAttemptInput,
): Promise<StartAttemptResult> {
  try {
    const { data, error } = await admin
      .from(TABLE)
      .insert({
        draft_id: input.draftId,
        draft_revision: input.draftRevision,
        generation_input_revision: input.generationInputRevision,
        source_event_id: input.sourceEventId,
        owner_user_id: input.ownerUserId,
        correlation_id: input.correlationId,
        deploy_version: input.deployVersion,
        provider_timeout_ms: input.providerTimeoutMs,
        model: input.model,
        structured_output_mode: input.structuredOutputMode,
        max_tokens: input.maxTokens,
        boundary_mode: input.boundaryMode,
        boundary_constraint_count: input.boundaryConstraintCount,
        attempt_number: input.attemptNumber,
        locale: input.locale,
        lifecycle_state: "started",
      })
      .select("id")
      .single<{ id: string }>();
    if (error || !data?.id) {
      // The reason is deliberately not carried into the product. It is a database fault, not
      // something the Host can act on, and an unrestricted error string is exactly what must not
      // travel. The console line is a last-resort breadcrumb, never the system of record.
      console.error(`[practiceGenAttempt] start_failed code=${error?.code ?? "unknown"}`);
      return { ok: false };
    }
    return { ok: true, attemptId: data.id };
  } catch (e) {
    console.error(`[practiceGenAttempt] start_threw name=${e instanceof Error ? e.name : "unknown"}`);
    return { ok: false };
  }
}

/**
 * Move the attempt to its terminal state. Idempotent by construction: the update is scoped to rows
 * still `started`, so a duplicate finalize matches nothing and the first terminal answer stands.
 *
 * Returns whether the write landed. A false NEVER changes the generation result the caller already
 * holds, and never triggers another provider call — losing the record of an answer is not a reason
 * to go and ask again.
 */
export async function finalizeGenerationAttempt(
  admin: SupabaseClient,
  attemptId: string,
  input: FinalizeAttemptInput,
): Promise<boolean> {
  try {
    const { data, error } = await admin
      .from(TABLE)
      .update({
        lifecycle_state: "completed",
        finished_at: new Date().toISOString(),
        duration_ms: Math.max(0, Math.round(input.durationMs)),
        outcome: input.outcome,
        provider_http_status: input.providerHttpStatus ?? null,
        provider_error_category: input.providerErrorCategory ?? null,
        response_bytes: input.responseBytes ?? null,
        response_sha256: input.responseSha256 ?? null,
        finish_reason: input.finishReason ? input.finishReason.slice(0, 40) : null,
        prompt_tokens: input.promptTokens ?? null,
        completion_tokens: input.completionTokens ?? null,
        scenario_persisted: input.scenarioPersisted === true,
        // Attribution is written as a unit or not at all — a half-attributed row would be a new
        // kind of ambiguity rather than a fix for the old one.
        attribution_version: input.attribution?.attributionVersion ?? null,
        terminal_stage: input.attribution?.terminalStage ?? null,
        terminal_reason_code: input.attribution?.terminalReasonCode ?? null,
        refusal_gate: input.attribution?.refusalGate ?? null,
        primary_finding_code: input.attribution?.primaryFindingCode ?? null,
        finding_codes: input.attribution?.findingCodes ?? null,
        finding_count: input.attribution ? input.attribution.findingCount : null,
      })
      .eq("id", attemptId)
      .eq("lifecycle_state", "started")
      .select("id");
    if (error) {
      console.error(`[practiceGenAttempt] finalize_failed code=${error.code ?? "unknown"} outcome=${input.outcome}`);
      return false;
    }
    // Zero rows means it was already terminal. That is the idempotent case, not a failure.
    return Array.isArray(data);
  } catch (e) {
    console.error(`[practiceGenAttempt] finalize_threw name=${e instanceof Error ? e.name : "unknown"}`);
    return false;
  }
}

/** SHA-256 of a response body. Identifies a body across runs without retaining any of it. */
export async function digestResponse(raw: string): Promise<{ bytes: number; sha256: string } | null> {
  try {
    const bytes = new TextEncoder().encode(raw);
    const buf = await crypto.subtle.digest("SHA-256", bytes);
    const sha256 = Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    return { bytes: bytes.length, sha256 };
  } catch {
    return null;
  }
}

/**
 * GOVERNED ATOMIC ADMISSION (Slice 3.2I-R5B2-R5C-4A2).
 *
 * `startGenerationAttempt` above inserts unconditionally. It is retained for callers that are not
 * product submissions, but the regenerate path must NOT use it: a service-side `read governance`
 * then `insert attempt` lets two concurrent confirmed requests both admit. The database function
 * makes the decision and the insertion one indivisible step under a single draft-row lock.
 */
export type GovernanceState =
  | "ready"
  | "confirm_second_attempt"
  | "revision_required"
  | "in_progress"
  /** R5C-6A — the review SYSTEM could not evaluate. Not a setup refusal. */
  | "system_blocked"
  /** R5C-6A — this exact instruction was already carried out. Never a new spend. */
  | "duplicate_existing_intent"
  | "input_revision_stale"
  | "admitted";

export type GovernedAdmission =
  | { ok: true; attemptId: string; generationInputRevision: number; generationLocale: "en" | "ko"; refusalCount: number }
  | {
      ok: false;
      state: Exclude<GovernanceState, "admitted">;
      generationInputRevision: number;
      generationLocale: "en" | "ko";
      refusalCount: number;
      requiresExplicitConfirmation: boolean;
      reviewSetupRecommended: boolean;
    }
  /** The call itself failed — indistinguishable from the fail-before-spend contract. */
  | { ok: false; state: "unavailable" };

export type GovernedAdmissionInput = StartAttemptInput & {
  expectedGenerationInputRevision: number;
  confirmSameInputRetry: boolean;
  /** R5C-6A — one explicit Host instruction. Re-delivering it can never buy a second run. */
  submissionIntentId: string;
};

export async function startGovernedGenerationAttempt(
  admin: SupabaseClient,
  input: GovernedAdmissionInput,
): Promise<GovernedAdmission> {
  try {
    const { data, error } = await admin.rpc("start_foundry_practice_generation_attempt_governed_v1", {
      p_draft_id: input.draftId,
      p_owner_user_id: input.ownerUserId,
      p_expected_generation_input_revision: input.expectedGenerationInputRevision,
      p_locale: input.locale,
      p_confirm_same_input_retry: input.confirmSameInputRetry,
      p_source_event_id: input.sourceEventId,
      p_correlation_id: input.correlationId,
      p_deploy_version: input.deployVersion,
      p_provider_timeout_ms: input.providerTimeoutMs,
      p_model: input.model,
      p_structured_output_mode: input.structuredOutputMode,
      p_max_tokens: input.maxTokens,
      p_boundary_mode: input.boundaryMode,
      p_boundary_constraint_count: input.boundaryConstraintCount,
      p_attempt_number: input.attemptNumber,
      p_submission_intent_id: input.submissionIntentId,
    });
    const row = Array.isArray(data) ? data[0] : data;
    if (error || !row) {
      // A database fault is not something the Host can act on, and an unrestricted error string is
      // exactly what must not travel. The code alone is a breadcrumb.
      console.error(`[practiceGenAdmission] failed code=${(error as { code?: string } | null)?.code ?? "unknown"}`);
      return { ok: false, state: "unavailable" };
    }
    const r = row as {
      admitted: boolean;
      attempt_id: string | null;
      generation_input_revision: number;
      generation_locale: "en" | "ko";
      refusal_count: number;
      state: GovernanceState;
      requires_explicit_confirmation: boolean;
      review_setup_recommended: boolean;
    };
    if (r.admitted && r.attempt_id) {
      return {
        ok: true,
        attemptId: r.attempt_id,
        generationInputRevision: r.generation_input_revision,
        generationLocale: r.generation_locale,
        refusalCount: r.refusal_count,
      };
    }
    return {
      ok: false,
      state: r.state as Exclude<GovernanceState, "admitted">,
      generationInputRevision: r.generation_input_revision,
      generationLocale: r.generation_locale,
      refusalCount: r.refusal_count,
      requiresExplicitConfirmation: r.requires_explicit_confirmation,
      reviewSetupRecommended: r.review_setup_recommended,
    };
  } catch (e) {
    console.error(`[practiceGenAdmission] threw name=${e instanceof Error ? e.name : "unknown"}`);
    return { ok: false, state: "unavailable" };
  }
}
