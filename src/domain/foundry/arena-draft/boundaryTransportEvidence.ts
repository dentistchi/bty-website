/**
 * BOUNDARY REVIEW TRANSPORT EVIDENCE + FAILURE CLASSIFICATION (Slice 3.2I-R5B1A.1-R2.34).
 *
 * THE MEASURED DEFECT (R2.33 over the R2.32 live run)
 *
 * One authorized live narrow boundary-review call. Provider invocation started, 459 ms elapsed, no
 * parsed DTO. The artifact recorded:
 *
 *     outcome        boundary_reviewer_terminal_failure   ← false: the reviewer never saw the subject
 *     codes          ["boundary_review_not_json"]         ← false: no body ever arrived
 *     failureClass   "coverage"                           ← false: nothing was covered or uncovered
 *     sanitizedError "boundary_review_request_failed"     ← a constant, not derived from the error
 *
 * The client had thrown `Error("LLM API error: " + status + " " + statusText)` — the status EXISTED.
 * The narrow reviewer's outer `catch { }` did not bind the error, so the status, the provider code,
 * the response-presence and the failure layer were all discarded before anything was written. The
 * provider-side cause became unknowable, and a retry would have produced a second silent artifact.
 *
 * THIS MODULE
 *
 * One canonical record of what actually happened at the transport layer, and one deterministic
 * classifier over it. Three things it refuses to do:
 *
 *  - It never infers `response_received` from latency. Latency is not evidence of a response.
 *  - It never uses `""` to mean unknown. `unknown` is a value, and it is different from absent.
 *  - It never persists a credential, an Authorization header, a cookie, an account identity, or a
 *    raw provider request id. A request id may be kept only as a one-way digest.
 *
 * Pure domain: no I/O, no provider, no clock.
 */

import { createHash } from "node:crypto";

export const TRANSPORT_EVIDENCE_VERSION = "practice-boundary-transport-evidence/1";

/** Was a response received at all? `unknown` is a real answer, and the honest one when the adapter cannot tell. */
export const RESPONSE_STATES = ["response_received", "no_response", "unknown"] as const;
export type ResponseState = (typeof RESPONSE_STATES)[number];

export const RETRIABILITIES = ["retriable", "non_retriable", "unknown"] as const;
export type Retriability = (typeof RETRIABILITIES)[number];

/** How far the call actually got. Ordered from earliest to latest. */
export const FAILURE_LAYERS = [
  "request_construction",
  "client_invocation",
  "network_no_response",
  "http_error_response",
  "provider_error_payload",
  "provider_success_envelope",
  "structured_output_parse",
  "local_adapter",
  "timeout_abort",
  "unknown",
] as const;
export type FailureLayer = (typeof FAILURE_LAYERS)[number];

export const TIMEOUT_STATES = ["not_applicable", "armed_not_fired", "fired_local", "reported_by_provider", "unknown"] as const;
export type TimeoutState = (typeof TIMEOUT_STATES)[number];

/** Where a field came from. Structured status always beats reading a message. */
export const EVIDENCE_SOURCES = ["structured", "message_fallback", "absent"] as const;
export type EvidenceSource = (typeof EVIDENCE_SOURCES)[number];

export type BoundaryTransportEvidence = {
  transportEvidenceVersion: string;
  /** Local correlation only. Never a provider identifier. */
  localAttemptId: string;

  requestConstructed: boolean;
  clientInvocationStarted: boolean;
  providerInvocationStarted: boolean;
  providerInvocationStartedAt: number | null;
  providerInvocationEndedAt: number | null;
  latencyMs: number | null;

  responseState: ResponseState;
  httpStatus: number | null;
  providerErrorType: string | null;
  providerErrorCode: string | null;
  retryAfterMs: number | null;
  /** One-way digest of a provider request id, when one was offered. Never the raw value. */
  providerRequestIdHash: string | null;

  retriability: Retriability;
  retriabilityReason: string;
  failureLayer: FailureLayer;
  timeoutState: TimeoutState;
  timeoutOwner: string | null;
  abortObserved: boolean;

  localErrorName: string | null;
  localErrorCode: string | null;
  sanitizedMessage: string;
  sanitizedCauseChain: string[];

  responseEnvelopePresent: boolean;
  structuredOutputPresent: boolean;
  tokenUsagePresent: boolean;

  evidenceSource: EvidenceSource;
  artifactWriteResult: "pending" | "written" | "failed";
};

// ---------------------------------------------------------------------------
// Sanitization
// ---------------------------------------------------------------------------

/**
 * Patterns that must never survive into an artifact. Applied to every message and every cause in
 * the chain — a nested cause is exactly where an SDK tends to echo a request header back.
 */
const SECRET_PATTERNS: Array<[RegExp, string]> = [
  [/\bsk-[A-Za-z0-9_-]{8,}/g, "[redacted-key]"],
  [/\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/gi, "[redacted-bearer]"],
  [/\bAuthorization\s*[:=]\s*\S+/gi, "Authorization: [redacted]"],
  [/\b(api[_-]?key|apikey|access[_-]?token|refresh[_-]?token|client[_-]?secret)\s*[:=]\s*\S+/gi, "$1: [redacted]"],
  [/\bcookie\s*[:=]\s*\S+/gi, "cookie: [redacted]"],
  [/\borg-[A-Za-z0-9]{8,}/g, "[redacted-org]"],
  [/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, "[redacted-email]"],
];

/** Cap so a stack or an HTML error page cannot bloat an artifact. */
export const SANITIZED_MESSAGE_MAX = 300;
export const SANITIZED_CAUSE_DEPTH_MAX = 4;

export function sanitizeMessage(raw: unknown): string {
  let s = typeof raw === "string" ? raw : raw === undefined || raw === null ? "" : String(raw);
  for (const [pattern, replacement] of SECRET_PATTERNS) s = s.replace(pattern, replacement);
  // Collapse whitespace so a multi-line stack becomes one auditable line.
  s = s.replace(/\s+/g, " ").trim();
  return s.length > SANITIZED_MESSAGE_MAX ? `${s.slice(0, SANITIZED_MESSAGE_MAX)}…` : s;
}

/** Walk `error.cause` to a bounded depth, sanitizing every level. */
export function sanitizeCauseChain(error: unknown, depth = SANITIZED_CAUSE_DEPTH_MAX): string[] {
  const out: string[] = [];
  let current: unknown = error;
  for (let i = 0; i < depth && current; i++) {
    const cause = (current as { cause?: unknown }).cause;
    if (cause === undefined || cause === null) break;
    const name = (cause as { name?: unknown }).name;
    const message = (cause as { message?: unknown }).message ?? cause;
    out.push(sanitizeMessage(`${typeof name === "string" ? `${name}: ` : ""}${String(message)}`));
    current = cause;
  }
  return out;
}

/** One-way digest, so a provider request id can correlate without being disclosed. */
export const hashRequestId = (id: string): string => createHash("sha256").update(id).digest("hex").slice(0, 32);

// ---------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------

export const PROVIDER_FAILURE_CODES = [
  "provider_authentication_failure",
  "provider_quota_failure",
  "provider_rate_limit",
  "provider_timeout",
  "local_timeout_abort",
  "provider_network_failure",
  "provider_service_failure",
  "provider_invalid_request",
  "provider_schema_rejection",
  "provider_model_incompatibility",
  "provider_response_parse_failure",
  "local_transport_adapter_failure",
  "provider_failure_unknown",
] as const;
export type ProviderFailureCode = (typeof PROVIDER_FAILURE_CODES)[number];

/**
 * Retriability is EVIDENCE, never permission. Nothing in this module executes or authorizes a
 * retry; it only records what the evidence supports.
 */
const RETRIABILITY_BY_CODE: Record<ProviderFailureCode, Retriability> = {
  provider_authentication_failure: "non_retriable",
  provider_quota_failure: "non_retriable",
  provider_rate_limit: "retriable",
  provider_timeout: "retriable",
  local_timeout_abort: "retriable",
  provider_network_failure: "retriable",
  provider_service_failure: "retriable",
  provider_invalid_request: "non_retriable",
  provider_schema_rejection: "non_retriable",
  provider_model_incompatibility: "non_retriable",
  provider_response_parse_failure: "non_retriable",
  local_transport_adapter_failure: "non_retriable",
  provider_failure_unknown: "unknown",
};

const RETRIABILITY_REASON: Record<ProviderFailureCode, string> = {
  provider_authentication_failure: "the credential was rejected; repeating the same call repeats the rejection",
  provider_quota_failure: "the account has no remaining quota; a retry cannot create any",
  provider_rate_limit: "the limit is time-based and clears on its own",
  provider_timeout: "the provider reported a timeout, which is a transient server-side condition",
  local_timeout_abort: "the local deadline fired; the request itself may still be well formed",
  provider_network_failure: "no response was received; the failure is below the application layer",
  provider_service_failure: "a 5xx is a provider-side fault, normally transient",
  provider_invalid_request: "the request itself was refused; the same request will be refused again",
  provider_schema_rejection: "the strict schema was refused; the same schema will be refused again",
  provider_model_incompatibility: "the model or a parameter is unsupported; retrying changes nothing",
  provider_response_parse_failure: "a response arrived but could not be read; retrying is not indicated without a contract change",
  local_transport_adapter_failure: "a deterministic local fault, not a provider condition",
  provider_failure_unknown: "the evidence needed to classify the failure was not captured",
};

/** Everything the classifier is allowed to read. Structured first; the message only as a fallback. */
export type ClassifierInput = {
  responseState: ResponseState;
  httpStatus: number | null;
  providerErrorType: string | null;
  providerErrorCode: string | null;
  abortObserved: boolean;
  timeoutState: TimeoutState;
  localErrorName: string | null;
  /** Already sanitized. Used ONLY when no structured signal is present. */
  sanitizedMessage: string;
  structuredOutputPresent: boolean;
  responseEnvelopePresent: boolean;
};

export type Classification = {
  providerFailureCode: ProviderFailureCode;
  retriability: Retriability;
  retriabilityReason: string;
  failureLayer: FailureLayer;
  evidenceSource: EvidenceSource;
};

/** HTTP status → code. The primary path: a status is unambiguous where a message is not. */
function fromStatus(status: number, providerErrorCode: string | null): ProviderFailureCode | null {
  if (status === 401) return "provider_authentication_failure";
  if (status === 403) return "provider_authentication_failure";
  if (status === 408 || status === 504) return "provider_timeout";
  if (status === 429) {
    // A 429 is a rate limit UNLESS the provider says the account is out of quota — a different
    // remedy entirely, and the one place where the provider's own code outranks the status.
    return providerErrorCode === "insufficient_quota" ? "provider_quota_failure" : "provider_rate_limit";
  }
  if (status === 400 || status === 422) {
    if (providerErrorCode === "invalid_json_schema" || providerErrorCode === "json_schema_unsupported") return "provider_schema_rejection";
    if (providerErrorCode === "model_not_found" || providerErrorCode === "unsupported_parameter" || providerErrorCode === "unsupported_value") {
      return "provider_model_incompatibility";
    }
    return "provider_invalid_request";
  }
  if (status === 404) return "provider_model_incompatibility";
  if (status >= 500) return "provider_service_failure";
  if (status >= 400) return "provider_invalid_request";
  return null;
}

/**
 * Classify a transport failure from structured evidence.
 *
 * Order is deliberate: an observed abort, then a status, then a provider code, then — only when
 * nothing structured exists — the sanitized message, marked `message_fallback` so an auditor can
 * see the classification rested on prose.
 */
export function classifyProviderFailure(input: ClassifierInput): Classification {
  const complete = (code: ProviderFailureCode, failureLayer: FailureLayer, evidenceSource: EvidenceSource): Classification => ({
    providerFailureCode: code,
    retriability: RETRIABILITY_BY_CODE[code],
    retriabilityReason: RETRIABILITY_REASON[code],
    failureLayer,
    evidenceSource,
  });

  // 1. A local abort is unambiguous and outranks everything: we stopped the call ourselves.
  if (input.abortObserved || input.timeoutState === "fired_local") return complete("local_timeout_abort", "timeout_abort", "structured");

  // 2. A confirmed HTTP status.
  if (input.responseState === "response_received" && typeof input.httpStatus === "number") {
    const code = fromStatus(input.httpStatus, input.providerErrorCode);
    if (code) {
      const layer: FailureLayer = input.providerErrorCode || input.providerErrorType ? "provider_error_payload" : "http_error_response";
      return complete(code, layer, "structured");
    }
  }

  // 3. A response arrived and was even a success envelope, but the body could not be read.
  if (input.responseEnvelopePresent && !input.structuredOutputPresent) {
    return complete("provider_response_parse_failure", "structured_output_parse", "structured");
  }

  // 4. Confirmed absence of a response — below the application layer.
  if (input.responseState === "no_response") {
    if (input.localErrorName === "AbortError") return complete("local_timeout_abort", "timeout_abort", "structured");
    return complete("provider_network_failure", "network_no_response", "structured");
  }

  // 5. MESSAGE FALLBACK. Only reached when nothing structured survived — the R2.32 shape.
  const m = input.sanitizedMessage.toLowerCase();
  if (m) {
    const status = /\b(\d{3})\b/.exec(m)?.[1];
    if (status) {
      const code = fromStatus(Number(status), input.providerErrorCode);
      if (code) return complete(code, "http_error_response", "message_fallback");
    }
    if (m.includes("abort")) return complete("local_timeout_abort", "timeout_abort", "message_fallback");
    if (m.includes("timeout") || m.includes("timed out")) return complete("provider_timeout", "http_error_response", "message_fallback");
    if (m.includes("fetch failed") || m.includes("enotfound") || m.includes("econnrefused") || m.includes("network")) {
      return complete("provider_network_failure", "network_no_response", "message_fallback");
    }
  }

  // 6. Nothing usable. This is the honest answer, and it is what the historical artifact deserves.
  return complete("provider_failure_unknown", "unknown", input.sanitizedMessage ? "message_fallback" : "absent");
}

/** A blank record for a call that has not started. Never uses "" to mean unknown. */
export function emptyTransportEvidence(localAttemptId: string): BoundaryTransportEvidence {
  return {
    transportEvidenceVersion: TRANSPORT_EVIDENCE_VERSION,
    localAttemptId,
    requestConstructed: false,
    clientInvocationStarted: false,
    providerInvocationStarted: false,
    providerInvocationStartedAt: null,
    providerInvocationEndedAt: null,
    latencyMs: null,
    responseState: "unknown",
    httpStatus: null,
    providerErrorType: null,
    providerErrorCode: null,
    retryAfterMs: null,
    providerRequestIdHash: null,
    retriability: "unknown",
    retriabilityReason: RETRIABILITY_REASON.provider_failure_unknown,
    failureLayer: "unknown",
    timeoutState: "not_applicable",
    timeoutOwner: null,
    abortObserved: false,
    localErrorName: null,
    localErrorCode: null,
    sanitizedMessage: "",
    sanitizedCauseChain: [],
    responseEnvelopePresent: false,
    structuredOutputPresent: false,
    tokenUsagePresent: false,
    evidenceSource: "absent",
    artifactWriteResult: "pending",
  };
}

/** Contract digest — what a runner and an artifact bind to. */
export function transportEvidenceSha256(): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        version: TRANSPORT_EVIDENCE_VERSION,
        responseStates: RESPONSE_STATES,
        retriabilities: RETRIABILITIES,
        failureLayers: FAILURE_LAYERS,
        timeoutStates: TIMEOUT_STATES,
        evidenceSources: EVIDENCE_SOURCES,
        providerFailureCodes: PROVIDER_FAILURE_CODES,
        retriabilityByCode: RETRIABILITY_BY_CODE,
        messageMax: SANITIZED_MESSAGE_MAX,
        causeDepthMax: SANITIZED_CAUSE_DEPTH_MAX,
      }),
    )
    .digest("hex");
}

/**
 * ARTIFACT VALIDATION — a `provider_failure` without transport evidence is not an artifact, it is
 * the R2.32 shape again. This is the gate that makes that unrepresentable.
 */
export const TRANSPORT_ARTIFACT_CODES = [
  "transport_evidence_missing",
  "transport_evidence_version_mismatch",
  "transport_evidence_invalid_response_state",
  "transport_evidence_invalid_layer",
  "transport_evidence_invalid_retriability",
  "transport_evidence_response_state_contradicts_status",
  "transport_evidence_latency_without_invocation",
] as const;
export type TransportArtifactCode = (typeof TRANSPORT_ARTIFACT_CODES)[number];

export function validateTransportEvidence(e: unknown): { ok: boolean; codes: TransportArtifactCode[] } {
  const codes: TransportArtifactCode[] = [];
  if (!e || typeof e !== "object") return { ok: false, codes: ["transport_evidence_missing"] };
  const t = e as Partial<BoundaryTransportEvidence>;
  if (t.transportEvidenceVersion !== TRANSPORT_EVIDENCE_VERSION) codes.push("transport_evidence_version_mismatch");
  if (!(RESPONSE_STATES as readonly string[]).includes(String(t.responseState))) codes.push("transport_evidence_invalid_response_state");
  if (!(FAILURE_LAYERS as readonly string[]).includes(String(t.failureLayer))) codes.push("transport_evidence_invalid_layer");
  if (!(RETRIABILITIES as readonly string[]).includes(String(t.retriability))) codes.push("transport_evidence_invalid_retriability");
  // A status can only exist when a response was received. Anything else is a contradiction.
  if (typeof t.httpStatus === "number" && t.responseState !== "response_received") {
    codes.push("transport_evidence_response_state_contradicts_status");
  }
  if (typeof t.latencyMs === "number" && t.providerInvocationStarted !== true) codes.push("transport_evidence_latency_without_invocation");
  return { ok: codes.length === 0, codes };
}
