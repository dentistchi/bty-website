/**
 * NARROW BOUNDARY REVIEW — SCHEMA, COVERAGE, GROUNDING, SERVER VERDICT
 * (Slice 3.2I-R5B1A.1-R2.29 Part 18 · SCHEMA / GROUNDING / VERDICT).
 *
 * Every test here traces to the R2.28 measurement: a reviewer that asserted compliance without
 * evidence, in an aggregate field, under a model-authored top-level verdict.
 */
import { describe, expect, it } from "vitest";
import {
  BOUNDARY_REVIEW_OUTCOMES,
  MAX_BOUNDARY_REVIEW_CALLS_PER_SUBJECT,
  MAX_NARROW_ASSESSMENTS,
  NARROW_BOUNDARY_JSON_SCHEMA,
  NARROW_EVIDENCE_MAX,
  NARROW_REASON_MAX,
  SURFACE_RESULTS,
  allowsBroadReview,
  boundaryReviewCountsAsGenerationRetry,
  decideAfterBoundaryReview,
  deriveBoundaryVerdict,
  producesCorrectionPacket,
  validateNarrowBoundaryReview,
  type NarrowReviewContext,
} from "./narrowBoundaryReview";
import { MAX_ACTIVE_BOUNDARIES } from "./boundaryScope";
import { CANONICAL_SURFACE_COUNT, enumerateBoundarySurfaces } from "./boundarySurfaces";
import { draftFixture } from "./boundarySurfaces.test";

const BOUNDARY = { id: "c1_verify", statement: "Two identifiers must be verified before treatment" };
const surfaces = enumerateBoundarySurfaces(draftFixture());
const ctx: NarrowReviewContext = { boundaries: [BOUNDARY], surfaces };

/** A fully compliant response: one assessment per surface, each quoting its OWN surface text. */
const allComply = () =>
  surfaces.map((s) => ({
    boundaryId: BOUNDARY.id,
    surfaceRef: s.coordinate,
    result: "complies" as const,
    evidenceExcerpt: s.text.slice(0, NARROW_EVIDENCE_MAX),
    reason: "keeps the two-identifier check",
  }));

const withResult = (ref: string, result: "violates" | "uncertain", reason = "proceeds without the check") =>
  allComply().map((a) => (a.surfaceRef === ref ? { ...a, result, reason } : a));

describe("strict schema", () => {
  it("[7] has NO model-authored aggregate verdict of any kind", () => {
    const props = Object.keys(NARROW_BOUNDARY_JSON_SCHEMA.properties);
    expect(props).toEqual(["assessments"]);
    const flat = JSON.stringify(NARROW_BOUNDARY_JSON_SCHEMA);
    for (const banned of ["overallVerdict", "boundaryCompliant", "violatedBoundaryIds", "retryInstruction", "conciseExplanation"]) {
      expect(flat).not.toContain(banned);
    }
  });

  it("requires every assessment field and forbids extra properties", () => {
    const item = NARROW_BOUNDARY_JSON_SCHEMA.properties.assessments.items;
    expect(item.additionalProperties).toBe(false);
    expect([...item.required].sort()).toEqual(["boundaryId", "evidenceExcerpt", "reason", "result", "surfaceRef"]);
    expect(Object.keys(item.properties).sort()).toEqual([...item.required].sort());
    expect(NARROW_BOUNDARY_JSON_SCHEMA.additionalProperties).toBe(false);
  });

  it("bounds every text field so the permitted maximum is finite", () => {
    const p = NARROW_BOUNDARY_JSON_SCHEMA.properties.assessments.items.properties;
    expect(p.evidenceExcerpt.maxLength).toBe(NARROW_EVIDENCE_MAX);
    expect(p.reason.maxLength).toBe(NARROW_REASON_MAX);
    expect([...p.result.enum]).toEqual([...SURFACE_RESULTS]);
  });

  it("[11] permits at most MAX_ACTIVE_BOUNDARIES × sixteen assessments", () => {
    expect(MAX_NARROW_ASSESSMENTS).toBe(MAX_ACTIVE_BOUNDARIES * CANONICAL_SURFACE_COUNT);
    expect(NARROW_BOUNDARY_JSON_SCHEMA.properties.assessments.maxItems).toBe(MAX_NARROW_ASSESSMENTS);
  });
});

describe("[6] exact Cartesian coverage", () => {
  it("accepts exactly one assessment per (boundary, surface) pair", () => {
    const r = validateNarrowBoundaryReview({ assessments: allComply() }, ctx);
    expect(r.ok).toBe(true);
  });

  it("requires boundaryCount × surfaceCount assessments for multiple boundaries", () => {
    const two = [BOUNDARY, { id: "c2_consent", statement: "Consent must be recorded before treatment" }];
    const full = two.flatMap((b) => allComply().map((a) => ({ ...a, boundaryId: b.id })));
    const r = validateNarrowBoundaryReview({ assessments: full }, { boundaries: two, surfaces });
    expect(r.ok).toBe(true);
    expect(full).toHaveLength(2 * CANONICAL_SURFACE_COUNT);
  });

  it("[8] rejects a missing assessment", () => {
    const r = validateNarrowBoundaryReview({ assessments: allComply().slice(1) }, ctx);
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.codes).toContain("boundary_review_missing_pair");
  });

  it("[9] rejects an extra assessment for a surface that is not in the map", () => {
    const r = validateNarrowBoundaryReview({ assessments: [...allComply(), { ...allComply()[0]!, surfaceRef: "primary[99]" }] }, ctx);
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.codes).toContain("boundary_review_unknown_surface");
  });

  it("[10] rejects a duplicate (boundary, surface) pair", () => {
    const r = validateNarrowBoundaryReview({ assessments: [...allComply(), allComply()[0]!] }, ctx);
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.codes).toContain("boundary_review_duplicate_pair");
  });

  it("rejects an unknown boundary id", () => {
    const r = validateNarrowBoundaryReview({ assessments: allComply().map((a) => ({ ...a, boundaryId: "c9_invented" })) }, ctx);
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.codes).toContain("boundary_review_unknown_boundary");
  });

  it("rejects a non-object and a missing assessments array", () => {
    expect(validateNarrowBoundaryReview(null, ctx)).toMatchObject({ ok: false, codes: ["boundary_review_not_an_object"] });
    expect(validateNarrowBoundaryReview({}, ctx)).toMatchObject({ ok: false, codes: ["boundary_review_assessments_missing"] });
  });

  it("rejects a result outside the enum", () => {
    const r = validateNarrowBoundaryReview({ assessments: allComply().map((a) => ({ ...a, result: "probably_fine" })) }, ctx);
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.codes).toContain("boundary_review_invalid_result");
  });
});

describe("evidence grounding", () => {
  it("[12] requires evidence — an empty excerpt can never assert compliance", () => {
    const r = validateNarrowBoundaryReview({ assessments: allComply().map((a) => ({ ...a, evidenceExcerpt: "  " })) }, ctx);
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.codes).toContain("boundary_evidence_missing");
  });

  it("[13] accepts a faithful excerpt of the SAME surface, including a partial one", () => {
    const partial = allComply().map((a, i) => (i === 1 ? { ...a, evidenceExcerpt: "proceed with one patient" } : a));
    expect(validateNarrowBoundaryReview({ assessments: partial }, ctx).ok).toBe(true);
  });

  it("[13b] is punctuation- and case-insensitive, so a faithful quote is not rejected on typography", () => {
    const quoted = allComply().map((a, i) => (i === 1 ? { ...a, evidenceExcerpt: "PROCEED with one patient." } : a));
    expect(validateNarrowBoundaryReview({ assessments: quoted }, ctx).ok).toBe(true);
  });

  it("[14] rejects evidence lifted from a DIFFERENT surface", () => {
    const stolen = allComply().map((a) =>
      a.surfaceRef === "branch[1].action[1]" ? { ...a, evidenceExcerpt: "Prepare a summary of events" } : a,
    );
    const r = validateNarrowBoundaryReview({ assessments: stolen }, ctx);
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.codes).toContain("boundary_evidence_from_other_surface");
    expect(r.ok === false && r.findings.map((f) => f.surfaceRef)).toContain("branch[1].action[1]");
  });

  it("[15] rejects evidence that merely repeats the boundary statement", () => {
    const r = validateNarrowBoundaryReview(
      { assessments: allComply().map((a) => ({ ...a, evidenceExcerpt: "Two identifiers must be verified before treatment" })) },
      ctx,
    );
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.codes).toContain("boundary_evidence_restates_boundary");
  });

  it("[16] rejects the exact generic assertion R2.28 measured", () => {
    // "The verification boundary is present and operationalized, ensuring compliance."
    const r = validateNarrowBoundaryReview({ assessments: allComply().map((a) => ({ ...a, evidenceExcerpt: "ensuring compliance" })) }, ctx);
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.codes).toContain("boundary_evidence_generic");
  });

  it("[16b] rejects a coincidental fragment too short to prove anything", () => {
    const r = validateNarrowBoundaryReview({ assessments: allComply().map((a) => ({ ...a, evidenceExcerpt: "the" })) }, ctx);
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.codes).toContain("boundary_evidence_too_short");
  });

  it("[16c] rejects invented text grounded in nothing", () => {
    const r = validateNarrowBoundaryReview(
      { assessments: allComply().map((a) => ({ ...a, evidenceExcerpt: "the nurse scanned both wristbands twice" })) },
      ctx,
    );
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.codes).toContain("boundary_evidence_ungrounded");
  });

  it("requires a reason on every result, including uncertain", () => {
    const r = validateNarrowBoundaryReview({ assessments: withResult("primary[1]", "uncertain", "  ") }, ctx);
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.codes).toContain("boundary_reason_missing");
  });

  it("[17] PRESERVES the violation excerpt through derivation", () => {
    const v = deriveBoundaryVerdict({ assessments: withResult("branch[1].resulting_world_state", "violates") }, ctx);
    expect(v.outcome).toBe("boundary_review_reject");
    if (v.outcome !== "boundary_review_reject") throw new Error("unreachable");
    expect(v.violations[0]).toMatchObject({
      boundaryId: "c1_verify",
      boundaryStatement: "Two identifiers must be verified before treatment",
      surfaceRef: "branch[1].resulting_world_state",
      reason: "proceeds without the check",
    });
    expect(v.violations[0]!.evidenceExcerpt).toContain("remains unverified");
  });
});

describe("server-derived verdict", () => {
  it("[18] all comply → pass", () => {
    expect(deriveBoundaryVerdict({ assessments: allComply() }, ctx)).toEqual({ outcome: "boundary_review_pass", assessedPairs: 16 });
  });

  it("[19] one violation → reject, carrying boundary id, coordinate, evidence and reason", () => {
    const v = deriveBoundaryVerdict({ assessments: withResult("primary[1]", "violates") }, ctx);
    expect(v.outcome).toBe("boundary_review_reject");
    expect(producesCorrectionPacket(v)).toBe(true);
  });

  it("[19b] a violation OUTRANKS an uncertainty elsewhere", () => {
    const mixed = allComply().map((a) =>
      a.surfaceRef === "primary[1]"
        ? { ...a, result: "violates" as const }
        : a.surfaceRef === "flat_action[1]"
          ? { ...a, result: "uncertain" as const, reason: "label does not say whether verification happened" }
          : a,
    );
    expect(deriveBoundaryVerdict({ assessments: mixed }, ctx).outcome).toBe("boundary_review_reject");
  });

  it("[20] uncertain → inconclusive, and is NOT a generator content defect", () => {
    const v = deriveBoundaryVerdict({ assessments: withResult("flat_action[1]", "uncertain", "the label does not state the order") }, ctx);
    expect(v.outcome).toBe("boundary_review_inconclusive");
    expect(producesCorrectionPacket(v)).toBe(false);
    if (v.outcome !== "boundary_review_inconclusive") throw new Error("unreachable");
    expect(v.uncertainties[0]).toMatchObject({ surfaceRef: "flat_action[1]", reason: "the label does not state the order" });
  });

  it("[21] coverage or grounding failure → malformed", () => {
    expect(deriveBoundaryVerdict({ assessments: allComply().slice(2) }, ctx).outcome).toBe("boundary_review_malformed");
    expect(deriveBoundaryVerdict({ assessments: allComply().map((a) => ({ ...a, evidenceExcerpt: "" })) }, ctx).outcome).toBe("boundary_review_malformed");
  });

  it("never infers pass from the absence of violations — every pair must be explicitly compliant", () => {
    // A response the model could produce by answering about only some surfaces must not pass.
    const partial = allComply().slice(0, 8);
    expect(deriveBoundaryVerdict({ assessments: partial }, ctx).outcome).toBe("boundary_review_malformed");
  });

  it("[23] the R2.28 aggregate shape has no representation here", () => {
    // The old DTO's whole boundary claim, submitted as this schema, is not even parseable as
    // coverage — there is no field in which "all choices comply" can be said.
    const aggregate = {
      assessments: [],
      boundaryCompliant: true,
      violatedBoundaryIds: [],
      overallVerdict: "accept",
    };
    const v = deriveBoundaryVerdict(aggregate, ctx);
    expect(v.outcome).toBe("boundary_review_malformed");
    expect(BOUNDARY_REVIEW_OUTCOMES).not.toContain("accept");
  });
});

describe("rerun authority", () => {
  it("[21b] first malformed → exactly one rerun over the identical frozen subject", () => {
    const d = decideAfterBoundaryReview(1, { kind: "derived", verdict: { outcome: "boundary_review_malformed", codes: ["boundary_review_missing_pair"], findings: [] } });
    expect(d.action).toBe("rerun_boundary_review");
  });

  it("[22] second malformed → terminal reviewer failure, never a third call", () => {
    const d = decideAfterBoundaryReview(2, { kind: "derived", verdict: { outcome: "boundary_review_malformed", codes: ["boundary_review_missing_pair"], findings: [] } });
    expect(d.action).toBe("boundary_reviewer_terminal_failure");
    expect(MAX_BOUNDARY_REVIEW_CALLS_PER_SUBJECT).toBe(2);
    expect(decideAfterBoundaryReview(3, { kind: "derived", verdict: { outcome: "boundary_review_pass", assessedPairs: 16 } })).toMatchObject({
      action: "boundary_reviewer_infrastructure_failure",
      code: "boundary_review_attempt_budget_violated",
    });
  });

  it("a valid reject or inconclusive is terminal on the FIRST call — it is not rerun away", () => {
    expect(decideAfterBoundaryReview(1, { kind: "derived", verdict: { outcome: "boundary_review_reject", violations: [], assessedPairs: 16 } }).action).toBe("correction_path");
    expect(decideAfterBoundaryReview(1, { kind: "derived", verdict: { outcome: "boundary_review_inconclusive", uncertainties: [], assessedPairs: 16 } }).action).toBe("inconclusive");
  });

  it("a transport failure is never a scenario verdict", () => {
    expect(decideAfterBoundaryReview(1, { kind: "transport_failed" })).toMatchObject({
      action: "boundary_reviewer_infrastructure_failure",
      code: "boundary_review_transport_failed",
    });
  });

  it("[30] a boundary-review rerun is never counted as a generation retry", () => {
    expect(boundaryReviewCountsAsGenerationRetry({ action: "rerun_boundary_review", because: "x" })).toBe(false);
    expect(boundaryReviewCountsAsGenerationRetry({ action: "boundary_reviewer_terminal_failure", because: "x" })).toBe(false);
    expect(boundaryReviewCountsAsGenerationRetry({ action: "correction_path" })).toBe(true);
  });
});

describe("stage precedence", () => {
  it("only pass and not-applicable permit the broad reviewer to run", () => {
    expect(allowsBroadReview("boundary_review_pass")).toBe(true);
    expect(allowsBroadReview("boundary_review_not_applicable")).toBe(true);
    for (const o of ["boundary_review_reject", "boundary_review_inconclusive", "boundary_review_malformed"] as const) {
      expect(allowsBroadReview(o)).toBe(false);
    }
  });
});
