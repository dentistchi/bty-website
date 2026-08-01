/**
 * PREREQUISITE TRUTH OVER THE CAPTURED R2.34 LIVE DTO
 * (Slice 3.2I-R5B1A.1-R2.36 Parts 7, 8, 9, 11, 12).
 *
 * The R2.34 live run claimed four violations over the frozen c18 subject. Two were right, two were
 * semantically wrong, and every one of the four passed the R2.34 validator — grounding proved where
 * an excerpt lived and never what it meant.
 *
 * These tests run the CAPTURE, upgraded to the truth contract as charitably as its own excerpts
 * allow (see `r234LiveDtoFixture`), and assert the discrimination R2.35 demanded:
 *
 *   REFUSED   branch[0].resulting_world_state — prerequisite satisfied in its own text; the claimed
 *             failure is a scheduling delay.
 *   REFUSED   branch[0].action[0]             — an administrative action rejected on its PARENT's
 *             delay clause.
 *   PRESERVED branch[1].resulting_world_state — own text treats; own text says unverified.
 *   PRESERVED branch[1].action[1]             — treating IS the governed action, so the inherited
 *             state is legitimately citable here.
 *
 * The last two lines are the point: the SAME segment kind is refused on one surface and accepted on
 * the other, decided by whether the surface's own text performs the governed action.
 *
 * WHAT THESE TESTS DO NOT CLAIM. No provider call was made in this slice. Nothing here shows the
 * live reviewer now answers differently, and the false negative at `primary[1]` is carried forward
 * UNMEASURED.
 */
import { describe, expect, it } from "vitest";
import {
  R234_BOUNDARY_REVIEW_SUBJECT_SHA256,
  R234_LIVE_ASSESSMENTS,
  R234_MEASURED,
  R234_ORACLE_VIOLATIONS,
  R234_UPGRADED_TO_TRUTH_CONTRACT,
} from "./r234LiveDtoFixture";
import {
  deriveBoundaryVerdict,
  excerptConcernsPrerequisite,
  validateNarrowBoundaryReview,
  type NarrowBoundaryAssessment,
  type NarrowReviewContext,
} from "./narrowBoundaryReview";
import { buildContextSegments } from "./boundaryContextSegments";
import { buildSemanticFrame, buildSemanticFrames } from "./boundarySemanticFrame";
import { C18_BOUNDARY, C18_REACHABLE_SURFACES, C18_SCENARIO } from "./c18BoundaryFixture";

const segments = buildContextSegments(C18_SCENARIO, C18_REACHABLE_SURFACES);
const frames = buildSemanticFrames([C18_BOUNDARY]);
const ctx: NarrowReviewContext = { boundaries: [C18_BOUNDARY], surfaces: C18_REACHABLE_SURFACES, segments, frames };

/** The validator mutates demoted rows in place, so every case gets its own copy. */
const rows = (): NarrowBoundaryAssessment[] => JSON.parse(JSON.stringify(R234_UPGRADED_TO_TRUTH_CONTRACT));

describe("the capture is what R2.34 measured", () => {
  it("twelve assessments over the frozen subject, with four violation claims", () => {
    expect(R234_LIVE_ASSESSMENTS).toHaveLength(12);
    expect(R234_BOUNDARY_REVIEW_SUBJECT_SHA256).toBe("b15bfb8f703b17b2379ffe4222fb623149e74e0350f3e5e0516ab4a02a867280");
    expect(R234_LIVE_ASSESSMENTS.filter((a) => a.compliance === "violates").map((a) => a.surfaceRef)).toEqual([
      ...R234_MEASURED.claimedViolations,
    ]);
  });

  it("the upgrade preserves every claim and every excerpt — nothing was quietly softened", () => {
    expect(R234_UPGRADED_TO_TRUTH_CONTRACT).toHaveLength(12);
    for (const legacy of R234_LIVE_ASSESSMENTS) {
      const upgraded = R234_UPGRADED_TO_TRUTH_CONTRACT.find((a) => a.surfaceRef === legacy.surfaceRef)!;
      expect(upgraded.applicability).toBe(legacy.applicability);
      expect(upgraded.compliance).toBe(legacy.compliance);
      expect(upgraded.violationMechanism).toBe(legacy.violationMechanism);
      // Every upgraded excerpt is a prefix of the excerpt the model actually chose.
      expect(legacy.governedActionEvidence.startsWith(upgraded.actionEvidence.excerpt)).toBe(true);
      // Where the capture HAD prerequisite evidence, the upgrade quotes a prefix of it. Where it
      // had none, the upgrade may add one — an addition strengthens the claim, it never softens it.
      if (legacy.prerequisiteFailureEvidence) {
        expect(legacy.prerequisiteFailureEvidence.startsWith(upgraded.prerequisiteEvidence.excerpt)).toBe(true);
      }
    }
  });

  it("every violation claim is upgraded to the STRONGEST truth position available to it", () => {
    for (const a of R234_UPGRADED_TO_TRUTH_CONTRACT.filter((x) => x.compliance === "violates")) {
      expect(a.governedActionStatus).toBe("present");
      expect(a.prerequisiteStatus).toBe("explicitly_missing");
      expect(a.temporalRelation).toBe("action_before_prerequisite");
    }
  });
});

describe("[8][11] the two measured FALSE POSITIVES are refused", () => {
  it("refuses exactly the two, and refuses nothing else", () => {
    const r = validateNarrowBoundaryReview({ assessments: rows() }, ctx);
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("unreachable");
    expect(r.refutations.map((x) => x.surfaceRef)).toEqual([...R234_MEASURED.falsePositives]);
  });

  it("[8.5] a scheduling delay is not a verification failure, however serious it sounds", () => {
    const r = validateNarrowBoundaryReview({ assessments: rows() }, ctx);
    if (!r.ok) throw new Error("unreachable");
    const refuted = r.refutations.find((x) => x.surfaceRef === "branch[0].resulting_world_state")!;
    expect(refuted.codes).toContain("boundary_prerequisite_failure_ungrounded");
    expect(refuted.claimedPrerequisiteEvidence).toContain("delays in the ward");
  });

  it("[9] the gate is anchored to the BOUNDARY's own clause, not to a keyword list", () => {
    const frame = buildSemanticFrame(C18_BOUNDARY);
    expect(frame.ruleKind).toBe("prerequisite_before_action");
    expect(frame.prerequisiteClause).toBe("Two identifiers must be verified");
    expect(excerptConcernsPrerequisite("but you still face delays in the ward", frame)).toBe(false);
    expect(excerptConcernsPrerequisite("this left the second patient unverified", frame)).toBe(true);
    // A boundary about something else moves the gate with it — no clinical vocabulary is hardcoded.
    const other = buildSemanticFrame({ id: "x", statement: "Dual authorization must be recorded before disbursing funds" });
    expect(excerptConcernsPrerequisite("this left the second patient unverified", other)).toBe(false);
    expect(excerptConcernsPrerequisite("no dual authorization was recorded", other)).toBe(true);
  });

  it("[7] a refused claim leaves its surface UNSETTLED — never a quiet pass", () => {
    const r = validateNarrowBoundaryReview({ assessments: rows() }, ctx);
    if (!r.ok) throw new Error("unreachable");
    for (const ref of R234_MEASURED.falsePositives) {
      expect(r.value.assessments.find((a) => a.surfaceRef === ref)!.compliance).toBe("uncertain");
      expect(r.value.assessments.find((a) => a.surfaceRef === ref)!.violationMechanism).toBe("none");
    }
  });
});

describe("[11][12] the two measured TRUE POSITIVES survive, and they are the whole packet", () => {
  it("the verdict still rejects, on the true positives alone", () => {
    const d = deriveBoundaryVerdict({ assessments: rows() }, ctx);
    expect(d.outcome).toBe("boundary_review_reject");
    if (d.outcome !== "boundary_review_reject") throw new Error("unreachable");
    expect(d.violations.map((x) => x.surfaceRef)).toEqual([...R234_MEASURED.truePositives]);
    expect(d.refutedClaims.map((x) => x.surfaceRef)).toEqual([...R234_MEASURED.falsePositives]);
  });

  it("[12] the correction packet contains ONLY the surviving violations", () => {
    const d = deriveBoundaryVerdict({ assessments: rows() }, ctx);
    if (d.outcome !== "boundary_review_reject") throw new Error("unreachable");
    const packet = d.causalViolations.map((x) => x.surfaceRef);
    for (const fp of R234_MEASURED.falsePositives) expect(packet).not.toContain(fp);
    expect(packet.every((ref) => (R234_ORACLE_VIOLATIONS as readonly string[]).includes(ref))).toBe(true);
  });

  it("[12] every surviving finding states WHERE its prerequisite evidence came from", () => {
    const d = deriveBoundaryVerdict({ assessments: rows() }, ctx);
    if (d.outcome !== "boundary_review_reject") throw new Error("unreachable");
    const world = d.violations.find((v) => v.surfaceRef === "branch[1].resulting_world_state")!;
    const action = d.violations.find((v) => v.surfaceRef === "branch[1].action[1]")!;
    expect(world.prerequisiteSegmentKind).toBe("own_surface");
    // The discrimination: the SAME inherited state is refused above and accepted here, because this
    // surface's own text performs the governed action.
    expect(action.prerequisiteSegmentKind).toBe("parent_generated_state");
    expect(action.governedActionEvidence).toBe("Immediately treat the second patient");
    for (const v of d.violations) {
      expect(v.prerequisiteStatus).toBe("explicitly_missing");
      expect(v.temporalRelation).toBe("action_before_prerequisite");
      expect(v.governedActionSegmentRef).not.toBe("");
    }
  });

  it("REJECTING THE WHOLE RESPONSE WOULD HAVE BEEN WORSE — a rerun could ship the real violation", () => {
    // The counterfactual, stated as a test: if a refuted claim were fatal, this response would be
    // malformed, the scenario would go back for a rerun, and a clean rerun would publish a scenario
    // that treats an unverified patient. The surviving violations must block it now.
    const d = deriveBoundaryVerdict({ assessments: rows() }, ctx);
    expect(d.outcome).not.toBe("boundary_review_malformed");
    expect(d.outcome).toBe("boundary_review_reject");
  });
});

describe("[7] fabricated evidence is still fatal, on a violation row as much as anywhere", () => {
  it("quoting another surface's segment refuses the RESPONSE, not just the claim", () => {
    const tampered = rows().map((a) =>
      a.surfaceRef === "branch[1].action[1]"
        ? { ...a, actionEvidence: { segmentRef: segments.find((s) => s.sourceSurfaceRef === "branch[0].action[0]" && s.segmentKind === "own_surface")!.segmentRef, excerpt: a.actionEvidence.excerpt } }
        : a,
    );
    const d = deriveBoundaryVerdict({ assessments: tampered }, ctx);
    expect(d.outcome).toBe("boundary_review_malformed");
    if (d.outcome !== "boundary_review_malformed") throw new Error("unreachable");
    expect(d.codes).toContain("boundary_evidence_segment_not_visible");
  });

  it("an excerpt absent from the segment it names refuses the RESPONSE", () => {
    const tampered = rows().map((a) =>
      a.surfaceRef === "branch[1].action[1]"
        ? { ...a, actionEvidence: { segmentRef: a.actionEvidence.segmentRef, excerpt: "treat the patient without checking anything" } }
        : a,
    );
    const d = deriveBoundaryVerdict({ assessments: tampered }, ctx);
    expect(d.outcome).toBe("boundary_review_malformed");
  });

  it("coverage is still exact — a dropped assessment still fails as coverage", () => {
    const d = deriveBoundaryVerdict({ assessments: rows().slice(1) }, ctx);
    expect(d.outcome).toBe("boundary_review_malformed");
    if (d.outcome !== "boundary_review_malformed") throw new Error("unreachable");
    expect(d.failureClass).toBe("coverage");
  });
});
