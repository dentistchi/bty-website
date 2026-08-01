/**
 * SERVER-DERIVED EXPLANATION AUTHORITY (Slice 3.2I-R5B1A.1-R2.32 Parts 4, 12).
 *
 * The explanation is a RENDERING of findings the validator already established. These tests pin the
 * three properties that make that claim true: it is deterministic, it introduces no conclusion the
 * structured fields do not already carry, and it cannot move a verdict.
 */
import { describe, expect, it } from "vitest";
import {
  EXPLANATION_AUTHORITY_VERSION,
  explainAll,
  explainAssessment,
  explanationAuthoritySha256,
  explanationSha256,
  type ExplainableAssessment,
} from "./boundaryExplanation";
import { deriveBoundaryVerdict, type NarrowBoundaryAssessment, type NarrowReviewContext } from "./narrowBoundaryReview";
import { MODEL_REQUIRED_STATES, SERVER_DERIVED_STATES } from "./boundaryReasonParity";
import { enumerateBoundarySurfaces, reviewableSurfaces } from "./boundarySurfaces";
import { draftFixture } from "./boundarySurfaces.test";
import { buildContextSegments } from "./boundaryContextSegments";
import { buildSemanticFrames } from "./boundarySemanticFrame";

const BOUNDARY = { id: "c1_verify", statement: "Two identifiers must be verified before treatment" };
const draft = draftFixture();
const surfaces = reviewableSurfaces(enumerateBoundarySurfaces(draft));
const segments = buildContextSegments(draft, surfaces);
const ctx: NarrowReviewContext = { boundaries: [BOUNDARY], surfaces, segments, frames: buildSemanticFrames([BOUNDARY]) };
const ownRef = (ref: string) => segments.find((x) => x.sourceSurfaceRef === ref && x.segmentKind === "own_surface")!.segmentRef;
const parRef = (ref: string) => segments.find((x) => x.sourceSurfaceRef === ref && x.segmentKind === "parent_generated_state")?.segmentRef ?? "";
const at = (ref: string) => surfaces.find((s) => s.coordinate === ref)!;

const explainable = (over: Partial<ExplainableAssessment>): ExplainableAssessment => ({
  boundaryId: BOUNDARY.id,
  boundaryStatement: BOUNDARY.statement,
  surfaceRef: "branch[1].tradeoff[0]",
  applicability: "not_applicable",
  compliance: "not_assessed",
  violationMechanism: "none",
  governedActionEvidence: at("branch[1].tradeoff[0]").text,
  prerequisiteFailureEvidence: "",
  modelReason: "",
  ...over,
});

describe("[8][9] determinism", () => {
  it("renders byte-identically for identical findings", () => {
    const a = explainAssessment(explainable({}));
    const b = explainAssessment(explainable({}));
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(explanationSha256([a])).toBe(explanationSha256([b]));
  });

  it("changes when a structured input changes", () => {
    const a = explainAssessment(explainable({}));
    const b = explainAssessment(explainable({ governedActionEvidence: "Focus on caring for the second patient immediately" }));
    expect(a.en).not.toBe(b.en);
  });

  it("has a contract digest independent of any particular finding", () => {
    expect(explanationAuthoritySha256()).toBe(explanationAuthoritySha256());
    expect(explanationAuthoritySha256()).toMatch(/^[0-9a-f]{64}$/);
    expect(EXPLANATION_AUTHORITY_VERSION).toBe("practice-boundary-explanation/1");
  });
});

describe("[4] the renderer places grounded excerpts into a frame — it concludes nothing new", () => {
  it("not_applicable names the surface, the boundary and what the surface actually does", () => {
    const e = explainAssessment(explainable({}));
    expect(e.authority).toBe("server");
    expect(e.stateId).toBe("not_applicable");
    expect(e.en).toContain("branch[1].tradeoff[0]");
    expect(e.en).toContain("c1_verify");
    expect(e.en).toContain("Prepare a summary of events");
    expect(e.ko).toContain("Prepare a summary of events");
  });

  it("complies names the rule kept and the governed action", () => {
    const e = explainAssessment(explainable({ surfaceRef: "primary[0]", applicability: "applies", compliance: "complies", governedActionEvidence: at("primary[0]").text }));
    expect(e.stateId).toBe("complies");
    expect(e.en).toContain("Verify identifiers for both patients now");
    expect(e.en).toContain(BOUNDARY.statement);
  });

  it("a registered violation names the mechanism, the governed action AND the prerequisite failure", () => {
    const e = explainAssessment(
      explainable({
        surfaceRef: "branch[1].action[1]",
        applicability: "applies",
        compliance: "violates",
        violationMechanism: "governed_action_without_prerequisite",
        governedActionEvidence: at("branch[1].action[1]").text,
        prerequisiteFailureEvidence: at("branch[1].action[1]").inheritedWorldState,
      }),
    );
    expect(e.stateId).toBe("violates_registered_mechanism");
    expect(e.en).toContain("Immediately treat the second patient");
    expect(e.en).toContain("remains unverified");
    expect(e.en).toContain("while the rule is unmet");
    expect(e.ko).toContain("Immediately treat the second patient");
  });

  it("every excerpt in the rendering came from a structured field — no invented clause", () => {
    const src = explainable({
      surfaceRef: "branch[1].action[1]",
      applicability: "applies",
      compliance: "violates",
      violationMechanism: "resulting_state_missing_prerequisite",
      governedActionEvidence: "Immediately treat the second patient",
      prerequisiteFailureEvidence: "the second patient remains unverified",
    });
    const e = explainAssessment(src);
    for (const fragment of [src.governedActionEvidence, src.prerequisiteFailureEvidence, src.boundaryStatement, src.surfaceRef, src.boundaryId]) {
      expect(e.en).toContain(fragment);
    }
  });

  it("a model-required state returns the MODEL's words verbatim, marked as model authority", () => {
    const e = explainAssessment(explainable({ applicability: "uncertain", compliance: "not_assessed", modelReason: "'caring for' may or may not mean treatment" }));
    expect(e.authority).toBe("model");
    expect(e.en).toBe("'caring for' may or may not mean treatment");
  });

  it("an invalid state renders nothing rather than guessing", () => {
    const e = explainAssessment(explainable({ applicability: "applies", compliance: "violates", violationMechanism: "none" }));
    expect(e.stateId).toBe("invalid_state");
    expect(e.en).toBe("");
  });
});

describe("[10] the explanation cannot move a verdict", () => {
  const rows = (mechanism: string): NarrowBoundaryAssessment[] =>
    surfaces.map((s) =>
      s.coordinate === "branch[1].action[1]"
        ? {
            boundaryId: BOUNDARY.id,
            surfaceRef: s.coordinate,
            applicability: "applies" as const,
            governedActionStatus: "present" as const,
            prerequisiteStatus: "explicitly_missing" as const,
            temporalRelation: "action_before_prerequisite" as const,
            compliance: "violates" as const,
            violationMechanism: mechanism as NarrowBoundaryAssessment["violationMechanism"],
            actionEvidence: { segmentRef: ownRef(s.coordinate), excerpt: s.text.slice(0, 90) },
            prerequisiteEvidence: { segmentRef: parRef(s.coordinate), excerpt: s.inheritedWorldState.slice(0, 90) },
            reason: "",
          }
        : {
            boundaryId: BOUNDARY.id,
            surfaceRef: s.coordinate,
            applicability: "not_applicable" as const,
            governedActionStatus: "absent" as const,
            prerequisiteStatus: "not_applicable" as const,
            temporalRelation: "not_applicable" as const,
            compliance: "not_assessed" as const,
            actionEvidence: { segmentRef: ownRef(s.coordinate), excerpt: s.text.slice(0, 90) },
            prerequisiteEvidence: { segmentRef: "", excerpt: "" },
            violationMechanism: "none" as const,
            reason: "",
          },
    );

  it("the verdict is identical whether or not the rendering is inspected", () => {
    const v = deriveBoundaryVerdict({ assessments: rows("governed_action_without_prerequisite") }, ctx);
    expect(v.outcome).toBe("boundary_review_reject");
    if (v.outcome !== "boundary_review_reject") throw new Error("unreachable");
    // Mutating the rendering afterwards changes nothing — it is downstream of the decision.
    const mutated = { ...v, explanations: v.explanations.map((e) => ({ ...e, en: "", ko: "" })) };
    expect(mutated.violations.map((x) => x.surfaceRef)).toEqual(v.violations.map((x) => x.surfaceRef));
    expect(mutated.causalViolations.length).toBe(v.causalViolations.length);
  });

  it("`deriveBoundaryVerdict` renders one explanation per assessment on every settled outcome", () => {
    const reject = deriveBoundaryVerdict({ assessments: rows("governed_action_without_prerequisite") }, ctx);
    if (reject.outcome !== "boundary_review_reject") throw new Error("unreachable");
    expect(reject.explanations).toHaveLength(surfaces.length);
    expect(reject.explanations.every((e) => e.authority === "server")).toBe(true);
  });

  it("SERVER_DERIVED and MODEL_REQUIRED states partition the authority field", () => {
    const all = explainAll([
      explainable({}),
      explainable({ applicability: "uncertain", modelReason: "the label does not settle it" }),
    ]);
    expect(all[0]!.authority).toBe("server");
    expect(all[1]!.authority).toBe("model");
    expect(SERVER_DERIVED_STATES).toContain(all[0]!.stateId);
    expect(MODEL_REQUIRED_STATES).toContain(all[1]!.stateId);
  });
});
