import type { SupabaseClient } from "@supabase/supabase-js";
import {
  RESPONSE_DIGEST_SCOPE,
  utf8ByteLength,
  type CallKind,
  type CallOutcome,
  type CallSequenceAllocator,
} from "@/domain/foundry/arena-draft/generationCallSequence";
import type { ProviderErrorCategory } from "@/domain/foundry/arena-draft/generationOutcome";

/**
 * DURABLE PER-PROVIDER-CALL LIFECYCLE (Slice 3.2I-R5B2-R5C-2).
 *
 * The parent attempt answers "what happened to this submission". This answers "what happened to
 * each of the up-to-fourteen model calls inside it" — which R5B needed and could not get.
 *
 * The recorder never calls a provider. It decides whether one MAY be called:
 *
 *   prepare   a durable row exists, and nothing has been spent
 *   invoke    `provider_invoked_at` is durable — only now is the network permitted
 *   finalize  the answer, or the absence of one, is durable
 *
 * If prepare or invoke cannot be persisted, the call does not happen. Recording a call after the
 * fact would be a guess, and a guess is what the whole arc has been removing.
 *
 * SHAPE, NEVER CONTENT. Numbers, timestamps, closed vocabularies and one hash. A response is
 * remembered as a digest and a byte count; it is never stored, and the raw string never reaches
 * the persistence payload.
 */

const TABLE = "foundry_practice_generation_attempt_calls";

export type PrepareCallInput = {
  kind: CallKind;
  model: string;
  providerTimeoutMs: number;
  maxTokens?: number | null;
  temperature?: number | null;
  topP?: number | null;
  structuredOutputMode: "json_schema_strict" | "none";
  locale?: "en" | "ko" | null;
};

export type FinalizeCallInput = {
  outcome: CallOutcome;
  durationMs: number;
  providerHttpStatus?: number | null;
  providerErrorCategory?: ProviderErrorCategory | null;
  /**
   * The EXACT extracted model-content string. It is digested here and discarded — it is never
   * placed in the persistence payload, and no caller can cause it to be stored.
   */
  modelContent?: string | null;
  finishReason?: string | null;
  promptTokens?: number | null;
  completionTokens?: number | null;
  totalTokens?: number | null;
};

/** An opaque handle. Product code never sees a database id, and never needs one. */
export type CallHandle = { readonly __callId: string; readonly kind: CallKind; readonly startedAtMs: number };

export type CallRecorder = {
  /** Durable row before the provider is reachable. `null` means the call MUST NOT happen. */
  prepare(input: PrepareCallInput): Promise<CallHandle | null>;
  /** Durable `provider_invoked_at`. `false` means the call MUST NOT happen. */
  invoke(handle: CallHandle): Promise<boolean>;
  /** Terminal state. A false return never justifies calling the provider again. */
  finalize(handle: CallHandle, input: FinalizeCallInput): Promise<boolean>;
};

/** SHA-256 over the exact UTF-8 bytes. One-way: the source prose cannot be recovered from it. */
export async function digestModelContent(content: string): Promise<{ sha256: string; bytes: number } | null> {
  try {
    const bytes = new TextEncoder().encode(content);
    const buf = await crypto.subtle.digest("SHA-256", bytes);
    const sha256 = Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    return { sha256, bytes: bytes.length };
  } catch {
    return null;
  }
}

/**
 * A recorder bound to ONE parent attempt and ONE sequence allocator, so a handle can never be
 * finalized through a different parent.
 */
export function createCallRecorder(
  admin: SupabaseClient,
  attemptId: string,
  allocator: CallSequenceAllocator,
): CallRecorder {
  return {
    async prepare(input) {
      const pos = allocator.next(input.kind);
      try {
        const { data, error } = await admin
          .from(TABLE)
          .insert({
            attempt_id: attemptId,
            call_kind: pos.callKind,
            global_sequence: pos.globalSequence,
            kind_sequence: pos.kindSequence,
            lifecycle_state: "prepared",
            model: input.model,
            provider_timeout_ms: input.providerTimeoutMs,
            max_tokens: input.maxTokens ?? null,
            temperature: input.temperature ?? null,
            top_p: input.topP ?? null,
            structured_output_mode: input.structuredOutputMode,
            locale: input.locale ?? null,
          })
          .select("id")
          .single<{ id: string }>();
        if (error || !data?.id) {
          console.error(`[practiceGenCall] prepare_failed kind=${pos.callKind} code=${error?.code ?? "unknown"}`);
          return null;
        }
        return { __callId: data.id, kind: pos.callKind, startedAtMs: Date.now() };
      } catch (e) {
        console.error(`[practiceGenCall] prepare_threw kind=${pos.callKind} name=${e instanceof Error ? e.name : "unknown"}`);
        return null;
      }
    },

    async invoke(handle) {
      try {
        // Scoped to `prepared`, so a completed call can never be reopened as in-flight.
        const { data, error } = await admin
          .from(TABLE)
          .update({ lifecycle_state: "in_flight", provider_invoked_at: new Date().toISOString() })
          .eq("id", handle.__callId)
          .eq("attempt_id", attemptId)
          .eq("lifecycle_state", "prepared")
          .select("id");
        if (error || !Array.isArray(data) || data.length === 0) {
          console.error(`[practiceGenCall] invoke_failed kind=${handle.kind} code=${error?.code ?? "no_row"}`);
          return false;
        }
        return true;
      } catch (e) {
        console.error(`[practiceGenCall] invoke_threw kind=${handle.kind} name=${e instanceof Error ? e.name : "unknown"}`);
        return false;
      }
    },

    async finalize(handle, input) {
      // The content is digested and dropped HERE. Nothing downstream of this line has it.
      let digest: { sha256: string; bytes: number } | null = null;
      if (typeof input.modelContent === "string" && input.modelContent.length > 0) {
        digest = await digestModelContent(input.modelContent);
      }
      try {
        // Scoped to `in_flight`: idempotent, and one terminal outcome can never overwrite another.
        const { data, error } = await admin
          .from(TABLE)
          .update({
            lifecycle_state: "completed",
            finished_at: new Date().toISOString(),
            duration_ms: Math.max(0, Math.round(input.durationMs)),
            outcome: input.outcome,
            provider_http_status: input.providerHttpStatus ?? null,
            provider_error_category: input.providerErrorCategory ?? null,
            response_digest_scope: digest ? RESPONSE_DIGEST_SCOPE : null,
            response_byte_count: digest ? digest.bytes : null,
            response_sha256: digest ? digest.sha256 : null,
            finish_reason: input.finishReason ? String(input.finishReason).slice(0, 40) : null,
            prompt_tokens: input.promptTokens ?? null,
            completion_tokens: input.completionTokens ?? null,
            total_tokens: input.totalTokens ?? null,
          })
          .eq("id", handle.__callId)
          .eq("attempt_id", attemptId)
          .eq("lifecycle_state", "in_flight")
          .select("id");
        if (error) {
          console.error(`[practiceGenCall] finalize_failed kind=${handle.kind} code=${error.code ?? "unknown"}`);
          return false;
        }
        return Array.isArray(data);
      } catch (e) {
        console.error(`[practiceGenCall] finalize_threw kind=${handle.kind} name=${e instanceof Error ? e.name : "unknown"}`);
        return false;
      }
    },
  };
}

export { utf8ByteLength };

/**
 * The one shape every instrumented call site uses.
 *
 * `blocked` is not a failure of the provider — it is the recorder refusing to let a call happen
 * because it could not be written down first. The caller must treat it as "no call was made", which
 * is why it is a distinct result rather than an exception.
 */
export type InstrumentedResult<T> =
  | { status: "ran"; value: T }
  | { status: "blocked"; at: "prepare" | "invoke" };

/**
 * Prepare → invoke → run → finalize, in that order, around exactly one provider call.
 *
 * The provider is unreachable until `provider_invoked_at` is durable. `classify` maps whatever the
 * call produced onto the call-level taxonomy; it describes the CALL, never the content — a response
 * that parses is `success` even when a product gate later refuses what it said.
 */
export async function runInstrumentedCall<T>(
  recorder: CallRecorder | null | undefined,
  prepareInput: PrepareCallInput,
  run: () => Promise<T>,
  classify: (outcome: { ok: true; value: T } | { ok: false; error: unknown }) => Omit<FinalizeCallInput, "durationMs">,
): Promise<InstrumentedResult<T>> {
  // Without a recorder the behaviour is exactly as before this slice — used by tests and by any
  // caller outside a parent attempt. It never silently fabricates telemetry.
  if (!recorder) {
    const value = await run();
    return { status: "ran", value };
  }

  const handle = await recorder.prepare(prepareInput);
  if (!handle) return { status: "blocked", at: "prepare" };
  if (!(await recorder.invoke(handle))) return { status: "blocked", at: "invoke" };

  const startedAt = Date.now();
  try {
    const value = await run();
    await recorder.finalize(handle, { ...classify({ ok: true, value }), durationMs: Date.now() - startedAt });
    return { status: "ran", value };
  } catch (error) {
    // The call happened and failed. Finalizing here is what keeps the row out of `in_flight`;
    // a failed finalize is logged and never becomes a second provider call.
    await recorder.finalize(handle, { ...classify({ ok: false, error }), durationMs: Date.now() - startedAt });
    throw error;
  }
}
