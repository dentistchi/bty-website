import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CallSequenceLimitError,
  createCallSequenceAllocator,
  type CallKind,
  type CallOutcome,
} from "@/domain/foundry/arena-draft/generationCallSequence";
import { categorizeThrown, type ProviderErrorCategory } from "@/domain/foundry/arena-draft/generationOutcome";
import { getLlmClient } from "@/lib/bty/llm/client";
import {
  createCallRecorder,
  type CallRecorder,
  type FinalizeCallInput,
  type PrepareCallInput,
} from "./generationCallRecorder";

/**
 * REQUEST-OWNED PROVIDER-CALL ACCOUNTING (Slice 3.2I-R5B2-R5C-2B).
 *
 * R5C-2A built the child table, the allocator and the recorder; nothing used them. This is the
 * seam that carries them from the parent attempt gate down to the four measured provider call
 * sites, so that all four share ONE sequence.
 *
 * ONE submission → one parent attempt → one context → one allocator → one recorder.
 *
 * The context is created only AFTER `startGenerationAttempt` succeeds, so a child row can never
 * reference a parent that does not exist. Callers outside a product submission — the evaluation
 * runner, unit tests — pass nothing and get exactly the pre-slice behaviour: real provider work,
 * no fabricated telemetry, no orphan children.
 */

export type GenerationAccounting = {
  /** The durable parent this submission's calls belong to. */
  readonly attemptId: string;
  /** ONE recorder over ONE allocator, shared by all four call sites. */
  readonly recorder: CallRecorder;
};

export function createGenerationAccounting(admin: SupabaseClient, attemptId: string): GenerationAccounting {
  // One allocator per submission — never one per reviewer, which would restart every kind at 1 and
  // make the global order unreadable.
  const allocator = createCallSequenceAllocator();
  return { attemptId, recorder: createCallRecorder(admin, attemptId, allocator) };
}

/**
 * The submission could not be accounted for, so it must not continue.
 *
 * This is NOT a provider failure and must never be reported as one. It is raised when the child
 * row could not be written before the call (`prepare`/`invoke`) or its answer could not be written
 * after it (`finalize`/`unsettled`). Every instrumented call site rethrows it ahead of its own
 * transport classification; `regenerateArenaDraft` converts it into the existing internal
 * attribution.
 */
export class ProviderCallTelemetryError extends Error {
  readonly name = "ProviderCallTelemetryError";
  constructor(
    readonly at: "prepare" | "invoke" | "finalize" | "unsettled" | "limit",
    readonly callKind: CallKind,
  ) {
    super(`provider call telemetry failed: ${at} ${callKind}`);
  }
}

export function isProviderCallTelemetryError(e: unknown): e is ProviderCallTelemetryError {
  return e instanceof ProviderCallTelemetryError;
}

/** Handed to an instrumented body so it can name the CALL's outcome at the point it becomes known. */
export type ProviderCallScope = {
  /**
   * Record this call's terminal state. Safe to call once; later calls are ignored, so a branch that
   * settles and then falls through cannot overwrite an outcome.
   *
   * THROWS `ProviderCallTelemetryError` when the write fails — which is what stops the product from
   * proceeding on a result it cannot account for.
   */
  settle(input: Omit<FinalizeCallInput, "durationMs">): Promise<void>;
};

/** A scope for callers with no accounting context. Records nothing and blocks nothing. */
export const INERT_CALL_SCOPE: ProviderCallScope = { async settle() {} };

/**
 * Build the provider client WITHOUT throwing.
 *
 * Call sites use this before the child row is prepared: a missing credential means no request can
 * be made, and a `provider_invoked_at` written for a call that never left the process would break
 * the one invariant the child table exists to guarantee.
 */
export function tryGetLlmClient(): ReturnType<typeof getLlmClient> | null {
  try {
    return getLlmClient();
  } catch {
    return null;
  }
}

/**
 * Wrap EXACTLY ONE provider network call in the durable lifecycle.
 *
 * The order is the contract (R5C-2B Part 4):
 *
 *   allocate → prepare → in_flight → network call → extract → digest → finalize → return
 *
 * `body` runs only after `provider_invoked_at` is durable, so a row with a NULL
 * `provider_invoked_at` is proof no call was made. `body` names its own outcome through
 * `scope.settle`, because only the call site knows whether the content it received was the
 * structured output it required — and that judgment is about the CALL, never about whether a later
 * product gate liked what the call returned.
 */
export async function withProviderCall<T>(
  accounting: GenerationAccounting | null | undefined,
  prepare: PrepareCallInput,
  body: (scope: ProviderCallScope) => Promise<T>,
): Promise<T> {
  if (!accounting) return body(INERT_CALL_SCOPE);

  const { recorder } = accounting;
  let handle;
  try {
    handle = await recorder.prepare(prepare);
  } catch (e) {
    // A ceiling breach is a real architectural event, not a database failure. It must stop the
    // submission rather than quietly permit an unrecorded call.
    if (e instanceof CallSequenceLimitError) throw new ProviderCallTelemetryError("limit", prepare.kind);
    throw e;
  }
  // FAIL BEFORE SPEND, per call. No durable row → no network call.
  if (!handle) throw new ProviderCallTelemetryError("prepare", prepare.kind);
  if (!(await recorder.invoke(handle))) throw new ProviderCallTelemetryError("invoke", prepare.kind);

  const startedAtMs = Date.now();
  let settled = false;
  const scope: ProviderCallScope = {
    async settle(input) {
      if (settled) return;
      settled = true;
      const ok = await recorder.finalize(handle, { ...input, durationMs: Date.now() - startedAtMs });
      if (!ok) throw new ProviderCallTelemetryError("finalize", prepare.kind);
    },
  };

  try {
    const value = await body(scope);
    // A branch that returned without naming its outcome would leave a permanent `in_flight` orphan
    // and a product result nobody could account for. Refuse the result instead of inventing one.
    if (!settled) {
      settled = true;
      await recorder.finalize(handle, { outcome: "internal_failure", durationMs: Date.now() - startedAtMs });
      throw new ProviderCallTelemetryError("unsettled", prepare.kind);
    }
    return value;
  } catch (e) {
    if (isProviderCallTelemetryError(e)) throw e;
    // The body threw past its own handling. The call still happened, so the row is closed here
    // rather than left open — and the ORIGINAL error is rethrown, never replaced.
    if (!settled) {
      settled = true;
      await recorder.finalize(handle, {
        outcome: "internal_failure",
        durationMs: Date.now() - startedAtMs,
        providerErrorCategory: categorizeThrown(e, false),
      });
    }
    throw e;
  }
}

/**
 * Read token counts from a completion envelope when the provider supplied them.
 *
 * SUPPLIED, never derived: an absent count stays NULL rather than becoming 0, because 0 would be
 * indistinguishable from "the provider reported no tokens". Nothing else is read from the envelope.
 */
export function readCallUsage(completion: unknown): {
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
} {
  const usage = (completion as { usage?: unknown } | null)?.usage as Record<string, unknown> | undefined;
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.round(v) : null);
  return {
    promptTokens: num(usage?.prompt_tokens),
    completionTokens: num(usage?.completion_tokens),
    totalTokens: num(usage?.total_tokens),
  };
}

/**
 * Classify a THROWN provider error onto the call-level taxonomy.
 *
 * Shared by all four call sites so a timeout at one site cannot be recorded differently from a
 * timeout at another. Only the status, the abort flag and the error's own name are consulted —
 * never a message, never a body.
 */
export function classifyThrownCall(
  error: unknown,
  aborted: boolean,
): { outcome: CallOutcome; providerHttpStatus: number | null; providerErrorCategory: ProviderErrorCategory } {
  if (aborted) return { outcome: "timeout", providerHttpStatus: null, providerErrorCategory: "aborted" };
  const rawStatus = (error as { status?: unknown } | null)?.status;
  const status = typeof rawStatus === "number" && rawStatus >= 100 && rawStatus <= 599 ? rawStatus : null;
  if (status !== null) {
    return {
      outcome: "http_error",
      providerHttpStatus: status,
      providerErrorCategory:
        status === 401 || status === 403
          ? "unauthorized"
          : status === 429
            ? "rate_limited"
            : status >= 500
              ? "server_error"
              : status >= 400
                ? "bad_request"
                : "unknown",
    };
  }
  const category = categorizeThrown(error, false);
  // An AbortError that reached here without the signal being observed is still a timeout.
  if (category === "aborted") return { outcome: "timeout", providerHttpStatus: null, providerErrorCategory: "aborted" };
  return { outcome: "transport_error", providerHttpStatus: null, providerErrorCategory: category };
}
