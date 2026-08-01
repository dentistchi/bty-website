/**
 * CAPTURED LIVE DTO REGRESSION — R2.30 CAPTURES UNDER THE R2.36 CONTRACT
 * (Slice 3.2I-R5B1A.1-R2.36 Part 11; originally R2.32 Parts 5, 6, 12).
 *
 * WHAT CHANGED, AND WHY THESE TESTS CHANGED WITH IT
 *
 * R2.32 used these two captures to prove that a correction worked on REAL model output. R2.36
 * replaces the assessment shape: an excerpt must now name the server-assigned segment it came from,
 * and a violation must state the prerequisite's truth. Neither capture carries those fields — no
 * contract had asked for them.
 *
 * The captures are therefore NOT retyped and NOT upgraded here. Rewriting a measurement to fit a
 * later contract destroys the only record of what a reviewer says when nobody asks it for the truth,
 * and that record is precisely what R2.35 needed to find the defect. What these tests assert now is
 * what the captures can still honestly prove: the measured correlations, the parity classification
 * of every empty reason, and — newly — that they are structurally un-answerable under the truth
 * contract, which is the whole reason R2.36 exists.
 *
 * The substantive R2.36 discrimination is proved over the R2.34 capture in `r234TruthRegression`.
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
import { LEGACY_MISSING_TRUTH_FIELDS } from "./legacyBoundaryDto";
import { NARROW_BOUNDARY_JSON_SCHEMA } from "./narrowBoundaryReview";
import { classifyAssessmentState, requiresModelReason } from "./boundaryReasonParity";
import { C18_REACHABLE_SURFACES } from "./c18BoundaryFixture";

describe("the captured DTOs are what R2.31 measured, byte for byte", () => {
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

  it("every empty reason still sits in a state the parity table says the SERVER owns", () => {
    // The R2.32 correction is untouched by R2.36: the reason policy still reads the same table.
    for (const rows of R230_LIVE_ATTEMPTS) {
      for (const a of rows.filter((x) => !x.reason.trim())) {
        const state = classifyAssessmentState(a);
        expect(state, `${a.surfaceRef} must be a valid state`).not.toBeNull();
        expect(requiresModelReason(state!), `${a.surfaceRef} must not require model prose`).toBe(false);
      }
    }
  });

  it("[13] the attempts DISAGREE over a byte-identical subject, and the record keeps it", () => {
    const a1 = R230_LIVE_ATTEMPT_1.find((a) => a.surfaceRef === R230_ATTEMPT_DISAGREEMENT.surfaceRef)!;
    const a2 = R230_LIVE_ATTEMPT_2.find((a) => a.surfaceRef === R230_ATTEMPT_DISAGREEMENT.surfaceRef)!;
    expect({ applicability: a1.applicability, compliance: a1.compliance }).toEqual(R230_ATTEMPT_DISAGREEMENT.attempt1);
    expect({ applicability: a2.applicability, compliance: a2.compliance }).toEqual(R230_ATTEMPT_DISAGREEMENT.attempt2);
  });
});

describe("[6] these captures cannot answer the R2.36 question — which is why R2.36 exists", () => {
  it("neither capture carries any of the truth fields the contract now requires", () => {
    for (const rows of R230_LIVE_ATTEMPTS) {
      for (const a of rows) {
        const keys = Object.keys(a);
        expect(keys).not.toContain("governedActionStatus");
        expect(keys).not.toContain("prerequisiteStatus");
        expect(keys).not.toContain("temporalRelation");
      }
    }
    expect(LEGACY_MISSING_TRUTH_FIELDS).toContain("prerequisiteStatus");
  });

  it("the current schema REQUIRES exactly those fields, so a legacy response is refused outright", () => {
    const required = [...NARROW_BOUNDARY_JSON_SCHEMA.properties.assessments.items.required];
    for (const f of ["governedActionStatus", "prerequisiteStatus", "temporalRelation", "actionEvidence", "prerequisiteEvidence"]) {
      expect(required).toContain(f);
    }
  });

  it("[6] the open semantic questions are RECORDED as answered by R2.36, not silently forgotten", () => {
    expect(R230_OPEN_SEMANTIC_QUESTIONS.map((q) => q.id)).toEqual([
      "A_branch0_world_state_false_positive",
      "B_branch1_action1_instability",
    ]);
    // Question A — a compliant branch flagged using a scheduling delay — is exactly the shape the
    // R2.36 prerequisite gate refuses; `r234TruthRegression` proves that over the R2.34 capture.
    // Question B — instability at temperature 0 — is NOT addressed here and stays open.
    const attempt1FlaggedTheCompliantBranch = R230_LIVE_ATTEMPT_1.some(
      (a) => a.surfaceRef === "branch[0].resulting_world_state" && a.compliance === "violates",
    );
    expect(attempt1FlaggedTheCompliantBranch).toBe(true);
  });

  it("compatibility projections are still outside the matrix", () => {
    expect(C18_REACHABLE_SURFACES.map((s) => s.coordinate).some((c) => c.startsWith("flat_"))).toBe(false);
  });
});
