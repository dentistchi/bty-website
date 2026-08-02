/**
 * VALIDATOR / GENERATOR / REPAIR PARITY UNDER RULE-KIND SCOPE (Slice 3.2I-R5B1A.1-R2.56).
 *
 * R2.55's finding was not only that a row was mis-scoped. It was that FOUR layers agreed with each
 * other and were all wrong together: the classifier returned a row, the validator confirmed it
 * existed, the generator offered it because the validator accepted it, and the R2.54 repair matched
 * what the generator offered — into a `boundary_review_reject` carrying a fabricated
 * `explicit_boundary_contradiction`.
 *
 * That agreement is a FEATURE, and this file protects it. Nothing here adds a rule-kind rule of its
 * own: the validator has no blacklist, the generator has no exception, and the repair path has no
 * special case. They change because the canonical table changed, and these tests fail if any layer
 * ever starts deciding scope for itself.
 *
 * Parity is asserted BIDIRECTIONALLY. "Every offered alternative validates" alone would still pass
 * if the generator offered nothing at all.
 */

import { describe, it, expect } from "vitest";
import { TRUTH_STATES, classifyTruthState } from "./boundaryTruthStates";
import { deriveGroupAlternatives, matchGroupAlternative } from "./boundaryGroupAlternatives";
import { buildSemanticFrames } from "./boundarySemanticFrame";
import { applyFieldRepair, planFieldRepair, type FieldRepairPlan, type FieldRepairTarget } from "./boundaryFieldRepair";
import { deriveBoundaryVerdict, validateNarrowBoundaryReview, type BoundaryTruthAssessment } from "./narrowBoundaryReview";
import { buildNarrowBoundarySubject } from "@/lib/bty/foundry/arena/narrowBoundaryContract";
import { buildFieldRepairRequest } from "@/lib/bty/foundry/arena/narrowBoundaryContract";
import { C18_BOUNDARY, C18_SURFACES, C18_SCENARIO, C18_SCENARIO_SHA256 } from "./c18BoundaryFixture";
import { R248_ATTEMPT_1 } from "./r248LiveDtoFixture";
import { selectPlanDerivedOperations } from "./groupAlternativeSelection.fixture";
import {
  PROHIBITION_BOUNDARY,
  PROHIBITION_BREACH_FACTS,
  PROHIBITION_BREACH_SURFACE_REF,
  PROHIBITION_FRAME,
  PROHIBITION_SCENARIO,
  PROHIBITION_SURFACES,
} from "./prohibitionBoundaryFixture";

const GROUP_FIELDS = [
  "prerequisiteStatus",
  "temporalRelation",
  "prerequisiteSatisfactionCandidateId",
  "prerequisiteFailureCandidateId",
  "reason",
] as const;

// --- the two worlds --------------------------------------------------------

const c18Subject = buildNarrowBoundarySubject({
  scenarioSha256: C18_SCENARIO_SHA256,
  reviewSubjectSha256: "r".repeat(64),
  boundaryProvenance: { activeBoundaryIds: [C18_BOUNDARY.id] } as never,
  boundaryProvenanceSha256: "p".repeat(64),
  boundaries: [C18_BOUNDARY],
  surfaces: C18_SURFACES,
  draft: C18_SCENARIO,
  language: "en",
  generationAttemptId: "g1",
  caseId: "c18",
});
const C18_CTX = {
  boundaries: [C18_BOUNDARY],
  surfaces: c18Subject.surfaces,
  frames: buildSemanticFrames([C18_BOUNDARY]),
  candidates: c18Subject.evidenceCandidates,
} as never;
const C18_DIGESTS = {
  boundaryReviewSubjectSha256: c18Subject.evidenceCandidateMapSha256,
  surfaceMapSha256: c18Subject.surfaceMapSha256,
  lineageSha256: c18Subject.lineageSha256,
};
const C18_FRAME = buildSemanticFrames([C18_BOUNDARY])[0]!;
const RWS = "branch[0].resulting_world_state";

const proSubject = buildNarrowBoundarySubject({
  scenarioSha256: "s".repeat(64),
  reviewSubjectSha256: "r".repeat(64),
  boundaryProvenance: { activeBoundaryIds: [PROHIBITION_BOUNDARY.id] } as never,
  boundaryProvenanceSha256: "p".repeat(64),
  boundaries: [PROHIBITION_BOUNDARY],
  surfaces: PROHIBITION_SURFACES,
  draft: PROHIBITION_SCENARIO,
  language: "en",
  generationAttemptId: "g1",
  caseId: "prohibition",
});
const PRO_CTX = {
  boundaries: [PROHIBITION_BOUNDARY],
  surfaces: proSubject.surfaces,
  frames: buildSemanticFrames([PROHIBITION_BOUNDARY]),
  candidates: proSubject.evidenceCandidates,
} as never;

const poolOf = (subject: typeof c18Subject, ref: string, role: string): string[] =>
  (subject.evidenceCandidates as Array<{ assessedSurfaceRef: string; semanticRole: string; candidateId: string }>)
    .filter((c) => c.assessedSurfaceRef === ref && c.semanticRole === role)
    .map((c) => c.candidateId);

const alternativesFor = (subject: typeof c18Subject, boundaryId: string, surfaceRef: string, ruleKind: string, governedActionStatus = "present") =>
  deriveGroupAlternatives({ boundaryId, surfaceRef, governedActionStatus, groupFields: [...GROUP_FIELDS], ruleKind, candidates: subject.evidenceCandidates });

// ---------------------------------------------------------------------------
// Part 7 — the canonical validator, with no rule-kind rule of its own
// ---------------------------------------------------------------------------

describe("[R2.56][7] the canonical validator, under a PREREQUISITE frame", () => {
  const rowsWith = (patch: Partial<BoundaryTruthAssessment>): BoundaryTruthAssessment[] =>
    R248_ATTEMPT_1.map((r) => (r.surfaceRef === RWS ? ({ ...r, ...patch } as BoundaryTruthAssessment) : r));

  const prohibitionTriple = rowsWith({
    ...PROHIBITION_BREACH_FACTS,
    prerequisiteSatisfactionCandidateId: "none",
    prerequisiteFailureCandidateId: "none",
    reason: "",
  });

  it("refuses the prohibition-only triple as an INVALID STATE, naming no other defect", () => {
    const v = validateNarrowBoundaryReview({ assessments: prohibitionTriple }, C18_CTX);
    expect(v.ok).toBe(false);
    if (v.ok) throw new Error("unreachable");
    const rowCodes = v.findings.filter((f) => f.surfaceRef === RWS).map((f) => f.code);
    expect(rowCodes).toEqual(["boundary_assessment_state_invalid"]);
    // Not a candidate problem and not a reason problem — the combination has no meaning here.
    expect(rowCodes).not.toContain("boundary_candidate_forbidden_present");
    expect(rowCodes).not.toContain("boundary_reason_required_missing");
    expect(v.failedSurfaceRefs).toContain(RWS);
  });

  it("derives NO violation and NO explicit contradiction from it", () => {
    // R2.55 measured exactly this input producing
    // `branch[0].resulting_world_state : prohibited_action_present : explicit_boundary_contradiction`.
    const d = deriveBoundaryVerdict({ assessments: prohibitionTriple }, C18_CTX);
    expect(d.outcome).toBe("boundary_review_malformed");
    const serialized = JSON.stringify(d);
    expect(serialized).not.toContain("prohibited_action_present");
    expect(serialized).not.toContain("explicit_boundary_contradiction");
  });

  it("the refusal comes from the TABLE, not from a validator-local blacklist", () => {
    // If the validator had grown its own rule, the classifier would still return a row. It does not.
    expect(classifyTruthState(PROHIBITION_BREACH_FACTS as never, C18_FRAME.ruleKind)).toBeNull();
  });
});

describe("[R2.56][7] the canonical validator, under a genuine PROHIBITION frame", () => {
  const proRows = (): BoundaryTruthAssessment[] =>
    (proSubject.surfaces as Array<{ coordinate: string }>).map((s) => ({
      boundaryId: PROHIBITION_BOUNDARY.id,
      surfaceRef: s.coordinate,
      governedActionStatus: s.coordinate === PROHIBITION_BREACH_SURFACE_REF ? "present" : "absent",
      prerequisiteStatus: "not_applicable",
      temporalRelation: "not_applicable",
      governedActionCandidateId: poolOf(proSubject, s.coordinate, "governed_action")[0] ?? "none",
      prerequisiteSatisfactionCandidateId: "none",
      prerequisiteFailureCandidateId: "none",
      reason: "",
    })) as BoundaryTruthAssessment[];

  it("accepts the breach row and every administrative row", () => {
    const v = validateNarrowBoundaryReview({ assessments: proRows() }, PRO_CTX);
    expect(v.ok).toBe(true);
    if (!v.ok) throw new Error(`unreachable: ${v.codes.join(", ")}`);
    const breach = v.derived.find((d) => d.surfaceRef === PROHIBITION_BREACH_SURFACE_REF)!;
    expect(breach.stateId).toBe("prohibited_action_present");
    expect(breach.applicability).toBe("applies");
    expect(breach.compliance).toBe("violates");
  });

  it("still derives the violation, with the explicit-contradiction mechanism", () => {
    const d = deriveBoundaryVerdict({ assessments: proRows() }, PRO_CTX);
    expect(d.outcome).toBe("boundary_review_reject");
    if (d.outcome !== "boundary_review_reject") throw new Error("unreachable");
    expect(d.violations.map((x) => `${x.surfaceRef}:${x.stateId}:${x.violationMechanism}`)).toEqual([
      `${PROHIBITION_BREACH_SURFACE_REF}:prohibited_action_present:explicit_boundary_contradiction`,
    ]);
    // Server-derived: the verdict needs no model prose, exactly as the table says.
    expect(d.violations[0]!.reason).toBe("");
  });

  it("a required governed-action candidate is still required here", () => {
    const rows = proRows().map((r) => (r.surfaceRef === PROHIBITION_BREACH_SURFACE_REF ? { ...r, governedActionCandidateId: "none" } : r));
    const v = validateNarrowBoundaryReview({ assessments: rows }, PRO_CTX);
    expect(v.ok).toBe(false);
    if (v.ok) throw new Error("unreachable");
    expect(v.findings.filter((f) => f.surfaceRef === PROHIBITION_BREACH_SURFACE_REF).map((f) => f.code)).toContain("boundary_candidate_required_missing");
  });
});

// ---------------------------------------------------------------------------
// Part 8 — generator parity, both directions, with no generator edit
// ---------------------------------------------------------------------------

describe("[R2.56][8] generator parity is BIDIRECTIONAL", () => {
  /** Does the canonical validator accept a row built from this alternative? */
  const validatesUnder = (
    ctx: never,
    boundaryId: string,
    rows: BoundaryTruthAssessment[],
    surfaceRef: string,
    alt: ReturnType<typeof deriveGroupAlternatives>[number],
    reason: string,
  ): { ok: boolean; codes: string[] } => {
    const patched = rows.map((r) =>
      r.surfaceRef === surfaceRef
        ? ({
            ...r,
            boundaryId,
            prerequisiteStatus: alt.prerequisiteStatus,
            temporalRelation: alt.temporalDomain[0]!,
            prerequisiteSatisfactionCandidateId: alt.satisfactionCandidateDomain.find((x) => x !== "none") ?? "none",
            prerequisiteFailureCandidateId: alt.failureCandidateDomain.find((x) => x !== "none") ?? "none",
            reason: alt.reasonConstraint === "model_required" ? reason : "",
          } as BoundaryTruthAssessment)
        : r,
    );
    const v = validateNarrowBoundaryReview({ assessments: patched }, ctx);
    const codes = v.ok ? [] : v.findings.filter((f) => f.surfaceRef === surfaceRef).map((f) => f.code);
    return { ok: codes.length === 0, codes };
  };

  const PROSE = "the surface text does not settle whether the required condition held beforehand";

  it("c18 no longer offers the prohibition state, and offers six alternatives", () => {
    const alts = alternativesFor(c18Subject, C18_BOUNDARY.id, RWS, C18_FRAME.ruleKind);
    expect(alts.map((a) => a.stateId)).not.toContain("prohibited_action_present");
    expect(alts).toHaveLength(6);
  });

  it("FORWARD — every c18 alternative is accepted by the canonical validator", () => {
    for (const alt of alternativesFor(c18Subject, C18_BOUNDARY.id, RWS, C18_FRAME.ruleKind)) {
      const r = validatesUnder(C18_CTX, C18_BOUNDARY.id, [...R248_ATTEMPT_1], RWS, alt, PROSE);
      expect(r.ok, `${alt.stateId} ${alt.prerequisiteStatus}: ${r.codes.join(", ")}`).toBe(true);
    }
  });

  it("REVERSE — every canonical state this frame can ground is actually offered", () => {
    /**
     * The half that "all offered alternatives validate" cannot prove: a generator that offered
     * NOTHING would pass the forward check. A state is expected here when its rule kind admits it,
     * its governed-action status matches, and this surface's pools can ground its required roles.
     */
    const satPool = poolOf(c18Subject, RWS, "prerequisite_satisfaction");
    const failPool = poolOf(c18Subject, RWS, "prerequisite_failure");
    const expected = TRUTH_STATES.filter(
      (s) =>
        (s.appliesToRuleKinds as readonly string[]).includes(C18_FRAME.ruleKind) &&
        s.governedActionStatus === "present" &&
        !(s.satisfactionCandidate === "required" && satPool.length === 0) &&
        !(s.failureCandidate === "required" && failPool.length === 0),
    ).map((s) => s.id);
    const offered = new Set(alternativesFor(c18Subject, C18_BOUNDARY.id, RWS, C18_FRAME.ruleKind).map((a) => a.stateId));
    expect([...offered].sort()).toEqual([...new Set(expected)].sort());
    // The empty failure pool is the reason two violating states are absent — unchanged by R2.56.
    expect(failPool).toHaveLength(0);
    expect(offered.has("governed_action_prerequisite_missing")).toBe(false);
  });

  it("the prohibition frame OFFERS the prohibition alternative, and the validator accepts it", () => {
    const alts = alternativesFor(proSubject, PROHIBITION_BOUNDARY.id, PROHIBITION_BREACH_SURFACE_REF, PROHIBITION_FRAME.ruleKind);
    expect(alts.map((a) => a.stateId)).toContain("prohibited_action_present");
    const proRows = (proSubject.surfaces as Array<{ coordinate: string }>).map((s) => ({
      boundaryId: PROHIBITION_BOUNDARY.id,
      surfaceRef: s.coordinate,
      governedActionStatus: s.coordinate === PROHIBITION_BREACH_SURFACE_REF ? "present" : "absent",
      prerequisiteStatus: "not_applicable",
      temporalRelation: "not_applicable",
      governedActionCandidateId: poolOf(proSubject, s.coordinate, "governed_action")[0] ?? "none",
      prerequisiteSatisfactionCandidateId: "none",
      prerequisiteFailureCandidateId: "none",
      reason: "",
    })) as BoundaryTruthAssessment[];
    for (const alt of alts) {
      const r = validatesUnder(PRO_CTX, PROHIBITION_BOUNDARY.id, proRows, PROHIBITION_BREACH_SURFACE_REF, alt, PROSE);
      expect(r.ok, `${alt.stateId}: ${r.codes.join(", ")}`).toBe(true);
    }
  });

  it("the generator holds NO rule-kind logic of its own — the same call differs only by rule kind", () => {
    // Identical arguments except `ruleKind`. If the generator had grown an exception, this would not
    // be the only difference.
    const asPrerequisite = alternativesFor(c18Subject, C18_BOUNDARY.id, RWS, "prerequisite_before_action").map((a) => a.stateId);
    const asProhibition = alternativesFor(c18Subject, C18_BOUNDARY.id, RWS, "prohibition").map((a) => a.stateId);
    expect(asPrerequisite).not.toContain("prohibited_action_present");
    expect(asProhibition).toEqual(["prohibited_action_present"]);
  });
});

// ---------------------------------------------------------------------------
// Part 9 — the R2.54 repair path, with the new invalid shape
// ---------------------------------------------------------------------------

describe("[R2.56][9] the R2.54 repair path refuses the prohibition shape on a prerequisite rule", () => {
  const plan = (): FieldRepairPlan => planFieldRepair(R248_ATTEMPT_1, C18_CTX, C18_DIGESTS);
  const defectiveGroup = (p: FieldRepairPlan): FieldRepairTarget[] => p.targets.filter((t) => t.surfaceRef === RWS);

  /** The complete, well-formed, entirely plausible selection R2.55 proved the path used to accept. */
  const prohibitionSelection: Record<string, string> = {
    ...PROHIBITION_BREACH_FACTS,
    prerequisiteSatisfactionCandidateId: "none",
    prerequisiteFailureCandidateId: "none",
    reason: "",
  };

  const applied = () => {
    const p = plan();
    const ops = selectPlanDerivedOperations(p.targets, (group) =>
      group.map((t) => {
        const value = prohibitionSelection[t.field];
        if (value === undefined) throw new Error(`no value for grouped field ${t.field}`);
        return { surfaceRef: t.surfaceRef, field: t.field, value };
      }),
    );
    return { p, ops, result: applyFieldRepair({ repairs: ops }, R248_ATTEMPT_1, p, C18_CTX, C18_DIGESTS) };
  };

  it("the plan no longer publishes the prohibition alternative to the model", () => {
    const p = plan();
    const req = buildFieldRepairRequest(c18Subject, p);
    expect(req.dependencyGroups).toHaveLength(1);
    expect(req.dependencyGroups[0]!.alternatives.map((a) => a.stateId)).not.toContain("prohibited_action_present");
    expect(req.dependencyGroups[0]!.alternatives).toHaveLength(6);
    expect(JSON.stringify(req)).not.toContain("prohibited_action_present");
  });

  it("a COMPLETE selection of that shape is refused as an off-alternative shape", () => {
    const { result, ops } = applied();
    // Complete — this is not a coverage failure, which is what makes the shape code the right one.
    expect(ops).toHaveLength(14);
    expect(result.validation.ok).toBe(false);
    const codes = result.validation.ok ? [] : result.validation.codes;
    expect(codes).toContain("field_repair_group_shape_not_allowed");
    expect(codes).not.toContain("field_repair_operation_missing");
    expect(codes).not.toContain("field_repair_operation_count_mismatch");
  });

  it("it never reaches the merge, and no violation is fabricated", () => {
    const { result } = applied();
    expect(result.mergeAttempted).toBe(false);
    expect(result.merge.ok).toBe(false);
    expect(result.merge.rows).toEqual([]);
    const sel = result.validation.groupSelections[0]!;
    expect(sel.matchedStateId).toBeNull();
    expect(sel.matchedAlternativeId).toBeNull();
    expect(sel.code).toBe("field_repair_group_shape_not_allowed");
    // R2.55 measured this exact input merging into `boundary_review_reject` with
    // `prohibited_action_present:explicit_boundary_contradiction`. Neither is reachable now.
    expect(JSON.stringify(result.merge)).not.toContain("explicit_boundary_contradiction");
    expect(JSON.stringify(result.merge)).not.toContain("boundary_review_reject");
  });

  it("the SAME shape is still ACCEPTED by the repair matcher under a genuine prohibition rule", () => {
    /**
     * The other half of the fix. Refusing the shape everywhere would satisfy every assertion above
     * and would silently destroy the state's original R2.38 purpose: without it a prohibition would
     * be structurally unjudgeable.
     */
    const alts = alternativesFor(proSubject, PROHIBITION_BOUNDARY.id, PROHIBITION_BREACH_SURFACE_REF, PROHIBITION_FRAME.ruleKind);
    const match = matchGroupAlternative(alts, {
      prerequisiteStatus: PROHIBITION_BREACH_FACTS.prerequisiteStatus,
      temporalRelation: PROHIBITION_BREACH_FACTS.temporalRelation,
      prerequisiteSatisfactionCandidateId: "none",
      prerequisiteFailureCandidateId: "none",
      reason: "",
    });
    expect(match.ok).toBe(true);
    if (!match.ok) throw new Error("unreachable");
    expect(match.stateId).toBe("prohibited_action_present");
    expect(match.reasonAuthority).toBe("server_derived");

    // And the identical selection is refused by the c18 group, which is the whole claim.
    const c18Match = matchGroupAlternative(alternativesFor(c18Subject, C18_BOUNDARY.id, RWS, C18_FRAME.ruleKind), {
      prerequisiteStatus: PROHIBITION_BREACH_FACTS.prerequisiteStatus,
      temporalRelation: PROHIBITION_BREACH_FACTS.temporalRelation,
      prerequisiteSatisfactionCandidateId: "none",
      prerequisiteFailureCandidateId: "none",
      reason: "",
    });
    expect(c18Match.ok).toBe(false);
    if (c18Match.ok) throw new Error("unreachable");
    expect(c18Match.code).toBe("field_repair_group_shape_not_allowed");
  });

  it("the group still accepts the alternatives it legitimately offers", () => {
    // Refusing everything would also satisfy the assertions above. It does not.
    const p = plan();
    const ok = applyFieldRepair({ repairs: selectPlanDerivedOperations(p.targets) }, R248_ATTEMPT_1, p, C18_CTX, C18_DIGESTS);
    expect(ok.validation.ok).toBe(true);
    expect(ok.mergeAttempted).toBe(true);
    expect(ok.merge.ok).toBe(true);
    expect(defectiveGroup(p)[0]!.alternatives).toHaveLength(6);
  });
});
