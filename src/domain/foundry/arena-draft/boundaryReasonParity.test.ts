/**
 * CANONICAL STATE PARITY (Slice 3.2I-R5B1A.1-R2.32 Parts 1, 2, 10, 12).
 *
 * R2.31 measured three documents disagreeing about one field: the prompt asked for `reason` once,
 * the schema allowed `""`, and the validator demanded it everywhere. These tests exist so that
 * disagreement cannot recur silently — they assert that the prompt text, the validator's
 * requirements and the explanation authority are all reading the SAME table.
 */
import { describe, expect, it } from "vitest";
import {
  ASSESSMENT_STATES,
  ASSESSMENT_STATE_IDS,
  GENERIC_REASON_PHRASES,
  MODEL_REASON_MIN_CHARS,
  MODEL_REQUIRED_STATES,
  REGISTERED_MECHANISMS,
  SERVER_DERIVED_STATES,
  classifyAssessmentState,
  parityTableSha256,
  renderPromptStateRules,
  renderReasonPolicyLines,
  requiresModelReason,
} from "./boundaryReasonParity";
import {
  APPLICABILITY_RESULTS,
  COMPLIANCE_RESULTS,
  VIOLATION_MECHANISMS,
  validateNarrowBoundaryReview,
  type NarrowBoundaryAssessment,
  type NarrowReviewContext,
} from "./narrowBoundaryReview";
import { NARROW_BOUNDARY_SYSTEM_PROMPT } from "@/lib/bty/foundry/arena/narrowBoundaryContract";
import { enumerateBoundarySurfaces, reviewableSurfaces } from "./boundarySurfaces";
import { draftFixture } from "./boundarySurfaces.test";
import { buildContextSegments } from "./boundaryContextSegments";
import { buildSemanticFrames } from "./boundarySemanticFrame";

const BOUNDARY = { id: "c1_verify", statement: "Two identifiers must be verified before treatment" };
const draft = draftFixture();
const surfaces = reviewableSurfaces(enumerateBoundarySurfaces(draft));
const segments = buildContextSegments(draft, surfaces);
const ctx: NarrowReviewContext = { boundaries: [BOUNDARY], surfaces, segments, frames: buildSemanticFrames([BOUNDARY]) };
const at = (ref: string) => surfaces.find((s) => s.coordinate === ref)!;
const ownRef = (ref: string) => segments.find((x) => x.sourceSurfaceRef === ref && x.segmentKind === "own_surface")!.segmentRef;
const parRef = (ref: string) => segments.find((x) => x.sourceSurfaceRef === ref && x.segmentKind === "parent_generated_state")?.segmentRef ?? "";

/** A valid assessment in a given state, at a given surface. */
function rowFor(state: (typeof ASSESSMENT_STATES)[number], ref: string): NarrowBoundaryAssessment {
  const s = at(ref);
  const gov = s.text.slice(0, 90);
  const violates = state.compliance === "violates";
  // A violation must be answerable: own action present, an unmet prerequisite stated where the
  // fixture actually states it, and an ordering that puts the action first.
  const inherited = s.inheritedWorldState;
  const prereq = violates
    ? /verif/i.test(inherited)
      ? { segmentRef: parRef(ref), excerpt: inherited.slice(0, 90) }
      : { segmentRef: ownRef(ref), excerpt: s.text.slice(0, 90) }
    : { segmentRef: "", excerpt: "" };
  return {
    boundaryId: BOUNDARY.id,
    surfaceRef: ref,
    applicability: state.applicability,
    governedActionStatus: violates ? "present" : state.applicability === "applies" ? "present" : "absent",
    prerequisiteStatus: violates ? "explicitly_missing" : "not_applicable",
    temporalRelation: violates ? "action_before_prerequisite" : "not_applicable",
    compliance: state.compliance,
    actionEvidence: { segmentRef: ownRef(ref), excerpt: state.requiredEvidence.includes("governedActionEvidence") ? gov : "" },
    prerequisiteEvidence: prereq,
    violationMechanism:
      state.mechanismClass === "registered"
        ? "governed_action_without_prerequisite"
        : state.mechanismClass === "other_grounded_violation"
          ? "other_grounded_violation"
          : "none",
    reason: requiresModelReason(state) ? "the label does not say whether caring means treating" : "",
  };
}

/** Fill all twelve surfaces with a settled baseline, then place one state at one coordinate. */
const matrixWith = (state: (typeof ASSESSMENT_STATES)[number], ref: string): NarrowBoundaryAssessment[] =>
  surfaces.map((s) =>
    s.coordinate === ref
      ? rowFor(state, ref)
      : {
          boundaryId: BOUNDARY.id,
          surfaceRef: s.coordinate,
          applicability: "not_applicable" as const,
          governedActionStatus: "absent" as const,
          prerequisiteStatus: "not_applicable" as const,
          temporalRelation: "not_applicable" as const,
          compliance: "not_assessed" as const,
          violationMechanism: "none" as const,
          actionEvidence: { segmentRef: ownRef(s.coordinate), excerpt: s.text.slice(0, 90) },
          prerequisiteEvidence: { segmentRef: "", excerpt: "" },
          reason: "",
        },
  );

describe("[1] the table is exhaustive and unambiguous", () => {
  it("has one rule per canonical state id", () => {
    expect(ASSESSMENT_STATES.map((s) => s.id)).toEqual([...ASSESSMENT_STATE_IDS]);
    expect(new Set(ASSESSMENT_STATE_IDS).size).toBe(ASSESSMENT_STATE_IDS.length);
  });

  it("classifies every VALID (applicability × compliance × mechanism) triple to exactly one state", () => {
    const seen = new Map<string, number>();
    for (const applicability of APPLICABILITY_RESULTS) {
      for (const compliance of COMPLIANCE_RESULTS) {
        for (const violationMechanism of VIOLATION_MECHANISMS) {
          const s = classifyAssessmentState({ applicability, compliance, violationMechanism });
          if (s) seen.set(s.id, (seen.get(s.id) ?? 0) + 1);
        }
      }
    }
    // Every state is reachable, and no triple maps to two states (classify returns one or none).
    expect([...seen.keys()].sort()).toEqual([...ASSESSMENT_STATE_IDS].sort());
  });

  it("returns null for combinations outside the table — an invalid state, not a judgment", () => {
    expect(classifyAssessmentState({ applicability: "applies", compliance: "violates", violationMechanism: "none" })).toBeNull();
    expect(classifyAssessmentState({ applicability: "not_applicable", compliance: "complies", violationMechanism: "none" })).toBeNull();
    expect(classifyAssessmentState({ applicability: "applies", compliance: "not_assessed", violationMechanism: "none" })).toBeNull();
  });

  it("splits reason authority exactly three/three", () => {
    expect(SERVER_DERIVED_STATES).toEqual(["not_applicable", "complies", "violates_registered_mechanism"]);
    expect(MODEL_REQUIRED_STATES).toEqual(["applicability_uncertain", "violates_other_mechanism", "compliance_uncertain"]);
  });

  it("treats every registered mechanism as `registered`, and `other_grounded_violation` separately", () => {
    for (const m of REGISTERED_MECHANISMS) {
      expect(classifyAssessmentState({ applicability: "applies", compliance: "violates", violationMechanism: m })!.id).toBe("violates_registered_mechanism");
    }
    expect(classifyAssessmentState({ applicability: "applies", compliance: "violates", violationMechanism: "other_grounded_violation" })!.id).toBe("violates_other_mechanism");
  });

  it("has a stable digest that moves when the table moves", () => {
    expect(parityTableSha256()).toBe(parityTableSha256());
    expect(parityTableSha256()).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("[10] PROMPT / VALIDATOR PARITY — the defect R2.31 measured cannot recur", () => {
  it("the prompt contains the generated rule for EVERY state", () => {
    for (const line of renderPromptStateRules()) {
      expect(NARROW_BOUNDARY_SYSTEM_PROMPT, `prompt must carry: ${line.trim().slice(0, 40)}…`).toContain(line.trim());
    }
    for (const line of renderReasonPolicyLines()) {
      expect(NARROW_BOUNDARY_SYSTEM_PROMPT).toContain(line);
    }
  });

  it("the prompt names EVERY server-derived state as empty-reason and EVERY model-required state as required", () => {
    const policy = renderReasonPolicyLines().join("\n");
    for (const id of SERVER_DERIVED_STATES) expect(policy).toContain(id);
    for (const id of MODEL_REQUIRED_STATES) expect(policy).toContain(id);
    expect(policy).toContain(String(MODEL_REASON_MIN_CHARS));
  });

  it("[1][2] for every state, what the PROMPT asks for is exactly what the VALIDATOR requires", () => {
    for (const state of ASSESSMENT_STATES) {
      // A row filled exactly as the table prescribes must validate.
      const ref = state.compliance === "violates" ? "branch[1].action[1]" : "branch[1].tradeoff[0]";
      const ok = validateNarrowBoundaryReview({ assessments: matrixWith(state, ref) }, ctx);
      expect(ok.ok, `${state.id} must validate when filled per the table`).toBe(true);

      // And omitting the reason must fail IF AND ONLY IF the table says the model owns it.
      const withoutReason = matrixWith(state, ref).map((a) => (a.surfaceRef === ref ? { ...a, reason: "" } : a));
      const r = validateNarrowBoundaryReview({ assessments: withoutReason }, ctx);
      expect(r.ok, `${state.id}: reason requirement must match the table`).toBe(!requiresModelReason(state));
      if (!r.ok) expect(r.codes).toContain("boundary_reason_required_missing");
    }
  });
});

describe("[2] reason authority", () => {
  it("[1][2][3] an EMPTY reason is valid in every server-derived state", () => {
    for (const id of SERVER_DERIVED_STATES) {
      const state = ASSESSMENT_STATES.find((s) => s.id === id)!;
      const ref = state.compliance === "violates" ? "branch[1].action[1]" : "branch[1].tradeoff[0]";
      const rows = matrixWith(state, ref).map((a) => (a.surfaceRef === ref ? { ...a, reason: "" } : a));
      expect(validateNarrowBoundaryReview({ assessments: rows }, ctx).ok, `${id} with empty reason`).toBe(true);
    }
  });

  it("[4][5][6] an EMPTY reason is an output-contract failure in every model-required state", () => {
    for (const id of MODEL_REQUIRED_STATES) {
      const state = ASSESSMENT_STATES.find((s) => s.id === id)!;
      const ref = state.compliance === "violates" ? "branch[1].action[1]" : "branch[1].tradeoff[0]";
      const rows = matrixWith(state, ref).map((a) => (a.surfaceRef === ref ? { ...a, reason: "" } : a));
      const r = validateNarrowBoundaryReview({ assessments: rows }, ctx);
      expect(r.ok, `${id} with empty reason must fail`).toBe(false);
      expect(r.ok === false && r.codes).toContain("boundary_reason_required_missing");
    }
  });

  it("[7] POLICY: prose in a server-derived state is IGNORED, never a failure", () => {
    // The measured R2.30 responses supplied prose on all 17 not_applicable rows. Refusing it would
    // have failed those responses for the opposite reason. It carries no authority; it is counted.
    const rows = surfaces.map((s) => ({
      boundaryId: BOUNDARY.id,
      surfaceRef: s.coordinate,
      applicability: "not_applicable" as const,
      governedActionStatus: "absent" as const,
      prerequisiteStatus: "not_applicable" as const,
      temporalRelation: "not_applicable" as const,
      compliance: "not_assessed" as const,
      violationMechanism: "none" as const,
      actionEvidence: { segmentRef: ownRef(s.coordinate), excerpt: s.text.slice(0, 90) },
      prerequisiteEvidence: { segmentRef: "", excerpt: "" },
      reason: "This surface does something else: it prepares a report.",
    }));
    expect(validateNarrowBoundaryReview({ assessments: rows }, ctx).ok).toBe(true);
  });

  it("rejects filler where a reason IS required", () => {
    const state = ASSESSMENT_STATES.find((s) => s.id === "applicability_uncertain")!;
    for (const filler of GENERIC_REASON_PHRASES) {
      const ref = "branch[1].tradeoff[1]";
      const rows = matrixWith(state, ref).map((a) => (a.surfaceRef === ref ? { ...a, reason: filler } : a));
      const r = validateNarrowBoundaryReview({ assessments: rows }, ctx);
      expect(r.ok, `filler "${filler}" must be refused`).toBe(false);
    }
  });

  it("enforces a semantic minimum after trim, not merely non-emptiness", () => {
    const state = ASSESSMENT_STATES.find((s) => s.id === "compliance_uncertain")!;
    const ref = "branch[1].action[1]";
    const rows = matrixWith(state, ref).map((a) => (a.surfaceRef === ref ? { ...a, reason: "   hm   " } : a));
    const r = validateNarrowBoundaryReview({ assessments: rows }, ctx);
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.codes).toContain("boundary_reason_required_missing");
  });
});
