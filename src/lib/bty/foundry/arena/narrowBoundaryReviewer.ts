/**
 * THE NARROW BOUNDARY-REVIEW PROVIDER CALL (Slice 3.2I-R5B1A.1-R2.29).
 *
 * One structured call, one question per (boundary × surface) pair, and a verdict the SERVER derives
 * from the answers. This module evaluates; it never authors, and it imports no generation seam — a
 * boundary safety review that could regenerate content would not be a review.
 *
 * Every response path returns a `DerivedBoundaryVerdict`, so truncation, unparseable JSON, coverage
 * failure and ungrounded evidence are all handled by the same rerun authority instead of each
 * inventing its own recovery.
 */

import { canonicalJson } from "@/domain/foundry/arena-draft/reviewSubject";
import {
  classifyFailure,
  deriveBoundaryVerdict,
  type DerivedBoundaryVerdict,
  type NarrowBoundaryCode,
  NARROW_BOUNDARY_JSON_SCHEMA,
  NARROW_BOUNDARY_SCHEMA_NAME,
} from "@/domain/foundry/arena-draft/narrowBoundaryReview";
import { getLlmClient, getLlmModel } from "@/lib/bty/llm/client";
import {
  NARROW_BOUNDARY_SAMPLING,
  NARROW_BOUNDARY_SYSTEM_PROMPT,
  buildNarrowBoundaryRequest,
  narrowBoundarySubjectSha256,
  type NarrowBoundarySubject,
} from "./narrowBoundaryContract";

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
};

export type NarrowBoundaryCallResult =
  | { kind: "derived"; verdict: DerivedBoundaryVerdict; evidence: NarrowBoundaryEvidence }
  | { kind: "transport_failed"; evidence: NarrowBoundaryEvidence };

function stripJsonFences(text: string): string {
  const t = text.trim();
  if (!t.startsWith("```")) return t;
  return t.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
}

/**
 * Review ONE frozen narrow boundary subject exactly once.
 *
 * The caller owns the rerun budget (`decideAfterBoundaryReview`); this function never retries and
 * never calls the provider more than once.
 */
export async function reviewBoundarySurfaces(
  subject: NarrowBoundarySubject,
  attempt: number,
  deps?: { now?: () => number },
): Promise<NarrowBoundaryCallResult> {
  const now = deps?.now ?? (() => Date.now());
  const startedAt = now();
  const request = buildNarrowBoundaryRequest(subject);
  const ctx = { boundaries: subject.boundaries, surfaces: subject.surfaces };

  const base = {
    boundaryReviewAttempt: attempt,
    boundaryReviewSubjectSha256: narrowBoundarySubjectSha256(subject),
    surfaceMapSha256: subject.surfaceMapSha256,
    activeBoundaryIds: subject.activeBoundaryIds,
    requiredAssessmentCount: request.requiredAssessmentCount,
  };
  const malformed = (
    code: NarrowBoundaryCode,
    parsed: unknown,
    finishReason: string | null,
  ): NarrowBoundaryCallResult => {
    const verdict: DerivedBoundaryVerdict = { outcome: "boundary_review_malformed", codes: [code], findings: [], failureClass: classifyFailure([code]) };
    return {
      kind: "derived",
      verdict,
      evidence: { ...base, parsed, outcome: verdict.outcome, verdict, finishReason, latencyMs: now() - startedAt, sanitizedError: null },
    };
  };

  try {
    const completion = await getLlmClient().chat.completions.create({
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
    });

    const rc = completion.choices[0];
    const finishReason = rc?.finish_reason ?? null;
    if (finishReason === "length") return malformed("boundary_review_truncated", null, finishReason);

    const raw = rc?.message?.content;
    if (!raw) {
      const verdict: DerivedBoundaryVerdict = { outcome: "boundary_review_malformed", codes: ["boundary_review_not_json"], findings: [], failureClass: classifyFailure(["boundary_review_not_json"]) };
      return {
        kind: "transport_failed",
        evidence: { ...base, parsed: null, outcome: verdict.outcome, verdict, finishReason, latencyMs: now() - startedAt, sanitizedError: "empty_boundary_review_content" },
      };
    }

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
      evidence: { ...base, parsed, outcome: verdict.outcome, verdict, finishReason, latencyMs: now() - startedAt, sanitizedError: null },
    };
  } catch {
    const verdict: DerivedBoundaryVerdict = { outcome: "boundary_review_malformed", codes: ["boundary_review_not_json"], findings: [], failureClass: classifyFailure(["boundary_review_not_json"]) };
    return {
      kind: "transport_failed",
      evidence: { ...base, parsed: null, outcome: verdict.outcome, verdict, finishReason: null, latencyMs: now() - startedAt, sanitizedError: "boundary_review_request_failed" },
    };
  }
}
