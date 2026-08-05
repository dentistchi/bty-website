/**
 * PRACTICE GENERATION OUTCOME TAXONOMY (Slice 3.2I-R5B2-R5A).
 *
 * 3.2K-R4 traced one real staging failure and could not name its mechanism. A provider abort at
 * the deadline, a transport rejection and a successful response with an empty body all returned
 * the same `generation_failed`, and the field that told them apart went only to `console.info`.
 *
 * These are the codes that replace that collapse. Every one of them is a fact about WHERE the
 * attempt stopped — never a message, never an exception string, never anything a provider wrote.
 *
 * Pure: no I/O, no clock, no randomness, no React.
 */

export const GENERATION_OUTCOMES = [
  "success",
  /** The abort signal fired at the configured provider deadline. */
  "provider_timeout",
  /** The fetch rejected before any HTTP response existed. */
  "provider_transport_error",
  /** An HTTP response arrived with a non-2xx status. */
  "provider_http_error",
  /** A 2xx response carried no usable content. */
  "provider_empty_output",
  /** Content arrived but could not be parsed as JSON. */
  "provider_malformed_output",
  /** Parsed content did not satisfy the scenario schema. */
  "provider_schema_invalid",
  /** A usable scenario was produced and the quality gate refused it. */
  "scenario_quality_rejected",
  /** The boundary reviewer refused the generated scenario. */
  "boundary_review_rejected",
  /**
   * R5C-6A — the review SYSTEM could not evaluate the scenario at all: a reviewer exhausted its
   * budget without ever returning a usable verdict. Distinct from a refusal, which is a judgment
   * ABOUT the content. Conflating them is what let a semantic reviewer failure be recorded under a
   * boundary umbrella, and what made a broken evaluator look like an ordinary content rejection.
   */
  "review_execution_failed",
  /** A valid scenario was produced and the database write failed. */
  "scenario_persistence_failed",
  /** An unexpected exception the taxonomy does not otherwise name. */
  "internal_failure",
] as const;

export type GenerationOutcome = (typeof GENERATION_OUTCOMES)[number];

/**
 * Outcomes that never reach the attempt table, because they describe a failure to OBSERVE rather
 * than a failure to generate.
 *
 * `generation_observability_unavailable` is the fail-before-spend refusal: no attempt row could be
 * created, so no provider call was made. `client_response_timeout` belongs to the client alone —
 * the browser stopped waiting. It must never be reported as a provider timeout, because the server
 * may well still be working, and only the attempt row can later say what actually happened.
 */
export const NON_ATTEMPT_OUTCOMES = ["generation_observability_unavailable", "client_response_timeout"] as const;
export type NonAttemptOutcome = (typeof NON_ATTEMPT_OUTCOMES)[number];

export type GenerationProductCode = GenerationOutcome | NonAttemptOutcome;

/**
 * Is a second attempt reasonable?
 *
 * `"unknown"` is a real answer and is used deliberately. R4 measured a failure whose transience
 * could not be established, while the screen still invited a retry — offering a repeat of
 * something that may be deterministic. A code only earns `true` when repeating it has a genuine
 * chance of a different result.
 */
export type Retriability = "true" | "false" | "unknown";

const RETRIABILITY: Record<GenerationProductCode, Retriability> = {
  success: "false",
  // A transport fault or an upstream 5xx/429 is the classic transient case.
  provider_transport_error: "true",
  provider_http_error: "true",
  // The server never started; nothing was spent. Trying again is exactly right.
  generation_observability_unavailable: "true",
  // The answer may still be arriving. Retrying could duplicate work that succeeded.
  client_response_timeout: "unknown",
  // R4's case. Whether a repeat finishes inside the deadline is genuinely not known — the
  // throughput-versus-ceiling question is open and is not answered by guessing here.
  provider_timeout: "unknown",
  provider_empty_output: "unknown",
  // The model produced something unusable. Sampling makes a different draw possible, but nothing
  // about the request changed, so this is not a promise.
  provider_malformed_output: "unknown",
  provider_schema_invalid: "unknown",
  scenario_quality_rejected: "unknown",
  boundary_review_rejected: "unknown",
  // The scenario existed and the write failed — worth another attempt.
  scenario_persistence_failed: "true",
  internal_failure: "unknown",
  /**
   * R5C-6A — UNKNOWN, and measured rather than assumed.
   *
   * The first reading suggested this failure was deterministic (four of four semantic-review calls
   * schema-invalid). A wider read disproved that: across every attempt to date the semantic
   * reviewer succeeded ONCE in SEVEN calls. So a retry is not hopeless and `false` would be a
   * false promise — but at roughly one in seven it is also not something to invite, which is what
   * the system block, not this field, exists to prevent.
   */
  review_execution_failed: "unknown",
};

export const retriabilityOf = (code: GenerationProductCode): Retriability => RETRIABILITY[code] ?? "unknown";

/** Outcomes caused by the provider or the transport to it, rather than by this product. */
const UPSTREAM: readonly GenerationProductCode[] = [
  "provider_timeout",
  "provider_transport_error",
  "provider_http_error",
  "provider_empty_output",
  "provider_malformed_output",
  "provider_schema_invalid",
];
export const isUpstreamFailure = (code: GenerationProductCode): boolean => UPSTREAM.includes(code);

/** Closed vocabulary for the sanitized provider-error label. Never a provider message. */
export const PROVIDER_ERROR_CATEGORIES = [
  "rate_limited",
  "unauthorized",
  "bad_request",
  "server_error",
  "network",
  "aborted",
  "unknown",
] as const;
export type ProviderErrorCategory = (typeof PROVIDER_ERROR_CATEGORIES)[number];

/**
 * Reduce an HTTP status to a category. Status alone is retained; the body never is — an upstream
 * error body can quote the prompt back, which is exactly the content this table must not hold.
 */
export function categorizeHttpStatus(status: number): ProviderErrorCategory {
  if (status === 401 || status === 403) return "unauthorized";
  if (status === 429) return "rate_limited";
  if (status >= 500) return "server_error";
  if (status >= 400) return "bad_request";
  return "unknown";
}

/**
 * Reduce a thrown value to a category WITHOUT retaining its message.
 *
 * Only the error's own name and abort flag are consulted. Nothing derived from the text is stored,
 * so a provider that echoes the prompt inside an exception cannot leak through this path.
 */
export function categorizeThrown(e: unknown, aborted: boolean): ProviderErrorCategory {
  if (aborted) return "aborted";
  const name = e instanceof Error ? e.name : "";
  if (name === "AbortError") return "aborted";
  if (name === "TypeError") return "network";
  return "unknown";
}

/**
 * What the provider boundary observed, when the generic failure reason alone cannot say.
 *
 * Only this narrow shape crosses out of `generateWithLlm`. Everything else the service already
 * distinguishes through its own reasons; `generation_failed` was the single ambiguous one, and
 * this is exactly the detail needed to split it four ways.
 */
export type ProviderFault =
  | { kind: "timeout" }
  | { kind: "transport"; category: ProviderErrorCategory }
  | { kind: "http"; status: number }
  | { kind: "empty" };

/**
 * Map a service reason (plus the provider fault, where one was observed) onto the durable
 * taxonomy. Pure and total: an unrecognised reason becomes `internal_failure` rather than a
 * silently-dropped attempt.
 */
export function classifyGenerationOutcome(reason: string, fault?: ProviderFault | null): GenerationOutcome {
  if (reason === "success") return "success";

  if (reason === "generation_failed") {
    switch (fault?.kind) {
      case "timeout":
        return "provider_timeout";
      case "transport":
        return "provider_transport_error";
      case "http":
        return "provider_http_error";
      case "empty":
        return "provider_empty_output";
      default:
        // R4's exact position: a failure with no retained provider detail. It is named as an
        // internal gap rather than guessed at, so the gap stays visible in the data.
        return "internal_failure";
    }
  }

  // The provider could not honour the strict schema, or its output did not satisfy it.
  if (reason === "structured_output_unavailable") return "provider_schema_invalid";
  if (reason === "scenario_persistence_failed") return "scenario_persistence_failed";

  /**
   * R5C-6A — TERMINAL REVIEWER FAILURE IS NOT A REFUSAL.
   *
   * `reviewer_terminal_failure` is the SEMANTIC reviewer's reason — the attribution table maps it
   * to `stage: "semantic_review"` — yet it was returned here under the BOUNDARY umbrella. The live
   * controlled run recorded exactly that contradiction: `terminal_stage: semantic_review` beside
   * `outcome: boundary_review_rejected`. Both reviewers' terminal failures now share one honest
   * umbrella that says the evaluation never happened.
   *
   * Matched EXACTLY, never by prefix: a prefix rule is what produced the defect, and R5C-1 already
   * removed the same pattern from attribution.
   */
  if (reason === "reviewer_terminal_failure" || reason === "boundary_reviewer_terminal_failure") {
    return "review_execution_failed";
  }
  // A boundary reviewer that REFUSED the content — a judgment, not an execution failure.
  if (reason.startsWith("boundary_review") || reason.startsWith("review_boundary")) {
    return "boundary_review_rejected";
  }

  // Content arrived and a gate refused it. `no_safe_judgment_space` is a quality judgment about
  // the confirmed constraints, not a transport event.
  if (reason === "generation_rejected" || reason === "no_safe_judgment_space") return "scenario_quality_rejected";

  return "internal_failure";
}

/**
 * Did the parsed content fail JSON extraction rather than schema validation? The service reports
 * both as `generation_rejected`; the finding code is what separates them.
 */
export function refineRejectedOutcome(findingCodes: readonly string[]): GenerationOutcome {
  if (findingCodes.includes("malformed_shape")) return "provider_malformed_output";
  if (findingCodes.includes("truncated_output")) return "provider_malformed_output";
  return "scenario_quality_rejected";
}

/**
 * A support reference the Host can quote and the operator can look up, derived from the attempt id
 * without exposing it. Twelve hex characters over a UUID is ample for a per-draft lookup and is not
 * a database identifier anyone can enumerate from.
 */
export function supportReference(attemptId: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < attemptId.length; i++) {
    h ^= attemptId.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  let g = 0x9e3779b9;
  for (let i = attemptId.length - 1; i >= 0; i--) {
    g ^= attemptId.charCodeAt(i);
    g = Math.imul(g, 0x85ebca6b) >>> 0;
  }
  return (h.toString(16).padStart(8, "0") + g.toString(16).padStart(8, "0")).slice(0, 12);
}
