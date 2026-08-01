/**
 * CAPTURED LIVE DTO REGRESSION (Slice 3.2I-R5B1A.1-R2.32 Parts 5, 6, 12).
 *
 * The two responses the R2.30 live run actually received. Under the old contract both were discarded
 * on `boundary_reason_missing` and the scenario was never judged. These tests prove the correction
 * works on REAL model output — the thing a mock authored from the validator's own expectations could
 * never prove — and that nothing else was weakened to achieve it.
 */
import { describe, expect, it } from "vitest";
import {
  R230_ATTEMPT_DISAGREEMENT,
  R230_BOUNDARY_REVIEW_SUBJECT_SHA256,
  R230_EMPTY_REASON_CORRELATION,
  R230_LIVE_ARTIFACT_SHA256,
  R230_LIVE_ATTEMPT_1,
  R230_LIVE_ATTEMPT_2,
  R230_LIVE_ATTEMPTS,
  R230_OPEN_SEMANTIC_QUESTIONS,
} from "./r230LiveDtoFixture";
import { deriveBoundaryVerdict, validateNarrowBoundaryReview, type NarrowReviewContext } from "./narrowBoundaryReview";
import { classifyAssessmentState, requiresModelReason } from "./boundaryReasonParity";
import { C18_BOUNDARY, C18_REACHABLE_SURFACES } from "./c18BoundaryFixture";

const ctx: NarrowReviewContext = { boundaries: [C18_BOUNDARY], surfaces: C18_REACHABLE_SURFACES };

describe("the captured DTOs are what R2.31 measured", () => {
  it("carries both attempts, twelve assessments each, over the frozen subject", () => {
    expect(R230_LIVE_ATTEMPTS).toHaveLength(2);
    for (const rows of R230_LIVE_ATTEMPTS) expect(rows).toHaveLength(12);
    expect(R230_LIVE_ARTIFACT_SHA256).toBe("bd904d61412aa9c47832485c4e96b0b588210034a8251c701b64f3e4f407210d");
    expect(R230_BOUNDARY_REVIEW_SUBJECT_SHA256).toBe("eeffd9ccf60c6d1d912ec72af79025d78dcebd79b104b8254e0b1d11372b3afe");
  });

  it("reproduces the measured empty-reason correlation exactly", () => {
    const measure = (rows: typeof R230_LIVE_ATTEMPT_1) => ({
      applies: rows.filter((a) => a.applicability === "applies").length,
      appliesWithEmptyReason: rows.filter((a) => a.applicability === "applies" && !a.reason.trim()).length,
      notApplicable: rows.filter((a) => a.applicability === "not_applicable").length,
      notApplicableWithEmptyReason: rows.filter((a) => a.applicability === "not_applicable" && !a.reason.trim()).length,
    });
    expect(measure(R230_LIVE_ATTEMPT_1)).toEqual(R230_EMPTY_REASON_CORRELATION.attempt1);
    expect(measure(R230_LIVE_ATTEMPT_2)).toEqual(R230_EMPTY_REASON_CORRELATION.attempt2);
  });

  it("every empty reason sits in a state the parity table says the SERVER owns", () => {
    for (const rows of R230_LIVE_ATTEMPTS) {
      for (const a of rows.filter((x) => !x.reason.trim())) {
        const state = classifyAssessmentState(a);
        expect(state, `${a.surfaceRef} must be a valid state`).not.toBeNull();
        expect(requiresModelReason(state!), `${a.surfaceRef} must not require model prose`).toBe(false);
      }
    }
  });
});

describe("[11][12] both captured attempts now produce a server-derived verdict", () => {
  it("[11] attempt 1 — no reason failure, rejects", () => {
    const v = validateNarrowBoundaryReview({ assessments: R230_LIVE_ATTEMPT_1 }, ctx);
    expect(v.ok).toBe(true);
    const d = deriveBoundaryVerdict({ assessments: R230_LIVE_ATTEMPT_1 }, ctx);
    expect(d.outcome).toBe("boundary_review_reject");
    if (d.outcome !== "boundary_review_reject") throw new Error("unreachable");
    expect(d.violations.map((x) => x.surfaceRef)).toEqual([
      "branch[0].resulting_world_state",
      "branch[1].resulting_world_state",
      "branch[1].action[1]",
    ]);
  });

  it("[12] attempt 2 — no reason failure, rejects", () => {
    const v = validateNarrowBoundaryReview({ assessments: R230_LIVE_ATTEMPT_2 }, ctx);
    expect(v.ok).toBe(true);
    const d = deriveBoundaryVerdict({ assessments: R230_LIVE_ATTEMPT_2 }, ctx);
    expect(d.outcome).toBe("boundary_review_reject");
    if (d.outcome !== "boundary_review_reject") throw new Error("unreachable");
    expect(d.violations.map((x) => x.surfaceRef)).toEqual(["branch[0].resulting_world_state", "branch[1].resulting_world_state"]);
  });

  it("the grounded findings remain fully inspectable, with mechanism and both excerpts", () => {
    const d = deriveBoundaryVerdict({ assessments: R230_LIVE_ATTEMPT_1 }, ctx);
    if (d.outcome !== "boundary_review_reject") throw new Error("unreachable");
    for (const v of d.violations) {
      expect(v.violationMechanism).not.toBe("none");
      expect(v.governedActionEvidence.length).toBeGreaterThan(0);
      expect(v.prerequisiteFailureEvidence.length).toBeGreaterThan(0);
      expect(v.boundaryStatement).toBe(C18_BOUNDARY.statement);
    }
    expect(d.explanations).toHaveLength(12);
    expect(d.explanations.every((e) => e.authority === "server")).toBe(true);
  });

  it("neither response ever produced a reason-contract failure under the new table", () => {
    for (const rows of R230_LIVE_ATTEMPTS) {
      const r = validateNarrowBoundaryReview({ assessments: rows }, ctx);
      expect(r.ok).toBe(true);
    }
  });
});

describe("[13] the attempts DISAGREE, and the disagreement survives", () => {
  it("branch[1].action[1] is judged differently by the two attempts", () => {
    const a1 = R230_LIVE_ATTEMPT_1.find((a) => a.surfaceRef === R230_ATTEMPT_DISAGREEMENT.surfaceRef)!;
    const a2 = R230_LIVE_ATTEMPT_2.find((a) => a.surfaceRef === R230_ATTEMPT_DISAGREEMENT.surfaceRef)!;
    expect({ applicability: a1.applicability, compliance: a1.compliance }).toEqual(R230_ATTEMPT_DISAGREEMENT.attempt1);
    expect({ applicability: a2.applicability, compliance: a2.compliance }).toEqual(R230_ATTEMPT_DISAGREEMENT.attempt2);
  });

  it("the two verdicts are NOT normalized into one result", () => {
    const d1 = deriveBoundaryVerdict({ assessments: R230_LIVE_ATTEMPT_1 }, ctx);
    const d2 = deriveBoundaryVerdict({ assessments: R230_LIVE_ATTEMPT_2 }, ctx);
    if (d1.outcome !== "boundary_review_reject" || d2.outcome !== "boundary_review_reject") throw new Error("unreachable");
    expect(d1.violations.length).toBe(3);
    expect(d2.violations.length).toBe(2);
    expect(d1.violations.map((x) => x.surfaceRef)).toContain("branch[1].action[1]");
    expect(d2.violations.map((x) => x.surfaceRef)).not.toContain("branch[1].action[1]");
  });

  it("[6] the open semantic questions are RECORDED, not silently resolved", () => {
    expect(R230_OPEN_SEMANTIC_QUESTIONS.map((q) => q.id)).toEqual([
      "A_branch0_world_state_false_positive",
      "B_branch1_action1_instability",
    ]);
    // A. the compliant branch is still flagged — R2.32 deliberately does not fix semantics.
    const d1 = deriveBoundaryVerdict({ assessments: R230_LIVE_ATTEMPT_1 }, ctx);
    if (d1.outcome !== "boundary_review_reject") throw new Error("unreachable");
    expect(d1.violations.map((x) => x.surfaceRef)).toContain("branch[0].resulting_world_state");
  });
});

describe("[6] nothing else was weakened to remove the reason requirement", () => {
  it("coverage is still exact — a dropped assessment still fails", () => {
    const r = deriveBoundaryVerdict({ assessments: R230_LIVE_ATTEMPT_1.slice(1) }, ctx);
    expect(r.outcome).toBe("boundary_review_malformed");
    if (r.outcome !== "boundary_review_malformed") throw new Error("unreachable");
    expect(r.failureClass).toBe("coverage");
  });

  it("evidence must still be same-surface grounded", () => {
    const tampered = R230_LIVE_ATTEMPT_1.map((a) =>
      a.surfaceRef === "branch[1].action[1]" ? { ...a, governedActionEvidence: "Prepare a summary of events for the administrator" } : a,
    );
    const r = deriveBoundaryVerdict({ assessments: tampered }, ctx);
    expect(r.outcome).toBe("boundary_review_malformed");
    if (r.outcome !== "boundary_review_malformed") throw new Error("unreachable");
    expect(r.codes).toContain("boundary_evidence_from_other_surface");
    expect(r.failureClass).toBe("grounding");
  });

  it("a violation still requires a mechanism AND a prerequisite failure", () => {
    const stripped = R230_LIVE_ATTEMPT_1.map((a) =>
      a.surfaceRef === "branch[1].action[1]" ? { ...a, prerequisiteFailureEvidence: "" } : a,
    );
    const r = deriveBoundaryVerdict({ assessments: stripped }, ctx);
    expect(r.outcome).toBe("boundary_review_malformed");
    if (r.outcome !== "boundary_review_malformed") throw new Error("unreachable");
    expect(r.codes).toContain("boundary_violation_prerequisite_evidence_missing");
  });

  it("silence is still not a violation — an unsupported claim is still refused", () => {
    const unsupported = R230_LIVE_ATTEMPT_1.map((a) =>
      a.surfaceRef === "branch[1].tradeoff[0]"
        ? { ...a, applicability: "applies" as const, compliance: "violates" as const, governedActionEvidence: "", prerequisiteFailureEvidence: "", violationMechanism: "governed_action_without_prerequisite" as const }
        : a,
    );
    const r = deriveBoundaryVerdict({ assessments: unsupported }, ctx);
    expect(r.outcome).toBe("boundary_review_malformed");
  });

  it("compatibility projections are still outside the matrix", () => {
    expect(C18_REACHABLE_SURFACES.map((s) => s.coordinate).some((c) => c.startsWith("flat_"))).toBe(false);
  });
});
