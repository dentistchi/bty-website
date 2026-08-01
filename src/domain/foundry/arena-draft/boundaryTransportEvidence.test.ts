/**
 * TRANSPORT EVIDENCE, CLASSIFICATION AND SANITIZATION
 * (Slice 3.2I-R5B1A.1-R2.34 Parts 1-3, 6, 8, 11, 12).
 *
 * R2.33 measured a live call that produced one opaque string. These tests pin that every layer the
 * classifier needs is now captured, that structured status always outranks message parsing, that a
 * message-derived answer is LABELLED as such, and that the historical evidence classifies honestly
 * as `provider_failure_unknown` rather than being retro-fitted with a cause it never recorded.
 */
import { describe, expect, it } from "vitest";
import {
  FAILURE_LAYERS,
  PROVIDER_FAILURE_CODES,
  RESPONSE_STATES,
  RETRIABILITIES,
  SANITIZED_MESSAGE_MAX,
  TRANSPORT_EVIDENCE_VERSION,
  classifyProviderFailure,
  emptyTransportEvidence,
  hashRequestId,
  sanitizeCauseChain,
  sanitizeMessage,
  transportEvidenceSha256,
  validateTransportEvidence,
  type ClassifierInput,
} from "./boundaryTransportEvidence";

const base: ClassifierInput = {
  responseState: "unknown",
  httpStatus: null,
  providerErrorType: null,
  providerErrorCode: null,
  abortObserved: false,
  timeoutState: "armed_not_fired",
  localErrorName: null,
  sanitizedMessage: "",
  structuredOutputPresent: false,
  responseEnvelopePresent: false,
};

const withStatus = (status: number, providerErrorCode: string | null = null): ClassifierInput => ({
  ...base,
  responseState: "response_received",
  httpStatus: status,
  providerErrorCode,
});

describe("[12] the mock transport matrix", () => {
  const cases: Array<[string, ClassifierInput, string, string, string]> = [
    ["1 · HTTP 401 authentication", withStatus(401), "provider_authentication_failure", "non_retriable", "http_error_response"],
    ["2 · HTTP 403 authorization", withStatus(403), "provider_authentication_failure", "non_retriable", "http_error_response"],
    ["3 · HTTP 429 rate limit", withStatus(429), "provider_rate_limit", "retriable", "http_error_response"],
    ["3b · HTTP 429 insufficient_quota", withStatus(429, "insufficient_quota"), "provider_quota_failure", "non_retriable", "provider_error_payload"],
    ["5 · HTTP 400 invalid request", withStatus(400), "provider_invalid_request", "non_retriable", "http_error_response"],
    ["6 · strict-schema rejection", withStatus(400, "invalid_json_schema"), "provider_schema_rejection", "non_retriable", "provider_error_payload"],
    ["6b · model incompatibility", withStatus(400, "unsupported_parameter"), "provider_model_incompatibility", "non_retriable", "provider_error_payload"],
    ["7 · HTTP 500", withStatus(500), "provider_service_failure", "retriable", "http_error_response"],
    ["8 · HTTP 503", withStatus(503), "provider_service_failure", "retriable", "http_error_response"],
    ["11 · HTTP 504 provider timeout", withStatus(504), "provider_timeout", "retriable", "http_error_response"],
    ["9 · fetch no-response", { ...base, responseState: "no_response", localErrorName: "TypeError" }, "provider_network_failure", "retriable", "network_no_response"],
    ["10 · local abort", { ...base, abortObserved: true, timeoutState: "fired_local" }, "local_timeout_abort", "retriable", "timeout_abort"],
    [
      "13 · success envelope, unreadable body",
      { ...base, responseState: "response_received", responseEnvelopePresent: true, structuredOutputPresent: false },
      "provider_response_parse_failure",
      "non_retriable",
      "structured_output_parse",
    ],
    ["15 · unknown error object", base, "provider_failure_unknown", "unknown", "unknown"],
  ];

  for (const [label, input, code, retriability, layer] of cases) {
    it(label, () => {
      const c = classifyProviderFailure(input);
      expect(c.providerFailureCode).toBe(code);
      expect(c.retriability).toBe(retriability);
      expect(c.failureLayer).toBe(layer);
      expect(c.retriabilityReason.length).toBeGreaterThan(0);
    });
  }

  it("[4] a 429 without retry metadata still classifies as a rate limit", () => {
    expect(classifyProviderFailure(withStatus(429)).providerFailureCode).toBe("provider_rate_limit");
  });

  it("[12] a malformed provider error payload does not defeat the status", () => {
    const c = classifyProviderFailure({ ...withStatus(500), providerErrorType: null, providerErrorCode: null });
    expect(c.providerFailureCode).toBe("provider_service_failure");
    expect(c.evidenceSource).toBe("structured");
  });

  it("prefers STRUCTURED status over a contradictory message", () => {
    const c = classifyProviderFailure({ ...withStatus(401), sanitizedMessage: "LLM API error: 500 Internal Server Error" });
    expect(c.providerFailureCode).toBe("provider_authentication_failure");
    expect(c.evidenceSource).toBe("structured");
  });

  it("falls back to the message ONLY when nothing structured exists, and says so", () => {
    const c = classifyProviderFailure({ ...base, sanitizedMessage: "LLM API error: 429 Too Many Requests" });
    expect(c.providerFailureCode).toBe("provider_rate_limit");
    expect(c.evidenceSource).toBe("message_fallback");
  });

  it("message fallback recognises network and abort shapes", () => {
    expect(classifyProviderFailure({ ...base, sanitizedMessage: "fetch failed" }).providerFailureCode).toBe("provider_network_failure");
    expect(classifyProviderFailure({ ...base, sanitizedMessage: "The operation was aborted" }).providerFailureCode).toBe("local_timeout_abort");
  });

  it("an abort outranks every other signal", () => {
    const c = classifyProviderFailure({ ...withStatus(500), abortObserved: true });
    expect(c.providerFailureCode).toBe("local_timeout_abort");
  });

  it("retriability is EVIDENCE, never permission — auth and quota are non-retriable", () => {
    expect(classifyProviderFailure(withStatus(401)).retriability).toBe("non_retriable");
    expect(classifyProviderFailure(withStatus(429, "insufficient_quota")).retriability).toBe("non_retriable");
    expect(classifyProviderFailure(withStatus(503)).retriability).toBe("retriable");
    expect(classifyProviderFailure(base).retriability).toBe("unknown");
  });
});

describe("[16][17] sanitization", () => {
  it("[16] redacts credential-like text from a message", () => {
    const s = sanitizeMessage("failed with Authorization: Bearer sk-abcdef1234567890 for org-ABCDEFGH12345");
    expect(s).not.toContain("sk-abcdef1234567890");
    expect(s).not.toContain("org-ABCDEFGH12345");
    expect(s).toContain("[redacted");
  });

  it("[16] redacts through a NESTED cause chain — where an SDK echoes headers back", () => {
    const inner = new Error("api_key=sk-supersecretvalue123456");
    const middle = new Error("request failed", { cause: inner });
    const outer = new Error("wrapper", { cause: middle });
    const chain = sanitizeCauseChain(outer);
    expect(chain.length).toBeGreaterThan(0);
    expect(chain.join(" ")).not.toContain("sk-supersecretvalue123456");
    expect(chain.join(" ")).toContain("[redacted]");
  });

  it("bounds message length so a stack or HTML page cannot bloat an artifact", () => {
    const s = sanitizeMessage("x".repeat(5000));
    expect(s.length).toBeLessThanOrEqual(SANITIZED_MESSAGE_MAX + 1);
  });

  it("bounds cause-chain depth", () => {
    let e = new Error("root");
    for (let i = 0; i < 20; i++) e = new Error(`level${i}`, { cause: e });
    expect(sanitizeCauseChain(e).length).toBeLessThanOrEqual(4);
  });

  it("redacts an email-shaped account identifier", () => {
    expect(sanitizeMessage("account owner@example.com rejected")).not.toContain("owner@example.com");
  });

  it("[17] a provider request id is persisted only as a one-way digest", () => {
    const raw = "req_abc123def456";
    const h = hashRequestId(raw);
    expect(h).not.toContain(raw);
    expect(h).toMatch(/^[0-9a-f]{32}$/);
    expect(hashRequestId(raw)).toBe(h);
  });
});

describe("[1][8] the evidence record", () => {
  it("never uses an empty string to mean unknown", () => {
    const e = emptyTransportEvidence("x");
    expect(e.responseState).toBe("unknown");
    expect(e.retriability).toBe("unknown");
    expect(e.failureLayer).toBe("unknown");
    expect(e.httpStatus).toBeNull();
    expect(e.providerErrorCode).toBeNull();
    expect(e.providerRequestIdHash).toBeNull();
  });

  it("enumerates every required response state, retriability and layer", () => {
    expect([...RESPONSE_STATES]).toEqual(["response_received", "no_response", "unknown"]);
    expect([...RETRIABILITIES]).toEqual(["retriable", "non_retriable", "unknown"]);
    for (const layer of ["request_construction", "client_invocation", "network_no_response", "http_error_response", "provider_error_payload", "provider_success_envelope", "structured_output_parse", "local_adapter", "timeout_abort", "unknown"]) {
      expect(FAILURE_LAYERS).toContain(layer);
    }
    expect(PROVIDER_FAILURE_CODES).toContain("provider_failure_unknown");
  });

  it("has a stable contract digest", () => {
    expect(transportEvidenceSha256()).toBe(transportEvidenceSha256());
    expect(transportEvidenceSha256()).toMatch(/^[0-9a-f]{64}$/);
    expect(TRANSPORT_EVIDENCE_VERSION).toBe("practice-boundary-transport-evidence/1");
  });
});

describe("[30] artifact validation refuses a provider_failure without evidence", () => {
  it("rejects a missing record", () => {
    expect(validateTransportEvidence(null)).toMatchObject({ ok: false, codes: ["transport_evidence_missing"] });
  });

  it("rejects a version mismatch", () => {
    const r = validateTransportEvidence({ ...emptyTransportEvidence("x"), transportEvidenceVersion: "old/0" });
    expect(r.ok).toBe(false);
    expect(r.codes).toContain("transport_evidence_version_mismatch");
  });

  it("rejects a status without a received response — the contradiction R2.33 could not detect", () => {
    const r = validateTransportEvidence({ ...emptyTransportEvidence("x"), httpStatus: 500, responseState: "unknown" });
    expect(r.ok).toBe(false);
    expect(r.codes).toContain("transport_evidence_response_state_contradicts_status");
  });

  it("rejects latency recorded without an invocation", () => {
    const r = validateTransportEvidence({ ...emptyTransportEvidence("x"), latencyMs: 459, providerInvocationStarted: false });
    expect(r.ok).toBe(false);
    expect(r.codes).toContain("transport_evidence_latency_without_invocation");
  });

  it("accepts a well-formed record", () => {
    const e = { ...emptyTransportEvidence("x"), providerInvocationStarted: true, latencyMs: 459, responseState: "response_received" as const, httpStatus: 401 };
    expect(validateTransportEvidence(e)).toEqual({ ok: true, codes: [] });
  });
});

describe("[24] the HISTORICAL R2.32 evidence classifies honestly", () => {
  /**
   * The exact shape R2.33 measured: invocation started, 459 ms, no status, no code, no response
   * indicator — because the outer catch discarded the error. Nothing here reconstructs the lost
   * status, and nothing pretends to.
   */
  const historical: ClassifierInput = {
    responseState: "unknown",
    httpStatus: null,
    providerErrorType: null,
    providerErrorCode: null,
    abortObserved: false,
    timeoutState: "not_applicable",
    localErrorName: null,
    sanitizedMessage: "",
    structuredOutputPresent: false,
    responseEnvelopePresent: false,
  };

  it("classifies as provider_failure_unknown with unknown retriability", () => {
    const c = classifyProviderFailure(historical);
    expect(c.providerFailureCode).toBe("provider_failure_unknown");
    expect(c.retriability).toBe("unknown");
    expect(c.failureLayer).toBe("unknown");
    expect(c.evidenceSource).toBe("absent");
  });

  it("STATES that the historical evidence is insufficient to authorize a retry", () => {
    const c = classifyProviderFailure(historical);
    // A retry needs `retriable`. `unknown` is not `retriable`, and the reason says why.
    expect(c.retriability).not.toBe("retriable");
    expect(c.retriabilityReason).toContain("not captured");
  });

  it("does not invent an HTTP status the artifact never recorded", () => {
    const c = classifyProviderFailure(historical);
    expect(c.evidenceSource).not.toBe("structured");
    expect(historical.httpStatus).toBeNull();
  });
});
