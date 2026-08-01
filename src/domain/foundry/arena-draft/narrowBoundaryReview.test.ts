/**
 * NARROW BOUNDARY REVIEW — APPLICABILITY, GROUNDED MECHANISM, CAUSAL DERIVATION
 * (Slice 3.2I-R5B1A.1-R2.30 Parts 4-7).
 *
 * Every test traces to a measured R2.29 finding: a correct rejection, plus five violations the
 * reviewer asserted from silence rather than from a mechanism.
 */
import { describe, expect, it } from "vitest";
import {
  APPLICABILITY_RESULTS,
  COMPLIANCE_RESULTS,
  MAX_BOUNDARY_REVIEW_CALLS_PER_SUBJECT,
  MAX_NARROW_ASSESSMENTS,
  NARROW_BOUNDARY_JSON_SCHEMA,
  NARROW_EVIDENCE_MAX,
  NARROW_REASON_MAX,
  VIOLATION_MECHANISMS,
  allowsBroadReview,
  boundaryReviewCountsAsGenerationRetry,
  decideAfterBoundaryReview,
  classifyFailure,
  deriveBoundaryVerdict,
  producesCorrectionPacket,
  validateNarrowBoundaryReview,
  type NarrowBoundaryAssessment,
  type NarrowReviewContext,
} from "./narrowBoundaryReview";
import { MAX_ACTIVE_BOUNDARIES } from "./boundaryScope";
import { BRANCH_AWARE_REACHABLE_SURFACE_COUNT, enumerateBoundarySurfaces, reviewableSurfaces } from "./boundarySurfaces";
import { draftFixture } from "./boundarySurfaces.test";

const BOUNDARY = { id: "c1_verify", statement: "Two identifiers must be verified before treatment" };
const surfaces = reviewableSurfaces(enumerateBoundarySurfaces(draftFixture()));
const ctx: NarrowReviewContext = { boundaries: [BOUNDARY], surfaces };
const at = (ref: string) => surfaces.find((s) => s.coordinate === ref)!;

/** Baseline: every surface `not_applicable`, each showing what it actually does. */
const baseline = (): NarrowBoundaryAssessment[] =>
  surfaces.map((s) => ({
    boundaryId: BOUNDARY.id,
    surfaceRef: s.coordinate,
    applicability: "not_applicable" as const,
    compliance: "not_assessed" as const,
    governedActionEvidence: s.text.slice(0, NARROW_EVIDENCE_MAX),
    prerequisiteFailureEvidence: "",
    violationMechanism: "none" as const,
    reason: "this surface does not treat a patient",
  }));

const withRow = (ref: string, over: Partial<NarrowBoundaryAssessment>) =>
  baseline().map((a) => (a.surfaceRef === ref ? { ...a, ...over } : a));

/** A fully grounded violation at one surface. */
const violationAt = (ref: string, mechanism: NarrowBoundaryAssessment["violationMechanism"] = "governed_action_without_prerequisite", governed?: string) =>
  withRow(ref, {
    applicability: "applies",
    compliance: "violates",
    governedActionEvidence: governed ?? at(ref).text.slice(0, NARROW_EVIDENCE_MAX),
    prerequisiteFailureEvidence: at(ref).inheritedWorldState
      ? at(ref).inheritedWorldState.slice(0, NARROW_EVIDENCE_MAX)
      : at(ref).text.slice(0, NARROW_EVIDENCE_MAX),
    violationMechanism: mechanism,
    reason: "treats without the two-identifier check",
  });

describe("[11][12][13] strict schema", () => {
  it("asks applicability and compliance separately, and has NO model-authored verdict", () => {
    const props = Object.keys(NARROW_BOUNDARY_JSON_SCHEMA.properties);
    expect(props).toEqual(["assessments"]);
    const item = NARROW_BOUNDARY_JSON_SCHEMA.properties.assessments.items;
    expect([...item.required].sort()).toEqual(
      ["applicability", "boundaryId", "compliance", "governedActionEvidence", "prerequisiteFailureEvidence", "reason", "surfaceRef", "violationMechanism"].sort(),
    );
    expect(item.additionalProperties).toBe(false);
    const flat = JSON.stringify(NARROW_BOUNDARY_JSON_SCHEMA);
    for (const banned of ["overallVerdict", "boundaryCompliant", "violatedBoundaryIds", "retryInstruction"]) {
      expect(flat).not.toContain(banned);
    }
  });

  it("[13] enumerates the violation mechanisms, with `none` as the non-violation value", () => {
    expect([...NARROW_BOUNDARY_JSON_SCHEMA.properties.assessments.items.properties.violationMechanism.enum]).toEqual([...VIOLATION_MECHANISMS]);
    expect(VIOLATION_MECHANISMS[0]).toBe("none");
    expect(VIOLATION_MECHANISMS).toContain("governed_action_without_prerequisite");
    expect(VIOLATION_MECHANISMS).toContain("resulting_state_missing_prerequisite");
    expect(VIOLATION_MECHANISMS).toContain("boundary_reopened_after_prior_compliance");
    expect(VIOLATION_MECHANISMS).toContain("explicit_boundary_contradiction");
    expect(VIOLATION_MECHANISMS).toContain("other_grounded_violation");
  });

  it("bounds every text field, and the matrix is boundaries x REACHABLE surfaces", () => {
    const p = NARROW_BOUNDARY_JSON_SCHEMA.properties.assessments.items.properties;
    expect(p.governedActionEvidence.maxLength).toBe(NARROW_EVIDENCE_MAX);
    expect(p.prerequisiteFailureEvidence.maxLength).toBe(NARROW_EVIDENCE_MAX);
    expect(p.reason.maxLength).toBe(NARROW_REASON_MAX);
    expect(MAX_NARROW_ASSESSMENTS).toBe(MAX_ACTIVE_BOUNDARIES * BRANCH_AWARE_REACHABLE_SURFACE_COUNT);
    expect([...p.applicability.enum]).toEqual([...APPLICABILITY_RESULTS]);
    expect([...p.compliance.enum]).toEqual([...COMPLIANCE_RESULTS]);
  });
});

describe("coverage over REACHABLE surfaces only", () => {
  it("accepts exactly one assessment per (boundary, reachable surface) pair", () => {
    expect(validateNarrowBoundaryReview({ assessments: baseline() }, ctx).ok).toBe(true);
    expect(baseline()).toHaveLength(12);
  });

  it("[12] refuses an answer about a COMPATIBILITY projection", () => {
    const all = enumerateBoundarySurfaces(draftFixture());
    const flat = all.find((s) => s.coordinate === "flat_action[1]")!;
    const r = validateNarrowBoundaryReview(
      { assessments: [...baseline(), { ...baseline()[0]!, surfaceRef: flat.coordinate }] },
      { boundaries: [BOUNDARY], surfaces: [...surfaces, flat] },
    );
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.codes).toContain("boundary_review_unreviewable_surface");
  });

  it("rejects missing, extra, duplicate and unknown pairs", () => {
    const miss = validateNarrowBoundaryReview({ assessments: baseline().slice(1) }, ctx);
    expect(miss.ok === false && miss.codes).toContain("boundary_review_missing_pair");
    const dup = validateNarrowBoundaryReview({ assessments: [...baseline(), baseline()[0]!] }, ctx);
    expect(dup.ok === false && dup.codes).toContain("boundary_review_duplicate_pair");
    const unknownSurface = validateNarrowBoundaryReview({ assessments: [...baseline(), { ...baseline()[0]!, surfaceRef: "primary[9]" }] }, ctx);
    expect(unknownSurface.ok === false && unknownSurface.codes).toContain("boundary_review_unknown_surface");
    const unknownBoundary = validateNarrowBoundaryReview({ assessments: baseline().map((a) => ({ ...a, boundaryId: "c9" })) }, ctx);
    expect(unknownBoundary.ok === false && unknownBoundary.codes).toContain("boundary_review_unknown_boundary");
  });
});

describe("[9][14] silence is not a violation", () => {
  it("the exact R2.29 rationale cannot establish a violation — governed action missing", () => {
    const r = validateNarrowBoundaryReview(
      {
        assessments: withRow("branch[1].tradeoff[0]", {
          applicability: "applies",
          compliance: "violates",
          governedActionEvidence: "",
          prerequisiteFailureEvidence: "",
          violationMechanism: "none",
          reason: "Does not address verification of identifiers.",
        }),
      },
      ctx,
    );
    expect(r.ok).toBe(false);
    // R2.32 — `violates` with mechanism `none` is not a state in the canonical table at all, so it
    // is refused one step earlier and more precisely than by the three separate evidence codes.
    expect(r.ok === false && r.codes).toContain("boundary_assessment_state_invalid");
  });

  it("a violates row WITH a mechanism but no evidence still fails on the evidence rules", () => {
    const r = validateNarrowBoundaryReview(
      {
        assessments: withRow("branch[1].tradeoff[0]", {
          applicability: "applies",
          compliance: "violates",
          governedActionEvidence: "",
          prerequisiteFailureEvidence: "",
          violationMechanism: "governed_action_without_prerequisite",
          reason: "",
        }),
      },
      ctx,
    );
    expect(r.ok).toBe(false);
    const codes = r.ok === false ? r.codes : [];
    expect(codes).toContain("boundary_violation_governed_action_missing");
    expect(codes).toContain("boundary_violation_prerequisite_evidence_missing");
    // …and NOT on the reason, which this state does not require.
    expect(codes).not.toContain("boundary_reason_required_missing");
  });

  it("[10] a violation with NO governed-action evidence is malformed, never a reject", () => {
    const v = deriveBoundaryVerdict(
      { assessments: withRow("branch[1].action[0]", { applicability: "applies", compliance: "violates", governedActionEvidence: "", prerequisiteFailureEvidence: "unverified", violationMechanism: "governed_action_without_prerequisite", reason: "x" }) },
      ctx,
    );
    expect(v.outcome).toBe("boundary_review_malformed");
  });

  it("[11] a violation with NO prerequisite-failure evidence is malformed", () => {
    const v = deriveBoundaryVerdict(
      { assessments: withRow("branch[1].action[1]", { applicability: "applies", compliance: "violates", governedActionEvidence: "Immediately treat the second patient", prerequisiteFailureEvidence: "", violationMechanism: "governed_action_without_prerequisite", reason: "x" }) },
      ctx,
    );
    expect(v.outcome).toBe("boundary_review_malformed");
    if (v.outcome !== "boundary_review_malformed") throw new Error("unreachable");
    expect(v.codes).toContain("boundary_violation_prerequisite_evidence_missing");
  });

  it("rejects the absence-of-mention phrase as evidence anywhere", () => {
    const r = validateNarrowBoundaryReview(
      { assessments: withRow("branch[1].tradeoff[0]", { governedActionEvidence: "does not address verification of identifiers" }) },
      ctx,
    );
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.codes).toContain("boundary_evidence_generic");
  });

  it("[4][5][6] administrative and staffing surfaces settle as not_applicable and PASS", () => {
    const v = deriveBoundaryVerdict({ assessments: baseline() }, ctx);
    expect(v.outcome).toBe("boundary_review_pass");
    if (v.outcome !== "boundary_review_pass") throw new Error("unreachable");
    expect(v.notApplicableCount).toBe(12);
  });
});

describe("evidence grounding", () => {
  it("requires governedActionEvidence for not_applicable too — an evidenced answer, not a shrug", () => {
    const r = validateNarrowBoundaryReview({ assessments: withRow("primary[0]", { governedActionEvidence: "" }) }, ctx);
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.codes).toContain("boundary_evidence_missing");
  });

  it("rejects evidence lifted from another surface", () => {
    const r = validateNarrowBoundaryReview({ assessments: withRow("branch[1].action[1]", { governedActionEvidence: "Prepare a summary of events" }) }, ctx);
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.codes).toContain("boundary_evidence_from_other_surface");
  });

  it("rejects evidence that merely repeats the boundary statement", () => {
    const r = validateNarrowBoundaryReview({ assessments: withRow("primary[0]", { governedActionEvidence: BOUNDARY.statement }) }, ctx);
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.codes).toContain("boundary_evidence_restates_boundary");
  });

  it("lets prerequisite-failure evidence come from the INHERITED WORLD STATE, where it is stated", () => {
    const v = deriveBoundaryVerdict({ assessments: violationAt("branch[1].action[1]") }, ctx);
    expect(v.outcome).toBe("boundary_review_reject");
    if (v.outcome !== "boundary_review_reject") throw new Error("unreachable");
    expect(v.violations[0]!.prerequisiteFailureEvidence).toContain("remains unverified");
  });

  it("a non-violation that claims a prerequisite failure disagrees with itself", () => {
    const r = validateNarrowBoundaryReview({ assessments: withRow("primary[0]", { prerequisiteFailureEvidence: "Verify identifiers for both" }) }, ctx);
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.codes).toContain("boundary_applicability_compliance_mismatch");
  });

  it("an applicability/compliance combination outside the table is an INVALID STATE", () => {
    for (const over of [
      { applicability: "not_applicable" as const, compliance: "complies" as const },
      { applicability: "applies" as const, compliance: "not_assessed" as const },
    ]) {
      const r = validateNarrowBoundaryReview({ assessments: withRow("primary[0]", over) }, ctx);
      expect(r.ok).toBe(false);
      expect(r.ok === false && r.codes).toContain("boundary_assessment_state_invalid");
    }
  });
});

describe("[15] server-derived verdict", () => {
  it("all settled → pass", () => {
    const all = withRow("primary[0]", { applicability: "applies", compliance: "complies", reason: "verifies both before treating" });
    expect(deriveBoundaryVerdict({ assessments: all }, ctx).outcome).toBe("boundary_review_pass");
  });

  it("[1] one grounded violation → reject", () => {
    const v = deriveBoundaryVerdict({ assessments: violationAt("primary[1]") }, ctx);
    expect(v.outcome).toBe("boundary_review_reject");
    expect(producesCorrectionPacket(v)).toBe(true);
  });

  it("[7][8] applicability uncertainty → inconclusive, at the applicability level", () => {
    const v = deriveBoundaryVerdict(
      { assessments: withRow("branch[1].tradeoff[1]", { applicability: "uncertain", compliance: "not_assessed", reason: "'caring for' may or may not mean treatment" }) },
      ctx,
    );
    expect(v.outcome).toBe("boundary_review_inconclusive");
    if (v.outcome !== "boundary_review_inconclusive") throw new Error("unreachable");
    expect(v.uncertainties[0]).toMatchObject({ surfaceRef: "branch[1].tradeoff[1]", level: "applicability" });
  });

  it("compliance uncertainty → inconclusive, at the compliance level", () => {
    const v = deriveBoundaryVerdict(
      { assessments: withRow("branch[1].action[1]", { applicability: "applies", compliance: "uncertain", governedActionEvidence: "Immediately treat the second patient", reason: "order relative to the check is unstated" }) },
      ctx,
    );
    expect(v.outcome).toBe("boundary_review_inconclusive");
    if (v.outcome !== "boundary_review_inconclusive") throw new Error("unreachable");
    expect(v.uncertainties[0]!.level).toBe("compliance");
  });

  it("a violation OUTRANKS an uncertainty elsewhere", () => {
    const mixed = violationAt("primary[1]").map((a) =>
      a.surfaceRef === "branch[0].tradeoff[1]"
        ? { ...a, applicability: "uncertain" as const, reason: "the label does not say whether care means treatment" }
        : a,
    );
    expect(deriveBoundaryVerdict({ assessments: mixed }, ctx).outcome).toBe("boundary_review_reject");
  });
});

describe("[15][16] earliest causal violation and descendant deduplication", () => {
  /** primary[1] → branch[1].resulting_world_state → branch[1].action[1] */
  const chain = () => {
    const rows = baseline();
    const set = (ref: string, over: Partial<NarrowBoundaryAssessment>) => {
      const i = rows.findIndex((r) => r.surfaceRef === ref);
      rows[i] = { ...rows[i]!, ...over };
    };
    set("primary[1]", {
      applicability: "applies",
      compliance: "violates",
      governedActionEvidence: "Notify the families and proceed with one patient",
      prerequisiteFailureEvidence: "Notify the families and proceed with one patient",
      violationMechanism: "governed_action_without_prerequisite",
      reason: "treats before verifying",
    });
    set("branch[1].resulting_world_state", {
      applicability: "applies",
      compliance: "violates",
      governedActionEvidence: "One patient was treated while the second patient remains unverified",
      prerequisiteFailureEvidence: "the second patient remains unverified",
      violationMechanism: "resulting_state_missing_prerequisite",
      reason: "state asserts treatment without the check",
    });
    return rows;
  };

  it("[15] an ASSERTED STATE that repeats its ancestor's mechanism is downstream, not a new instruction", () => {
    // The world state authorizes nothing the learner can pick; with the SAME mechanism as its
    // primary it only restates the violation already established upstream.
    const rows = baseline();
    const set = (ref: string, over: Partial<NarrowBoundaryAssessment>) => {
      const i = rows.findIndex((r) => r.surfaceRef === ref);
      rows[i] = { ...rows[i]!, ...over };
    };
    set("primary[1]", {
      applicability: "applies",
      compliance: "violates",
      governedActionEvidence: "Notify the families and proceed with one patient",
      prerequisiteFailureEvidence: "Notify the families and proceed with one patient",
      violationMechanism: "governed_action_without_prerequisite",
      reason: "treats before verifying",
    });
    set("branch[1].resulting_world_state", {
      applicability: "applies",
      compliance: "violates",
      governedActionEvidence: "One patient was treated while the second patient remains unverified",
      prerequisiteFailureEvidence: "the second patient remains unverified",
      violationMechanism: "governed_action_without_prerequisite", // SAME mechanism as the ancestor
      reason: "restates the primary violation",
    });
    const v = deriveBoundaryVerdict({ assessments: rows }, ctx);
    if (v.outcome !== "boundary_review_reject") throw new Error("unreachable");
    expect(v.downstreamViolations.map((x) => x.surfaceRef)).toEqual(["branch[1].resulting_world_state"]);
    expect(v.causalViolations.map((x) => x.surfaceRef)).toEqual(["primary[1]"]);
  });

  it("[16] a descendant with a DISTINCT mechanism is retained as its own finding", () => {
    const v = deriveBoundaryVerdict({ assessments: chain() }, ctx);
    if (v.outcome !== "boundary_review_reject") throw new Error("unreachable");
    const world = v.violations.find((x) => x.surfaceRef === "branch[1].resulting_world_state")!;
    expect(world.downstreamOfPriorViolation).toBe(false);
    expect(world.earliestCausal).toBe(false); // it HAS a violating ancestor…
    expect(v.causalViolations.map((x) => x.surfaceRef)).toContain("branch[1].resulting_world_state"); // …but is still new
  });

  it("[16] a descendant that newly authorizes a DIFFERENT governed action is retained", () => {
    const rows = chain();
    const i = rows.findIndex((r) => r.surfaceRef === "branch[1].action[1]");
    rows[i] = {
      ...rows[i]!,
      applicability: "applies",
      compliance: "violates",
      governedActionEvidence: "Immediately treat the second patient",
      prerequisiteFailureEvidence: "the second patient remains unverified",
      violationMechanism: "governed_action_without_prerequisite",
      reason: "newly treats the second, still-unverified patient",
    };
    const v = deriveBoundaryVerdict({ assessments: rows }, ctx);
    if (v.outcome !== "boundary_review_reject") throw new Error("unreachable");
    expect(v.causalViolations.map((x) => x.surfaceRef)).toEqual(["primary[1]", "branch[1].resulting_world_state", "branch[1].action[1]"]);
    expect(v.downstreamViolations).toHaveLength(0);
  });

  it("marks the root violation earliestCausal, and keeps violations in surface order", () => {
    const v = deriveBoundaryVerdict({ assessments: chain() }, ctx);
    if (v.outcome !== "boundary_review_reject") throw new Error("unreachable");
    expect(v.violations[0]!.surfaceRef).toBe("primary[1]");
    expect(v.violations[0]!.earliestCausal).toBe(true);
    expect(v.violations[0]!.lineage).toEqual([]);
  });
});

describe("rerun authority", () => {
  it("first malformed reruns once, second terminates, and there is never a third call", () => {
    const malformed = {
      kind: "derived" as const,
      verdict: { outcome: "boundary_review_malformed" as const, codes: ["boundary_review_missing_pair" as const], findings: [], failureClass: "coverage" as const },
    };
    expect(decideAfterBoundaryReview(1, malformed).action).toBe("rerun_boundary_review");
    expect(decideAfterBoundaryReview(2, malformed).action).toBe("boundary_reviewer_terminal_failure");
    expect(MAX_BOUNDARY_REVIEW_CALLS_PER_SUBJECT).toBe(2);
    expect(decideAfterBoundaryReview(3, malformed)).toMatchObject({ code: "boundary_review_attempt_budget_violated" });
  });

  it("a transport failure is never a scenario verdict, and a rerun is never a generation retry", () => {
    expect(decideAfterBoundaryReview(1, { kind: "transport_failed" })).toMatchObject({ code: "boundary_review_transport_failed" });
    expect(boundaryReviewCountsAsGenerationRetry({ action: "rerun_boundary_review", because: "x" })).toBe(false);
    expect(boundaryReviewCountsAsGenerationRetry({ action: "correction_path" })).toBe(true);
  });

  it("only pass and not-applicable permit the broad reviewer to run", () => {
    expect(allowsBroadReview("boundary_review_pass")).toBe(true);
    expect(allowsBroadReview("boundary_review_not_applicable")).toBe(true);
    for (const o of ["boundary_review_reject", "boundary_review_inconclusive", "boundary_review_malformed"] as const) {
      expect(allowsBroadReview(o)).toBe(false);
    }
  });
});
