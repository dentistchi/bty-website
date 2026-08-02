/**
 * GENERATED-RESULT CAUSAL OWNERSHIP + CORRECTION DEDUP (Slice 3.2I-R5B1A.1-R2.46).
 *
 * The negative cases are written FIRST and are the point of the file. Attribution that fires when it
 * should not is worse than no attribution at all: it moves a correction instruction onto a choice
 * that did not cause the defect, which is the exact failure R2.39 measured from the other direction.
 */

import { describe, it, expect } from "vitest";
import {
  ATTRIBUTION_AUTHORITY,
  ATTRIBUTION_REFUSAL_CODES,
  buildCausalGroups,
  causalAttributionContractSha256,
  deriveCausalAttributions,
  summarizeCausalAttribution,
  type AttributionInputViolation,
} from "./generatedResultAttribution";
import type { BoundarySurface } from "./boundarySurfaces";
import { deriveBoundaryVerdict } from "./narrowBoundaryReview";
import { buildSemanticFrames } from "./boundarySemanticFrame";
import { buildCorrectionPacket } from "./correctionPacket";
import { resolveRejection } from "./gatePrecedence";
import { buildNarrowBoundarySubject } from "@/lib/bty/foundry/arena/narrowBoundaryContract";
import { projectCausalFindings } from "@/lib/bty/foundry/arena/boundaryReviewStage";
import { C18_BOUNDARY, C18_SURFACES, C18_SCENARIO, C18_SCENARIO_SHA256 } from "./c18BoundaryFixture";
import {
  buildR242PostPolarityMatrix,
  R242_APPLICABILITY_FALSE_POSITIVES,
  R242_POLARITY_FALSE_POSITIVES,
  R242_TRUE_POSITIVES,
} from "./r242LiveDtoFixture";

// ---------------------------------------------------------------------------
// Structural fixtures — one primary choice, its generated state, one later action
// ---------------------------------------------------------------------------

const surface = (over: Partial<BoundarySurface> & { coordinate: string }): BoundarySurface =>
  ({
    kind: "choice",
    phase: "primary",
    reachability: "learner_decision",
    userReachable: true,
    independentlySelectable: true,
    branchIndex: -1,
    index: 0,
    parentPrimaryCoordinate: "",
    lineage: [],
    text: "",
    selectedPrimaryLabel: "",
    branchContext: "",
    inheritedWorldState: "",
    isActionCommitment: false,
    acceptedCost: "",
    compatibilitySource: "",
    ...over,
  }) as BoundarySurface;

const PARENT = surface({ coordinate: "primary[1]", index: 1 });
const CHILD = surface({
  coordinate: "branch[1].resulting_world_state",
  kind: "resulting_world_state",
  phase: "branch_resulting_world_state",
  reachability: "generated_state",
  independentlySelectable: false,
  branchIndex: 1,
  index: -1,
  parentPrimaryCoordinate: "primary[1]",
  lineage: ["primary[1]"],
});
const LATER_ACTION = surface({
  coordinate: "branch[1].action[1]",
  phase: "branch_action",
  branchIndex: 1,
  index: 1,
  parentPrimaryCoordinate: "primary[1]",
  lineage: ["branch[1].resulting_world_state", "primary[1]"],
});

const SURFACES = [PARENT, CHILD, LATER_ACTION];
const BOUNDARIES = ["c1_verify"];

const violation = (over: Partial<AttributionInputViolation> = {}): AttributionInputViolation => ({
  boundaryId: "c1_verify",
  surfaceRef: "branch[1].resulting_world_state",
  compliance: "violates",
  lineage: ["primary[1]"],
  governedActionCandidateId: "8-a1",
  prerequisiteFailureCandidateId: "8-f1",
  governedActionSegmentRef: "8:own",
  prerequisiteSegmentRef: "8:own",
  prerequisiteSegmentKind: "own_surface",
  ...over,
});

const derive = (v: AttributionInputViolation[], s: BoundarySurface[] = SURFACES, b: string[] = BOUNDARIES) =>
  deriveCausalAttributions(v, s, b);

// ---------------------------------------------------------------------------
// Part 6 — NEGATIVE ATTRIBUTION REGRESSIONS (written first)
// ---------------------------------------------------------------------------

describe("[R2.46][6] attribution refuses everything it cannot structurally prove", () => {
  it("6.1 a COMPLIANT child produces no attribution", () => {
    // The whole point of R2.44: branch[0] now complies. A compliant state has nothing to attribute.
    const r = derive([violation({ compliance: "complies" })]);
    expect(r.attributions).toHaveLength(0);
    expect(r.metrics.generatedResultAncestorAttributionCount).toBe(0);
  });

  it("6.2 a NOT-APPLICABLE child produces no attribution", () => {
    const r = derive([violation({ compliance: "not_assessed" })]);
    expect(r.attributions).toHaveLength(0);
  });

  it("6.3 a MALFORMED child finding — unresolved candidate evidence — produces no attribution", () => {
    const noAction = derive([violation({ governedActionCandidateId: "" })]);
    const noFailure = derive([violation({ prerequisiteFailureCandidateId: "none" })]);
    expect(noAction.attributions).toHaveLength(0);
    expect(noFailure.attributions).toHaveLength(0);
    for (const r of [noAction, noFailure]) {
      expect(r.decisions[0]!.refusalCode).toBe("causal_attribution_child_evidence_unresolved");
    }
  });

  it("6.4 a TWO-PARENT lineage is refused with a precise code, never guessed at", () => {
    const r = derive([violation({ lineage: ["primary[0]", "primary[1]"] })]);
    expect(r.attributions).toHaveLength(0);
    expect(r.decisions[0]!.refusalCode).toBe("causal_attribution_lineage_not_single_parent");
  });

  it("6.4b an EMPTY lineage is refused with the same code", () => {
    const r = derive([violation({ lineage: [] })]);
    expect(r.attributions).toHaveLength(0);
    expect(r.decisions[0]!.refusalCode).toBe("causal_attribution_lineage_not_single_parent");
  });

  it("6.5 a TWO-HOP descendant cannot attribute back through this rule", () => {
    // branch[1].action[1] is a real violation whose lineage reaches primary[1] — but it is not a
    // resulting world state, so this rule never touches it. It stays its own correction owner.
    const r = derive([violation({ surfaceRef: "branch[1].action[1]", lineage: ["branch[1].resulting_world_state", "primary[1]"], governedActionCandidateId: "12-a1", prerequisiteFailureCandidateId: "12-f1" })]);
    expect(r.attributions).toHaveLength(0);
    expect(r.decisions[0]!.refusalCode).toBe("causal_attribution_child_not_resulting_world_state");
  });

  it("6.6 a GENERATED parent produces no attribution", () => {
    const generatedParent = surface({ coordinate: "primary[1]", reachability: "generated_state", independentlySelectable: false });
    const r = derive([violation()], [generatedParent, CHILD, LATER_ACTION]);
    expect(r.attributions).toHaveLength(0);
    expect(r.decisions[0]!.refusalCode).toBe("causal_attribution_parent_not_learner_decision");
  });

  it("6.7 a NON-SELECTABLE parent produces no attribution", () => {
    const inert = surface({ coordinate: "primary[1]", independentlySelectable: false });
    const r = derive([violation()], [inert, CHILD, LATER_ACTION]);
    expect(r.attributions).toHaveLength(0);
    expect(r.decisions[0]!.refusalCode).toBe("causal_attribution_parent_not_independently_selectable");
  });

  it("6.7b a parent MISSING from the frozen surface map produces no attribution", () => {
    const r = derive([violation()], [CHILD, LATER_ACTION]);
    expect(r.attributions).toHaveLength(0);
    expect(r.decisions[0]!.refusalCode).toBe("causal_attribution_parent_not_in_surface_map");
  });

  it("6.8 a BOUNDARY MISMATCH produces no attribution", () => {
    const r = derive([violation({ boundaryId: "c9_other" })]);
    expect(r.attributions).toHaveLength(0);
    expect(r.decisions[0]!.refusalCode).toBe("causal_attribution_boundary_mismatch");
  });

  it("6.8b a child whose schema edge does not name its lineage parent is refused", () => {
    // lineage says primary[1]; parentPrimaryCoordinate says primary[0]. The schema edge is the
    // authority, so the disagreement is refused rather than resolved in either direction.
    const skewed = surface({ ...CHILD, parentPrimaryCoordinate: "primary[0]" } as never);
    const r = derive([violation()], [PARENT, skewed, LATER_ACTION]);
    expect(r.attributions).toHaveLength(0);
    expect(r.decisions[0]!.refusalCode).toBe("causal_attribution_schema_edge_mismatch");
  });

  it("6.8c a child whose branch index does not match its parent's primary index is refused", () => {
    const wrongBranch = surface({ ...CHILD, coordinate: "branch[0].resulting_world_state", branchIndex: 0 } as never);
    const r = derive([violation({ surfaceRef: "branch[0].resulting_world_state" })], [PARENT, wrongBranch, LATER_ACTION]);
    expect(r.attributions).toHaveLength(0);
    expect(r.decisions[0]!.refusalCode).toBe("causal_attribution_schema_edge_mismatch");
  });

  it("6.10 attribution uses NO text overlap — a generated state may say things its parent never did", () => {
    // The branch[0] shape measured in R2.45: the generated state introduces "provided the necessary
    // treatment", a governed action the parent label ("Verify identifiers for both patients now")
    // never states. Attribution must not consult text at all, in either direction.
    const noOverlapParent = surface({ coordinate: "primary[1]", index: 1, text: "Zebra quilt vantage" });
    const noOverlapChild = surface({ ...CHILD, text: "Completely unrelated wording with no shared token." } as never);
    const r = derive([violation()], [noOverlapParent, noOverlapChild, LATER_ACTION]);
    expect(r.attributions).toHaveLength(1);
    expect(r.attributions[0]!.ancestorSurfaceRef).toBe("primary[1]");
    // And the contract digest records that no lexical input exists.
    expect(ATTRIBUTION_AUTHORITY).toContain("schema");
  });

  it("every refusal code is registered — no ad-hoc strings", () => {
    const cases = [
      violation({ compliance: "complies" }),
      violation({ lineage: [] }),
      violation({ boundaryId: "c9_other" }),
      violation({ governedActionCandidateId: "none" }),
      violation({ surfaceRef: "branch[1].action[1]" }),
    ];
    for (const c of cases) {
      const code = derive([c]).decisions[0]!.refusalCode;
      if (code !== null) expect(ATTRIBUTION_REFUSAL_CODES).toContain(code);
    }
  });
});

// ---------------------------------------------------------------------------
// Part 1 + Part 5 — the positive case
// ---------------------------------------------------------------------------

describe("[R2.46][1] the one shape attribution accepts", () => {
  it("a valid resulting-world-state violation attributes to its single learner parent", () => {
    const r = derive([violation()]);
    expect(r.attributions).toHaveLength(1);
    const a = r.attributions[0]!;
    expect(a.ancestorSurfaceRef).toBe("primary[1]");
    expect(a.manifestationSurfaceRef).toBe("branch[1].resulting_world_state");
    expect(a.attributionAuthority).toBe(ATTRIBUTION_AUTHORITY);
    expect(a.boundaryId).toBe("c1_verify");
    expect(a.lineage).toEqual(["primary[1]"]);
  });

  it("the causal group id is deterministic and boundary-scoped", () => {
    const a1 = derive([violation()]).attributions[0]!;
    const a2 = derive([violation()]).attributions[0]!;
    expect(a1.causalGroupId).toBe(a2.causalGroupId);
    const other = derive([violation({ boundaryId: "c2_other" })], SURFACES, ["c1_verify", "c2_other"]).attributions[0]!;
    expect(other.causalGroupId).not.toBe(a1.causalGroupId);
  });
});

// ---------------------------------------------------------------------------
// Part 2 — DIRECT-ROW IMMUTABILITY
// ---------------------------------------------------------------------------

describe("[R2.46][2] attribution never rewrites the rows it reads", () => {
  it("the input violation objects are returned byte-identical", () => {
    const rows = [violation(), violation({ surfaceRef: "branch[1].action[1]", lineage: ["branch[1].resulting_world_state", "primary[1]"] })];
    const before = JSON.stringify(rows);
    const r = derive(rows);
    expect(JSON.stringify(rows)).toBe(before);
    expect(r.metrics.ancestorDirectAssessmentMutationCount).toBe(0);
  });

  it("candidate evidence and provenance stay on the CHILD, never copied to the parent", () => {
    const a = derive([violation()]).attributions[0]!;
    expect(a.evidenceCandidateIds).toEqual(["8-a1", "8-f1"]);
    // Every provenance row names the manifestation surface. Nothing points at primary[1].
    for (const p of a.evidenceProvenance) expect(p.surfaceRef).toBe("branch[1].resulting_world_state");
    expect(a.evidenceProvenance.map((p) => p.surfaceRef)).not.toContain("primary[1]");
  });
});

// ---------------------------------------------------------------------------
// Part 3 — CAUSAL GROUPING
// ---------------------------------------------------------------------------

describe("[R2.46][3] causal grouping is explicit, never mechanism coincidence", () => {
  const rows = [
    violation(),
    violation({ surfaceRef: "branch[1].action[1]", lineage: ["branch[1].resulting_world_state", "primary[1]"], governedActionCandidateId: "12-a1", prerequisiteFailureCandidateId: "12-f1" }),
  ];

  it("the generated state is owned by its parent; the later action owns itself", () => {
    const groups = buildCausalGroups(rows, derive(rows).attributions);
    expect(groups).toHaveLength(2);
    const branchGroup = groups.find((g) => g.attributed)!;
    expect(branchGroup.correctionOwnerSurfaceRef).toBe("primary[1]");
    expect(branchGroup.manifestationSurfaceRefs).toEqual(["branch[1].resulting_world_state"]);
    const reopen = groups.find((g) => !g.attributed)!;
    expect(reopen.correctionOwnerSurfaceRef).toBe("branch[1].action[1]");
    expect(reopen.manifestationSurfaceRefs).toEqual([]);
  });

  it("grouping does not depend on the two rows sharing a mechanism", () => {
    // R2.45 measured that deriveMechanism short-circuits on resulting_world_state BEFORE the
    // ancestor check, so a generated child can never share its parent's mechanism. Grouping is
    // therefore keyed on the schema edge, and this test pins that it still works when the
    // mechanisms are deliberately different.
    const groups = buildCausalGroups(rows, derive(rows).attributions);
    expect(groups.find((g) => g.attributed)!.correctionOwnerSurfaceRef).toBe("primary[1]");
  });

  it("an unattributed violation is always its own owner — nothing is silently dropped", () => {
    const only = [rows[1]!];
    const groups = buildCausalGroups(only, derive(only).attributions);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.correctionOwnerSurfaceRef).toBe("branch[1].action[1]");
  });

  it("every causal violation lands in exactly one group", () => {
    const groups = buildCausalGroups(rows, derive(rows).attributions);
    const covered = groups.flatMap((g) => (g.attributed ? g.manifestationSurfaceRefs : [g.correctionOwnerSurfaceRef]));
    expect(covered.sort()).toEqual(rows.map((r) => r.surfaceRef).sort());
  });
});

// ---------------------------------------------------------------------------
// Part 7 — OBSERVABILITY
// ---------------------------------------------------------------------------

describe("[R2.46][7] the counters an auditor reads", () => {
  it("attribution, manifestation, group and dedup counts reconcile", () => {
    const rows = [violation(), violation({ surfaceRef: "branch[1].action[1]", lineage: ["branch[1].resulting_world_state", "primary[1]"] })];
    const r = derive(rows);
    const groups = buildCausalGroups(rows, r.attributions);
    const m = summarizeCausalAttribution(r.decisions, r.attributions, groups);
    expect(m.generatedResultAncestorAttributionCount).toBe(1);
    expect(m.generatedResultManifestationCount).toBe(1);
    expect(m.causalCorrectionGroupCount).toBe(2);
    // One row that WOULD have produced its own correction item no longer does.
    expect(m.causalPacketDedupCount).toBe(1);
    expect(m.ancestorDirectAssessmentMutationCount).toBe(0);
  });

  it("the contract digest is stable and moves only with the contract", () => {
    expect(causalAttributionContractSha256()).toBe(causalAttributionContractSha256());
    expect(causalAttributionContractSha256()).toHaveLength(64);
  });
});

// ---------------------------------------------------------------------------
// Parts 4, 5, 8 — the captured C18 matrix, end to end
// ---------------------------------------------------------------------------

describe("[R2.46][4,5,8] the canonical post-polarity C18 matrix", () => {
  const subject = buildNarrowBoundarySubject({
    scenarioSha256: C18_SCENARIO_SHA256,
    reviewSubjectSha256: "r".repeat(64),
    boundaryProvenance: { activeBoundaryIds: ["c1_verify"] } as never,
    boundaryProvenanceSha256: "p".repeat(64),
    boundaries: [C18_BOUNDARY],
    surfaces: C18_SURFACES,
    draft: C18_SCENARIO,
    language: "en",
    generationAttemptId: "g1",
    caseId: "c18",
  });
  const candidates = subject.evidenceCandidates;
  const ctx = { boundaries: [C18_BOUNDARY], surfaces: subject.surfaces, frames: buildSemanticFrames([C18_BOUNDARY]), candidates };
  const poolOf = (ref: string, role: string) => candidates.filter((c) => c.assessedSurfaceRef === ref && c.semanticRole === role);
  const matrix = () =>
    buildR242PostPolarityMatrix(
      (ref) => poolOf(ref, "prerequisite_failure"),
      (ref, role) => poolOf(ref, role)[0]?.candidateId ?? "none",
    );
  const verdict = () => {
    const d = deriveBoundaryVerdict({ assessments: matrix() }, ctx);
    if (d.outcome !== "boundary_review_reject") throw new Error(`expected reject, got ${d.outcome}`);
    return d;
  };
  const surfaceByRef = new Map(subject.surfaces.map((s) => [s.coordinate, s]));
  const IMMUTABLE = { title: "Managing a Backed-Up Ward", boundaryStatements: ["Two identifiers must be verified before treatment"] } as never;

  it("primary[1] receives causal correction ownership from its generated child", () => {
    const d = verdict();
    expect(d.causalAttributions).toHaveLength(1);
    const a = d.causalAttributions[0]!;
    expect(a.ancestorSurfaceRef).toBe("primary[1]");
    expect(a.manifestationSurfaceRef).toBe("branch[1].resulting_world_state");
    expect(a.attributionAuthority).toBe(ATTRIBUTION_AUTHORITY);
  });

  it("primary[1]'s DIRECT assessment is untouched — still absent, still 2-a1, still not_applicable", () => {
    const d = verdict();
    const row = d.derived.find((x) => x.surfaceRef === "primary[1]")!;
    expect(row.facts.governedActionStatus).toBe("absent");
    expect(row.governedAction?.candidateId ?? "none").toBe("2-a1");
    expect(row.facts.prerequisiteStatus).toBe("not_applicable");
    expect(row.applicability).toBe("not_applicable");
    // It is NOT a violation row. Ownership is a separate relation, not a promoted verdict.
    expect(d.violations.map((v) => v.surfaceRef)).not.toContain("primary[1]");
    expect(d.causalAttributionMetrics.ancestorDirectAssessmentMutationCount).toBe(0);
  });

  it("the child keeps its own candidate ids, evidence and mechanism", () => {
    const d = verdict();
    const child = d.violations.find((v) => v.surfaceRef === "branch[1].resulting_world_state")!;
    expect(child.governedActionCandidateId).toBe("8-a1");
    expect(child.prerequisiteFailureCandidateId).toBe("8-f1");
    expect(child.violationMechanism).toBe("resulting_state_missing_prerequisite");
    // The parent never borrows them.
    const a = d.causalAttributions[0]!;
    expect(a.evidenceCandidateIds).toEqual(["8-a1", "8-f1"]);
    for (const p of a.evidenceProvenance) expect(p.surfaceRef).toBe("branch[1].resulting_world_state");
  });

  it("R2.44 holds: polarity false positives gone, true positives kept", () => {
    const d = verdict();
    const refs = d.violations.map((v) => v.surfaceRef);
    for (const ref of R242_POLARITY_FALSE_POSITIVES) expect(refs, ref).not.toContain(ref);
    for (const ref of R242_TRUE_POSITIVES) expect(refs, ref).toContain(ref);
  });

  it("PART 8 — the three applicability false positives are STILL OBSERVABLE and unchanged", () => {
    const d = verdict();
    const refs = d.violations.map((v) => v.surfaceRef);
    // Pinned so this slice cannot silently hide or solve them. This is NOT a product-quality pass.
    for (const ref of R242_APPLICABILITY_FALSE_POSITIVES) expect(refs, ref).toContain(ref);
    expect(d.violations).toHaveLength(R242_TRUE_POSITIVES.length + R242_APPLICABILITY_FALSE_POSITIVES.length);
    // And none of them attributes to anything — they are ordinary choice surfaces.
    expect(d.causalAttributions.map((a) => a.manifestationSurfaceRef)).toEqual(["branch[1].resulting_world_state"]);
  });

  it("PART 4 — the TRUE branch defect and the reopening produce exactly TWO packet items", () => {
    const d = verdict();
    // Isolate the two true findings from the three known applicability false positives, which a
    // later slice owns. This measures the REPRESENTATION, not the semantics.
    const trueCausal = d.causalViolations.filter((v) => (R242_TRUE_POSITIVES as readonly string[]).includes(v.surfaceRef));
    const groups = buildCausalGroups(trueCausal, d.causalAttributions);
    const findings = projectCausalFindings(groups, trueCausal, surfaceByRef);
    const packet = buildCorrectionPacket(1, findings[0]!.code, resolveRejection([...findings])!.findings, IMMUTABLE);
    expect(packet.items).toHaveLength(2);
    const [a, b] = [...packet.items].sort((x, y) => (x.code < y.code ? -1 : 1));
    // A — the choice-caused branch violation, owned by primary[1], evidenced at the generated state.
    expect(b!.code).toBe("choice_bypasses_boundary");
    expect(b!.coordinates).toHaveLength(2);
    // B — the independent reopening, owned by itself.
    expect(a!.code).toBe("action_reopens_boundary");
    expect(a!.coordinates).toHaveLength(1);
    // NOT three. The generated state never becomes its own instruction.
    expect(packet.defectCodes).not.toContain("branch_drops_boundary");
  });

  it("PART 7 — the observability counters reconcile on the captured matrix", () => {
    const d = verdict();
    const m = d.causalAttributionMetrics;
    expect(m.generatedResultAncestorAttributionCount).toBe(1);
    expect(m.generatedResultManifestationCount).toBe(1);
    expect(m.causalPacketDedupCount).toBe(1);
    expect(m.ancestorDirectAssessmentMutationCount).toBe(0);
    // Five causal violations, one of which is folded into its parent's group.
    expect(m.causalCorrectionGroupCount).toBe(d.causalViolations.length);
  });
});
