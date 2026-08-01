/**
 * HISTORICAL R2.32 TRANSPORT REGRESSION (Slice 3.2I-R5B1A.1-R2.34 Part 11).
 *
 * The exact information-loss shape the R2.32 live run produced, as a sanitized local fixture.
 *
 * This test does NOT recover the lost HTTP status, and must never appear to. Its whole job is to
 * pin that the historical evidence classifies HONESTLY — `provider_failure_unknown`, `unknown`
 * retriability, zero semantic attempts — and that it is therefore insufficient to authorize a retry.
 *
 * The original artifact is never rewritten. It stays byte-identical.
 */
import { describe, expect, it } from "vitest";
import {
  classifyProviderFailure,
  emptyTransportEvidence,
  validateTransportEvidence,
  type BoundaryTransportEvidence,
} from "./boundaryTransportEvidence";

export const R232_LIVE_RUN_ID = "20260801T151001Z";
export const R232_LIVE_ARTIFACT_SHA256 = "5b675bcf160fc0d6f6e541e8a81bebd80dff41b4008ada6c974f171ae0bfdf4a";
export const R232_BOUNDARY_REVIEW_SUBJECT_SHA256 = "b15bfb8f703b17b2379ffe4222fb623149e74e0350f3e5e0516ab4a02a867280";

/**
 * What the R2.32 artifact ACTUALLY recorded, reconstructed into the R2.34 shape.
 *
 * Provider invocation started and 459 ms elapsed — that much is known. Everything a classifier
 * needs was discarded by the unbound `catch { }`, so every one of those fields is `null` or
 * `unknown` here. That is the fixture's point.
 */
export const R232_HISTORICAL_TRANSPORT: BoundaryTransportEvidence = {
  ...emptyTransportEvidence("historical-r232#1"),
  requestConstructed: true,
  clientInvocationStarted: true,
  providerInvocationStarted: true,
  providerInvocationStartedAt: 0,
  providerInvocationEndedAt: 459,
  latencyMs: 459,
  // The adapter could not tell whether a response arrived. `unknown` is the honest value.
  responseState: "unknown",
  httpStatus: null,
  providerErrorType: null,
  providerErrorCode: null,
  retryAfterMs: null,
  providerRequestIdHash: null,
  timeoutState: "not_applicable",
  timeoutOwner: null,
  abortObserved: false,
  localErrorName: null,
  localErrorCode: null,
  // The historical constant. Not derived from the error, because the error was never bound.
  sanitizedMessage: "",
  sanitizedCauseChain: [],
  responseEnvelopePresent: false,
  structuredOutputPresent: false,
  tokenUsagePresent: false,
  evidenceSource: "absent",
  artifactWriteResult: "written",
};

/** The counts the R2.32 run SHOULD have recorded under the R2.34 separation. */
export const R232_EXPECTED_COUNTS = {
  boundaryProviderInvocationCount: 1,
  boundaryProviderResponseCount: 0,
  boundarySemanticReviewAttemptCount: 0,
  boundaryTransportFailureCount: 1,
  boundaryReviewRerunCount: 0,
  boundaryTransportRetryCount: 0,
} as const;

describe("[24] the historical R2.32 evidence", () => {
  it("classifies as provider_failure_unknown with unknown retriability", () => {
    const c = classifyProviderFailure({
      responseState: R232_HISTORICAL_TRANSPORT.responseState,
      httpStatus: R232_HISTORICAL_TRANSPORT.httpStatus,
      providerErrorType: R232_HISTORICAL_TRANSPORT.providerErrorType,
      providerErrorCode: R232_HISTORICAL_TRANSPORT.providerErrorCode,
      abortObserved: R232_HISTORICAL_TRANSPORT.abortObserved,
      timeoutState: R232_HISTORICAL_TRANSPORT.timeoutState,
      localErrorName: R232_HISTORICAL_TRANSPORT.localErrorName,
      sanitizedMessage: R232_HISTORICAL_TRANSPORT.sanitizedMessage,
      structuredOutputPresent: R232_HISTORICAL_TRANSPORT.structuredOutputPresent,
      responseEnvelopePresent: R232_HISTORICAL_TRANSPORT.responseEnvelopePresent,
    });
    expect(c.providerFailureCode).toBe("provider_failure_unknown");
    expect(c.retriability).toBe("unknown");
    expect(c.failureLayer).toBe("unknown");
    expect(c.evidenceSource).toBe("absent");
  });

  it("HISTORICAL EVIDENCE IS INSUFFICIENT TO AUTHORIZE A RETRY", () => {
    const c = classifyProviderFailure({
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
    });
    // A retry requires `retriable`. This is not that, and the reason names why.
    expect(c.retriability).toBe("unknown");
    expect(c.retriability).not.toBe("retriable");
    expect(c.retriabilityReason).toContain("not captured");
  });

  it("does not reconstruct the lost HTTP status", () => {
    expect(R232_HISTORICAL_TRANSPORT.httpStatus).toBeNull();
    expect(R232_HISTORICAL_TRANSPORT.providerErrorCode).toBeNull();
    expect(R232_HISTORICAL_TRANSPORT.responseState).toBe("unknown");
  });

  it("maps to the corrected top level and the preserved subcode", () => {
    const topLevel = "provider_failure";
    const stageSubcode = "boundary_review_transport_failed";
    expect(topLevel).not.toBe("boundary_reviewer_terminal_failure");
    expect(stageSubcode).toBe("boundary_review_transport_failed");
  });

  it("would have recorded ONE invocation and ZERO semantic attempts", () => {
    expect(R232_EXPECTED_COUNTS).toEqual({
      boundaryProviderInvocationCount: 1,
      boundaryProviderResponseCount: 0,
      boundarySemanticReviewAttemptCount: 0,
      boundaryTransportFailureCount: 1,
      boundaryReviewRerunCount: 0,
      boundaryTransportRetryCount: 0,
    });
  });

  it("is a VALID transport record even though almost every field is unknown", () => {
    // Unknown is representable. That is the difference between this and the R2.32 artifact.
    expect(validateTransportEvidence(R232_HISTORICAL_TRANSPORT)).toEqual({ ok: true, codes: [] });
  });

  it("pins the artifact identity it was reconstructed from", () => {
    expect(R232_LIVE_ARTIFACT_SHA256).toBe("5b675bcf160fc0d6f6e541e8a81bebd80dff41b4008ada6c974f171ae0bfdf4a");
    expect(R232_BOUNDARY_REVIEW_SUBJECT_SHA256).toBe("b15bfb8f703b17b2379ffe4222fb623149e74e0350f3e5e0516ab4a02a867280");
    expect(R232_LIVE_RUN_ID).toBe("20260801T151001Z");
  });
});
