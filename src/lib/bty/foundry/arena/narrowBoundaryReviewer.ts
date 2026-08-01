/**
 * THE NARROW BOUNDARY-REVIEW PROVIDER CALL (Slice 3.2I-R5B1A.1-R2.34).
 *
 * One structured call, one question per (boundary × surface) pair, and a verdict the SERVER derives
 * from the answers. This module evaluates; it never authors, and it imports no generation seam.
 *
 * R2.34 — WHAT THE TRANSPORT LAYER NOW RECORDS
 *
 * R2.33 measured a live call that started, ran 459 ms and produced nothing, leaving an artifact that
 * said only `boundary_review_request_failed`. The client had thrown with the HTTP status inside its
 * message and the outer `catch { }` — with no bound parameter — discarded it. The provider-side
 * cause became unknowable and a retry could only have produced a second silent artifact.
 *
 * Now every exit path fills a `BoundaryTransportEvidence` record: whether the invocation started,
 * whether a response arrived, the status, the provider code, retry-after, the failure layer, the
 * timeout state and a sanitized message and cause chain. A PROVIDER failure is reported as such and
 * never as a semantic reviewer attempt.
 *
 * TIMEOUT OWNERSHIP. `NARROW_BOUNDARY_SAMPLING.timeoutMs` was recorded in the contract and in the
 * manifest but never applied — no signal was passed. There is now exactly ONE owner here: an
 * AbortController armed immediately before the call and cleared on every path.
 */

import { canonicalJson } from "@/domain/foundry/arena-draft/reviewSubject";
import {
  classifyFailure,
  deriveBoundaryVerdict,
  type NarrowReviewContext,
  type DerivedBoundaryVerdict,
  type NarrowBoundaryCode,
  NARROW_BOUNDARY_JSON_SCHEMA,
  NARROW_BOUNDARY_SCHEMA_NAME,
} from "@/domain/foundry/arena-draft/narrowBoundaryReview";
import {
  classifyProviderFailure,
  emptyTransportEvidence,
  hashRequestId,
  sanitizeCauseChain,
  sanitizeMessage,
  type BoundaryTransportEvidence,
  type ProviderFailureCode,
} from "@/domain/foundry/arena-draft/boundaryTransportEvidence";
import { LlmHttpError, getLlmClient, getLlmModel } from "@/lib/bty/llm/client";
import {
  NARROW_BOUNDARY_SAMPLING,
  NARROW_BOUNDARY_SYSTEM_PROMPT,
  buildNarrowBoundaryRequest,
  narrowBoundarySubjectSha256,
  type NarrowBoundarySubject,
} from "./narrowBoundaryContract";

export const NARROW_TIMEOUT_OWNER = "narrowBoundaryReviewer.AbortController";

/** Everything one narrow call produced, sanitized. Persisted verbatim as attempt evidence. */
export type NarrowBoundaryEvidence = {
  boundaryReviewAttempt: number;
  boundaryReviewSubjectSha256: string;
  surfaceMapSha256: string;
  activeBoundaryIds: string[];
  requiredAssessmentCount: number;
  /** The complete parsed DTO, exactly as returned. Never summarized before it is stored. */
  parsed: unknown;
  outcome: DerivedBoundaryVerdict["outcome"];
  verdict: DerivedBoundaryVerdict;
  finishReason: string | null;
  latencyMs: number;
  /** Sanitized: no headers, no body, no provider account metadata. */
  sanitizedError: string | null;
  /** R2.34 — the complete transport record. Present on EVERY path, success included. */
  transport: BoundaryTransportEvidence;
  /** Set only when the call failed below the semantic layer. */
  providerFailureCode: ProviderFailureCode | null;
};

export type NarrowBoundaryCallResult =
  | { kind: "derived"; verdict: DerivedBoundaryVerdict; evidence: NarrowBoundaryEvidence }
  | { kind: "transport_failed"; evidence: NarrowBoundaryEvidence };

function stripJsonFences(text: string): string {
  const t = text.trim();
  if (!t.startsWith("```")) return t;
  return t.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
}

/** Read the provider's error payload shape without trusting it. Structured signal only. */
function readProviderErrorPayload(body: unknown): { type: string | null; code: string | null } {
  const err = (body as { error?: unknown } | null)?.error;
  if (!err || typeof err !== "object") return { type: null, code: null };
  const e = err as { type?: unknown; code?: unknown };
  return {
    type: typeof e.type === "string" ? e.type : null,
    code: typeof e.code === "string" ? e.code : null,
  };
}

/**
 * Review ONE frozen narrow boundary subject exactly once.
 *
 * The caller owns the rerun budget; this function never retries and never calls the provider more
 * than once. A transport failure is returned as `transport_failed` with complete evidence — it is
 * NOT a semantic attempt and must not be counted as one.
 */
export async function reviewBoundarySurfaces(
  subject: NarrowBoundarySubject,
  attempt: number,
  surfaceRefs?: readonly string[],
  deps?: { now?: () => number },
): Promise<NarrowBoundaryCallResult> {
  const now = deps?.now ?? (() => Date.now());
  const startedAt = now();
  // R2.42 — a failed-subset repair asks ONLY about the surfaces that failed. R2.41 measured this
  // parameter being declared by the stage and silently dropped here, so every "repair" was a full
  // twelve-surface re-ask whose answer the merge authority would then have refused.
  const request = buildNarrowBoundaryRequest(subject, surfaceRefs);
  const scoped = surfaceRefs ? subject.surfaces.filter((s) => surfaceRefs.includes(s.coordinate)) : subject.surfaces;
  // R2.38 — the validator resolves the SAME candidate menu the model chose from, so an id becomes
  // evidence only through the server's own map. There is no path from model text to authority.
  // On a repair it is narrowed to the requested surfaces, so coverage is judged against what was
  // actually asked; the candidate map and every authority digest stay the frozen subject's.
  const ctx: NarrowReviewContext = {
    boundaries: subject.boundaries,
    surfaces: scoped,
    frames: subject.semanticFrames,
    candidates: subject.evidenceCandidates,
  };

  const subjectSha = narrowBoundarySubjectSha256(subject);
  const transport = emptyTransportEvidence(`${subjectSha.slice(0, 12)}#${attempt}`);
  transport.requestConstructed = true;

  const base = {
    boundaryReviewAttempt: attempt,
    boundaryReviewSubjectSha256: subjectSha,
    surfaceMapSha256: subject.surfaceMapSha256,
    activeBoundaryIds: subject.activeBoundaryIds,
    requiredAssessmentCount: request.requiredAssessmentCount,
  };

  const finish = () => {
    transport.providerInvocationEndedAt = now();
    transport.latencyMs = transport.providerInvocationStartedAt === null ? null : transport.providerInvocationEndedAt - transport.providerInvocationStartedAt;
  };

  /** A response arrived (or did not) but no semantic DTO exists. NEVER a semantic attempt. */
  const transportFailure = (): NarrowBoundaryCallResult => {
    const classification = classifyProviderFailure({
      responseState: transport.responseState,
      httpStatus: transport.httpStatus,
      providerErrorType: transport.providerErrorType,
      providerErrorCode: transport.providerErrorCode,
      abortObserved: transport.abortObserved,
      timeoutState: transport.timeoutState,
      localErrorName: transport.localErrorName,
      sanitizedMessage: transport.sanitizedMessage,
      structuredOutputPresent: transport.structuredOutputPresent,
      responseEnvelopePresent: transport.responseEnvelopePresent,
    });
    transport.retriability = classification.retriability;
    transport.retriabilityReason = classification.retriabilityReason;
    transport.failureLayer = classification.failureLayer;
    transport.evidenceSource = classification.evidenceSource;

    // R2.34 — a transport failure NEVER carries `boundary_review_not_json`: no body ever arrived to
    // fail at parsing. Its own code says what happened.
    const verdict: DerivedBoundaryVerdict = {
      outcome: "boundary_review_malformed",
      codes: ["boundary_review_transport_failed"],
      findings: [],
      failureClass: "transport",
      validSurfaceRefs: [],
      failedSurfaceRefs: [],
      derived: [],
    };
    return {
      kind: "transport_failed",
      evidence: {
        ...base,
        parsed: null,
        outcome: verdict.outcome,
        verdict,
        finishReason: null,
        latencyMs: transport.latencyMs ?? now() - startedAt,
        sanitizedError: transport.sanitizedMessage || "boundary_review_request_failed",
        transport,
        providerFailureCode: classification.providerFailureCode,
      },
    };
  };

  /** A response DID arrive and was readable, but the body is unusable. This IS a semantic attempt. */
  const malformed = (code: NarrowBoundaryCode, parsed: unknown, finishReason: string | null): NarrowBoundaryCallResult => {
    const verdict: DerivedBoundaryVerdict = { outcome: "boundary_review_malformed", codes: [code], findings: [], failureClass: classifyFailure([code]), validSurfaceRefs: [], failedSurfaceRefs: [], derived: [] };
    return {
      kind: "derived",
      verdict,
      evidence: {
        ...base,
        parsed,
        outcome: verdict.outcome,
        verdict,
        finishReason,
        latencyMs: transport.latencyMs ?? now() - startedAt,
        sanitizedError: null,
        transport,
        providerFailureCode: null,
      },
    };
  };

  // ---- ONE timeout owner, armed immediately before the call -----------------
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), NARROW_BOUNDARY_SAMPLING.timeoutMs);
  transport.timeoutOwner = NARROW_TIMEOUT_OWNER;
  transport.timeoutState = "armed_not_fired";

  try {
    transport.clientInvocationStarted = true;
    transport.providerInvocationStarted = true;
    transport.providerInvocationStartedAt = now();

    const completion = await getLlmClient().chat.completions.create(
      {
        model: getLlmModel(),
        messages: [
          { role: "system", content: NARROW_BOUNDARY_SYSTEM_PROMPT },
          { role: "user", content: canonicalJson(request) },
        ],
        temperature: NARROW_BOUNDARY_SAMPLING.temperature,
        top_p: NARROW_BOUNDARY_SAMPLING.topP,
        max_tokens: NARROW_BOUNDARY_SAMPLING.maxTokens,
        response_format: {
          type: "json_schema",
          json_schema: { name: NARROW_BOUNDARY_SCHEMA_NAME, strict: true, schema: NARROW_BOUNDARY_JSON_SCHEMA },
        },
      },
      { signal: controller.signal },
    );

    finish();
    transport.responseState = "response_received";
    transport.responseEnvelopePresent = true;
    transport.tokenUsagePresent = Boolean((completion as { usage?: unknown }).usage);

    const rc = completion.choices?.[0];
    const finishReason = rc?.finish_reason ?? null;
    if (finishReason === "length") {
      transport.structuredOutputPresent = true;
      return malformed("boundary_review_truncated", null, finishReason);
    }

    const raw = rc?.message?.content;
    if (!raw) {
      // A success envelope with no content: the response WAS received, so this is a provider
      // response-parse failure, not a network failure.
      transport.structuredOutputPresent = false;
      transport.sanitizedMessage = "provider returned a success envelope with no message content";
      transport.localErrorName = null;
      return transportFailure();
    }
    transport.structuredOutputPresent = true;

    let parsed: unknown;
    try {
      parsed = JSON.parse(stripJsonFences(raw));
    } catch {
      return malformed("boundary_review_not_json", null, finishReason);
    }

    // Coverage, grounding and the verdict itself — all server-side, all from the per-surface answers.
    const verdict = deriveBoundaryVerdict(parsed, ctx);
    return {
      kind: "derived",
      verdict,
      evidence: {
        ...base,
        parsed,
        outcome: verdict.outcome,
        verdict,
        finishReason,
        latencyMs: transport.latencyMs ?? now() - startedAt,
        sanitizedError: null,
        transport,
        providerFailureCode: null,
      },
    };
  } catch (error) {
    // R2.34 — THE ERROR IS BOUND. This is the line whose absence made R2.32 unclassifiable.
    finish();
    const name = (error as { name?: unknown } | null)?.name;
    transport.localErrorName = typeof name === "string" ? name : null;
    const code = (error as { code?: unknown } | null)?.code;
    transport.localErrorCode = typeof code === "string" ? code : null;
    transport.sanitizedMessage = sanitizeMessage((error as { message?: unknown } | null)?.message ?? error);
    transport.sanitizedCauseChain = sanitizeCauseChain(error);

    if (error instanceof LlmHttpError) {
      // A response was definitely received: we read its status.
      transport.responseState = "response_received";
      transport.httpStatus = error.status;
      const payload = readProviderErrorPayload(error.body);
      transport.providerErrorType = payload.type;
      transport.providerErrorCode = payload.code;
      transport.retryAfterMs = error.retryAfterSeconds === null ? null : error.retryAfterSeconds * 1000;
      transport.providerRequestIdHash = error.requestId ? hashRequestId(error.requestId) : null;
    } else if (controller.signal.aborted || transport.localErrorName === "AbortError") {
      transport.responseState = "no_response";
      transport.abortObserved = true;
      transport.timeoutState = "fired_local";
    } else if (transport.localErrorName === "TypeError") {
      // Node's fetch rejects with TypeError when no response was obtained.
      transport.responseState = "no_response";
    } else {
      // The adapter genuinely cannot tell. `unknown` is a value, not an empty string.
      transport.responseState = "unknown";
    }
    return transportFailure();
  } finally {
    clearTimeout(timer);
    if (transport.timeoutState === "armed_not_fired" && controller.signal.aborted) transport.timeoutState = "fired_local";
  }
}
