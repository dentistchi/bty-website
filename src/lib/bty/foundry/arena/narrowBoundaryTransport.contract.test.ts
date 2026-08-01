/**
 * NARROW REVIEWER TRANSPORT WIRING (Slice 3.2I-R5B1A.1-R2.34 Parts 2, 7, 8, 12).
 *
 * These drive the REAL `reviewBoundarySurfaces` with only the LLM client mocked, so they prove the
 * wiring R2.33 found missing: the error is bound, a signal reaches the client, the timer is cleared
 * on every path, and a transport failure never presents itself as a semantic attempt.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// `vi.mock` is hoisted, so the double and the error class must be created inside `vi.hoisted`.
const H = vi.hoisted(() => {
  class MockLlmHttpError extends Error {
    readonly name = "LlmHttpError";
    constructor(
      readonly status: number,
      readonly statusText: string,
      readonly body: unknown = null,
      readonly retryAfterSeconds: number | null = null,
      readonly requestId: string | null = null,
    ) {
      super(`LLM API error: ${status} ${statusText}`);
    }
  }
  return { mockCreate: vi.fn(), MockLlmHttpError };
});
const mockCreate = H.mockCreate;
const MockLlmHttpError = H.MockLlmHttpError;

vi.mock("@/lib/bty/llm/client", () => ({
  getLlmModel: () => "test-model",
  getLlmClient: () => ({ chat: { completions: { create: H.mockCreate } } }),
  LlmHttpError: H.MockLlmHttpError,
}));

import { NARROW_TIMEOUT_OWNER, reviewBoundarySurfaces } from "./narrowBoundaryReviewer";
import { buildNarrowBoundarySubject } from "./narrowBoundaryContract";
import { enumerateBoundarySurfaces } from "@/domain/foundry/arena-draft/boundarySurfaces";
import { C18_BOUNDARY, C18_SCENARIO } from "@/domain/foundry/arena-draft/c18BoundaryFixture";
import { validateTransportEvidence } from "@/domain/foundry/arena-draft/boundaryTransportEvidence";

const subject = buildNarrowBoundarySubject({
  scenarioSha256: "s".repeat(64),
  reviewSubjectSha256: "r".repeat(64),
  boundaryProvenance: { activeBoundaryIds: [C18_BOUNDARY.id] } as never,
  boundaryProvenanceSha256: "p".repeat(64),
  boundaries: [C18_BOUNDARY],
  surfaces: enumerateBoundarySurfaces(C18_SCENARIO, {}),
  language: "en",
  generationAttemptId: "gen1",
  caseId: "c18",
});

/** A schema-valid all-settled response, so the success path can be exercised. */
const goodBody = () =>
  JSON.stringify({
    assessments: subject.surfaces.map((s) => ({
      boundaryId: C18_BOUNDARY.id,
      surfaceRef: s.coordinate,
      applicability: "not_applicable",
      compliance: "not_assessed",
      governedActionEvidence: s.text.slice(0, 120),
      prerequisiteFailureEvidence: "",
      violationMechanism: "none",
      reason: "",
    })),
  });

beforeEach(() => mockCreate.mockReset());
afterEach(() => vi.restoreAllMocks());

describe("[27] the timeout signal reaches the provider client", () => {
  it("passes an AbortSignal and names its owner", async () => {
    mockCreate.mockResolvedValue({ choices: [{ message: { content: goodBody() }, finish_reason: "stop" }] });
    const r = await reviewBoundarySurfaces(subject, 1);
    const [, options] = mockCreate.mock.calls[0]!;
    expect(options?.signal).toBeInstanceOf(AbortSignal);
    expect(r.evidence.transport.timeoutOwner).toBe(NARROW_TIMEOUT_OWNER);
    expect(r.evidence.transport.timeoutState).toBe("armed_not_fired");
  });

  it("[28][29] clears the timer on BOTH the success and the failure path", async () => {
    const clearSpy = vi.spyOn(globalThis, "clearTimeout");
    mockCreate.mockResolvedValue({ choices: [{ message: { content: goodBody() }, finish_reason: "stop" }] });
    await reviewBoundarySurfaces(subject, 1);
    const afterSuccess = clearSpy.mock.calls.length;
    expect(afterSuccess).toBeGreaterThan(0);

    mockCreate.mockRejectedValue(new MockLlmHttpError(500, "Internal Server Error"));
    await reviewBoundarySurfaces(subject, 1);
    expect(clearSpy.mock.calls.length).toBeGreaterThan(afterSuccess);
  });

  it("records a local abort as fired_local with no response", async () => {
    const abort = new Error("The operation was aborted");
    abort.name = "AbortError";
    mockCreate.mockRejectedValue(abort);
    const r = await reviewBoundarySurfaces(subject, 1);
    expect(r.kind).toBe("transport_failed");
    expect(r.evidence.transport.abortObserved).toBe(true);
    expect(r.evidence.transport.timeoutState).toBe("fired_local");
    expect(r.evidence.transport.responseState).toBe("no_response");
    expect(r.evidence.providerFailureCode).toBe("local_timeout_abort");
  });
});

describe("[2] the error is BOUND — the line whose absence made R2.32 unclassifiable", () => {
  it("[1] captures status, provider code, retry-after and a hashed request id from an HTTP error", async () => {
    mockCreate.mockRejectedValue(
      new MockLlmHttpError(429, "Too Many Requests", { error: { type: "insufficient_quota", code: "insufficient_quota" } }, 30, "req_abc123"),
    );
    const r = await reviewBoundarySurfaces(subject, 1);
    expect(r.kind).toBe("transport_failed");
    const t = r.evidence.transport;
    expect(t.responseState).toBe("response_received");
    expect(t.httpStatus).toBe(429);
    expect(t.providerErrorCode).toBe("insufficient_quota");
    expect(t.providerErrorType).toBe("insufficient_quota");
    expect(t.retryAfterMs).toBe(30000);
    expect(t.providerRequestIdHash).toMatch(/^[0-9a-f]{32}$/);
    expect(t.providerRequestIdHash).not.toContain("req_abc123");
    expect(r.evidence.providerFailureCode).toBe("provider_quota_failure");
    expect(t.retriability).toBe("non_retriable");
  });

  it("[9] a fetch TypeError is recorded as no_response, not as unknown", async () => {
    const e = new TypeError("fetch failed");
    mockCreate.mockRejectedValue(e);
    const r = await reviewBoundarySurfaces(subject, 1);
    expect(r.evidence.transport.responseState).toBe("no_response");
    expect(r.evidence.transport.localErrorName).toBe("TypeError");
    expect(r.evidence.providerFailureCode).toBe("provider_network_failure");
  });

  it("[15] an unknown error object yields responseState unknown, never a guess", async () => {
    mockCreate.mockRejectedValue({ weird: true });
    const r = await reviewBoundarySurfaces(subject, 1);
    expect(r.evidence.transport.responseState).toBe("unknown");
    expect(r.evidence.providerFailureCode).toBe("provider_failure_unknown");
    expect(r.evidence.transport.retriability).toBe("unknown");
  });

  it("[16] sanitizes a credential echoed in a nested cause", async () => {
    const inner = new Error("Authorization: Bearer sk-verysecretvalue1234567");
    mockCreate.mockRejectedValue(new Error("upstream rejected", { cause: inner }));
    const r = await reviewBoundarySurfaces(subject, 1);
    const blob = JSON.stringify(r.evidence.transport);
    expect(blob).not.toContain("sk-verysecretvalue1234567");
    expect(r.evidence.transport.sanitizedCauseChain.join(" ")).toContain("[redacted");
  });

  it("every failure path produces a VALID transport record", async () => {
    for (const error of [new MockLlmHttpError(401, "Unauthorized"), new TypeError("fetch failed"), { weird: true }]) {
      mockCreate.mockRejectedValue(error);
      const r = await reviewBoundarySurfaces(subject, 1);
      expect(validateTransportEvidence(r.evidence.transport)).toEqual({ ok: true, codes: [] });
    }
  });
});

describe("[18][19][21] a transport failure is not a semantic attempt", () => {
  it("[19] never emits boundary_review_not_json, and is classed `transport`", async () => {
    mockCreate.mockRejectedValue(new MockLlmHttpError(503, "Service Unavailable"));
    const r = await reviewBoundarySurfaces(subject, 1);
    expect(r.kind).toBe("transport_failed");
    const v = r.evidence.verdict;
    expect(v.outcome === "boundary_review_malformed" && v.codes).toEqual(["boundary_review_transport_failed"]);
    expect(v.outcome === "boundary_review_malformed" && v.failureClass).toBe("transport");
  });

  it("[18] produces zero semantic findings and no parsed DTO", async () => {
    mockCreate.mockRejectedValue(new MockLlmHttpError(500, "Internal Server Error"));
    const r = await reviewBoundarySurfaces(subject, 1);
    expect(r.evidence.parsed).toBeNull();
    expect(r.evidence.finishReason).toBeNull();
  });

  it("[21] the invocation is still recorded — a failed call still cost a call", async () => {
    mockCreate.mockRejectedValue(new MockLlmHttpError(500, "Internal Server Error"));
    const r = await reviewBoundarySurfaces(subject, 1);
    expect(r.evidence.transport.providerInvocationStarted).toBe(true);
    expect(r.evidence.transport.clientInvocationStarted).toBe(true);
    expect(r.evidence.transport.requestConstructed).toBe(true);
    expect(typeof r.evidence.transport.latencyMs).toBe("number");
  });

  it("[13] a success envelope with unreadable content is a transport-layer parse failure", async () => {
    mockCreate.mockResolvedValue({ choices: [{ message: { content: null }, finish_reason: "stop" }] });
    const r = await reviewBoundarySurfaces(subject, 1);
    expect(r.kind).toBe("transport_failed");
    expect(r.evidence.transport.responseState).toBe("response_received");
    expect(r.evidence.transport.responseEnvelopePresent).toBe(true);
    expect(r.evidence.providerFailureCode).toBe("provider_response_parse_failure");
  });

  it("a body that arrives but is not JSON IS a semantic attempt, not a transport failure", async () => {
    mockCreate.mockResolvedValue({ choices: [{ message: { content: "not json {{{" }, finish_reason: "stop" }] });
    const r = await reviewBoundarySurfaces(subject, 1);
    expect(r.kind).toBe("derived");
    expect(r.evidence.providerFailureCode).toBeNull();
    expect(r.evidence.transport.responseState).toBe("response_received");
    expect(r.evidence.transport.structuredOutputPresent).toBe(true);
  });

  it("a SUCCESSFUL call records a complete transport record too", async () => {
    mockCreate.mockResolvedValue({ choices: [{ message: { content: goodBody() }, finish_reason: "stop" }], usage: { total_tokens: 10 } });
    const r = await reviewBoundarySurfaces(subject, 1);
    expect(r.kind).toBe("derived");
    expect(r.evidence.transport.responseState).toBe("response_received");
    expect(r.evidence.transport.tokenUsagePresent).toBe(true);
    expect(r.evidence.providerFailureCode).toBeNull();
    expect(validateTransportEvidence(r.evidence.transport)).toEqual({ ok: true, codes: [] });
  });

  it("[23] never retries by itself — exactly one client call per invocation", async () => {
    mockCreate.mockRejectedValue(new MockLlmHttpError(503, "Service Unavailable"));
    await reviewBoundarySurfaces(subject, 1);
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });
});
