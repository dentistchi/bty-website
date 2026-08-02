/**
 * ABSENT-CANDIDATE INSTRUCTION PARITY + TRUE FAILED-SUBSET SCOPING
 * (Slice 3.2I-R5B1A.1-R2.42 Part 4).
 *
 * R2.40's live replay died an output-contract death. Six surfaces returned `absent` with the
 * sentinel on NON-EMPTY governed-action pools; the contract requires a selection there. R2.41 proved
 * the cause was prompt-internal — one line generalized "absent ⇒ sentinel" while the generated state
 * rule for the same state said "Select the governed-action candidate that shows what it DOES".
 *
 * THE CONTRACT IS NOT THE DEFECT AND IS NOT CHANGED HERE. `non_governing` still REQUIRES a
 * governed-action candidate; the validator still refuses `absent` + non-empty pool + sentinel. What
 * changes is the instruction, so it says what the contract already means.
 *
 * The second defect is structural: the stage computed six repair surfaces and the reviewer rebuilt a
 * twelve-surface request, so the failed-subset repair had never once functioned.
 */
import { describe, expect, it } from "vitest";
import { buildAllEvidenceCandidates, poolFor } from "./boundaryEvidenceCandidates";
import { buildContextSegments } from "./boundaryContextSegments";
import { buildSemanticFrames } from "./boundarySemanticFrame";
import { TRUTH_STATES } from "./boundaryTruthStates";
import { NO_CANDIDATE } from "./boundaryTruthContractTypes";
import {
  deriveBoundaryVerdict,
  mergeSubsetRepair,
  planSubsetRepair,
  validateNarrowBoundaryReview,
  type BoundaryTruthAssessment,
  type NarrowReviewContext,
} from "./narrowBoundaryReview";
import {
  NARROW_BOUNDARY_SYSTEM_PROMPT,
  buildNarrowBoundaryRequest,
  buildNarrowBoundarySubject,
} from "@/lib/bty/foundry/arena/narrowBoundaryContract";
import { C18_BOUNDARY, C18_REACHABLE_SURFACES, C18_SCENARIO, C18_SCENARIO_SHA256, C18_SURFACES } from "./c18BoundaryFixture";
import {
  R240_BOUNDARY_REVIEW_SUBJECT_SHA256,
  R240_FAILED_SURFACE_REFS,
  R240_LIVE_ATTEMPT_1,
  R240_MEASURED,
  R240_PRESERVED_SURFACE_REFS,
} from "./r240LiveDtoFixture";

const segments = buildContextSegments(C18_SCENARIO, C18_REACHABLE_SURFACES);
const frames = buildSemanticFrames([C18_BOUNDARY]);
const { candidates } = buildAllEvidenceCandidates([C18_BOUNDARY], frames, C18_REACHABLE_SURFACES, segments);
const ctx: NarrowReviewContext = { boundaries: [C18_BOUNDARY], surfaces: C18_REACHABLE_SURFACES, frames, candidates };
const pool = (ref: string, role: "governed_action" | "prerequisite_satisfaction" | "prerequisite_failure") =>
  poolFor(candidates, C18_BOUNDARY.id, ref, role);
const first = (ref: string, role: "governed_action" | "prerequisite_satisfaction" | "prerequisite_failure") =>
  pool(ref, role)[0]?.candidateId ?? NO_CANDIDATE;

const subject = buildNarrowBoundarySubject({
  scenarioSha256: C18_SCENARIO_SHA256,
  reviewSubjectSha256: "r".repeat(64),
  boundaryProvenance: { activeBoundaryIds: [C18_BOUNDARY.id] } as never,
  boundaryProvenanceSha256: "p".repeat(64),
  boundaries: [C18_BOUNDARY],
  surfaces: C18_SURFACES,
  draft: C18_SCENARIO,
  language: "en",
  generationAttemptId: "gen1",
  caseId: "c18-constrained-clinical",
});

/** Every surface non-governing, each SELECTING from its pool where one exists. */
const settled = (): BoundaryTruthAssessment[] =>
  C18_REACHABLE_SURFACES.map((s) => ({
    boundaryId: C18_BOUNDARY.id,
    surfaceRef: s.coordinate,
    governedActionStatus: "absent",
    prerequisiteStatus: "not_applicable",
    temporalRelation: "not_applicable",
    governedActionCandidateId: first(s.coordinate, "governed_action"),
    prerequisiteSatisfactionCandidateId: NO_CANDIDATE,
    prerequisiteFailureCandidateId: NO_CANDIDATE,
    reason: "",
  }));
const withRow = (ref: string, over: Partial<BoundaryTruthAssessment>) =>
  settled().map((a) => (a.surfaceRef === ref ? { ...a, ...over } : a));

// ---------------------------------------------------------------------------
// A — PROMPT PARITY
// ---------------------------------------------------------------------------

describe("[R2.42][A] prompt instruction parity", () => {
  it("states one explicit pool-cardinality decision table", () => {
    for (const row of [
      "| empty     | absent  | none        |",
      "| empty     | present | NOT VALID   |",
      "| non-empty | absent  | pool member |",
      "| non-empty | present | pool member |",
    ]) {
      expect(NARROW_BOUNDARY_SYSTEM_PROMPT, row).toContain(row);
    }
  });

  it("says the sentinel is for an EMPTY list only, and never that absent implies none", () => {
    expect(NARROW_BOUNDARY_SYSTEM_PROMPT).toContain(
      "Use the sentinel ONLY when the governedActionCandidates list for that surface is empty.",
    );
    // The exact phrasing R2.41 proved the reviewer generalized.
    expect(NARROW_BOUNDARY_SYSTEM_PROMPT).not.toContain("Answer governedActionStatus=absent and use the sentinel.");
  });

  it("explains WHY an absent row still selects — the candidate records what the surface does", () => {
    expect(NARROW_BOUNDARY_SYSTEM_PROMPT).toContain(
      "you are saying that the action you selected is not the action the boundary governs",
    );
  });

  it("no generated state rule contradicts the decision table", () => {
    // The `non_governing` rule must not be readable as "use the sentinel".
    const nonGoverning = NARROW_BOUNDARY_SYSTEM_PROMPT.split("\n").find((l) => l.includes("non_governing —"))!;
    expect(nonGoverning).toContain("Select the governed-action candidate");
    // Scoped to the same sentence: "Both PREREQUISITE candidates must be none" is correct and must
    // not be mistaken for a contradiction about the governed-action candidate.
    expect(nonGoverning).not.toMatch(/governed-action candidate[^.]*must be none/);
    // …and no line anywhere may pair an absent status with a blanket sentinel instruction.
    for (const line of NARROW_BOUNDARY_SYSTEM_PROMPT.split("\n")) {
      if (/governedActionStatus=absent/.test(line) && /sentinel/i.test(line)) {
        expect(line, `contradictory line: ${line}`).toMatch(/empty/i);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// B — VALIDATOR PRESERVATION (the contract must NOT move)
// ---------------------------------------------------------------------------

describe("[R2.42][B] the semantic contract is preserved exactly", () => {
  it("non_governing still REQUIRES a governed-action candidate", () => {
    expect(TRUTH_STATES.find((s) => s.id === "non_governing")!.governedActionCandidate).toBe("required");
  });

  it("empty pool + absent + none → VALID (the R2.40 exemption)", () => {
    expect(pool("primary[0]", "governed_action")).toHaveLength(0);
    const v = validateNarrowBoundaryReview({ assessments: settled() }, ctx);
    expect(v.ok).toBe(true);
  });

  it("empty pool + present → boundary_governed_action_candidate_unavailable", () => {
    const v = validateNarrowBoundaryReview(
      { assessments: withRow("primary[0]", { governedActionStatus: "present", prerequisiteStatus: "explicitly_missing", temporalRelation: "action_before_prerequisite" }) },
      ctx,
    );
    expect(v.ok).toBe(false);
    if (v.ok) throw new Error("unreachable");
    expect(v.codes).toContain("boundary_governed_action_candidate_unavailable");
  });

  it("non-empty pool + absent + POOL MEMBER → VALID", () => {
    const v = validateNarrowBoundaryReview({ assessments: settled() }, ctx);
    expect(v.ok).toBe(true);
    if (!v.ok) throw new Error("unreachable");
    expect(v.derived.find((d) => d.surfaceRef === "primary[1]")!.governedAction!.candidateId).toBe(first("primary[1]", "governed_action"));
  });

  it("non-empty pool + absent + none → boundary_candidate_required_missing (UNCHANGED)", () => {
    const v = validateNarrowBoundaryReview({ assessments: withRow("primary[1]", { governedActionCandidateId: NO_CANDIDATE }) }, ctx);
    expect(v.ok).toBe(false);
    if (v.ok) throw new Error("unreachable");
    expect(v.codes).toContain("boundary_candidate_required_missing");
  });

  it("non-empty pool + present + POOL MEMBER → VALID · + none → required_missing", () => {
    const ref = "branch[1].action[1]";
    const violating = {
      governedActionStatus: "present" as const,
      prerequisiteStatus: "explicitly_missing" as const,
      temporalRelation: "action_before_prerequisite" as const,
      prerequisiteFailureCandidateId: first(ref, "prerequisite_failure"),
    };
    expect(validateNarrowBoundaryReview({ assessments: withRow(ref, violating) }, ctx).ok).toBe(true);
    const missing = validateNarrowBoundaryReview({ assessments: withRow(ref, { ...violating, governedActionCandidateId: NO_CANDIDATE }) }, ctx);
    expect(missing.ok).toBe(false);
    if (missing.ok) throw new Error("unreachable");
    expect(missing.codes).toContain("boundary_candidate_required_missing");
  });
});

// ---------------------------------------------------------------------------
// C — PRIMARY[0] ROLE PROTECTION
// ---------------------------------------------------------------------------

describe("[R2.42][C] the R2.40 role authority is untouched", () => {
  it("primary[0] keeps an empty pool and derives a clean non-governing result", () => {
    expect(pool("primary[0]", "governed_action")).toHaveLength(0);
    const d = deriveBoundaryVerdict({ assessments: settled() }, ctx);
    expect(d.outcome).toBe("boundary_review_pass");
    if (d.outcome !== "boundary_review_pass") throw new Error("unreachable");
    const row = d.derived.find((x) => x.surfaceRef === "primary[0]")!;
    expect(row.stateId).toBe("non_governing");
    expect(row.applicability).toBe("not_applicable");
    expect(row.compliance).toBe("not_assessed");
    expect(row.governedAction).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// D — FULL VS REPAIR REQUEST PROJECTION
// ---------------------------------------------------------------------------

describe("[R2.42][D] the repair request is a PROJECTION of the frozen subject", () => {
  it("the initial request carries all twelve surfaces", () => {
    const full = buildNarrowBoundaryRequest(subject);
    expect(full.surfaces).toHaveLength(12);
    expect(full.requiredAssessmentCount).toBe(12);
    expect(full.decisionSurfaceCount).toBe(12);
  });

  it("a six-surface repair request carries exactly those six", () => {
    const repair = buildNarrowBoundaryRequest(subject, [...R240_FAILED_SURFACE_REFS]);
    expect(repair.surfaces.map((s) => s.surfaceRef)).toEqual([...R240_FAILED_SURFACE_REFS]);
    expect(repair.requiredAssessmentCount).toBe(6);
    expect(repair.decisionSurfaceCount).toBe(6);
    for (const preserved of R240_PRESERVED_SURFACE_REFS) {
      expect(repair.surfaces.map((s) => s.surfaceRef)).not.toContain(preserved);
    }
  });

  it("each projected surface keeps its exact pools, text and lineage", () => {
    const full = buildNarrowBoundaryRequest(subject);
    const repair = buildNarrowBoundaryRequest(subject, [...R240_FAILED_SURFACE_REFS]);
    for (const ref of R240_FAILED_SURFACE_REFS) {
      const a = full.surfaces.find((s) => s.surfaceRef === ref)!;
      const b = repair.surfaces.find((s) => s.surfaceRef === ref)!;
      expect(b).toEqual(a);
      const pa = full.evidenceCandidates[0]!.surfaces.find((s) => s.surfaceRef === ref)!;
      const pb = repair.evidenceCandidates[0]!.surfaces.find((s) => s.surfaceRef === ref)!;
      expect(pb).toEqual(pa);
    }
    // …and no preserved surface's pools travel with the repair.
    expect(repair.evidenceCandidates[0]!.surfaces.map((s) => s.surfaceRef)).toEqual([...R240_FAILED_SURFACE_REFS]);
  });

  it("the ORIGINAL frozen subject digest stays bound, and a subset digest is added", () => {
    const full = buildNarrowBoundaryRequest(subject);
    const repair = buildNarrowBoundaryRequest(subject, [...R240_FAILED_SURFACE_REFS]);
    expect(repair.authority.boundaryReviewSubjectSha256).toBe(full.authority.boundaryReviewSubjectSha256);
    expect(repair.authority.surfaceMapSha256).toBe(full.authority.surfaceMapSha256);
    expect(repair.authority.evidenceCandidateMapSha256).toBe(full.authority.evidenceCandidateMapSha256);
    // The projection is identified separately — it never replaces the subject identity.
    expect(full.repairSubsetSha256).toBeNull();
    expect(repair.repairSubsetSha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it("preserves canonical subject order regardless of the order asked for", () => {
    const shuffled = [...R240_FAILED_SURFACE_REFS].reverse();
    expect(buildNarrowBoundaryRequest(subject, shuffled).surfaces.map((s) => s.surfaceRef)).toEqual([...R240_FAILED_SURFACE_REFS]);
  });

  it("refuses an unknown ref and refuses duplicates", () => {
    expect(() => buildNarrowBoundaryRequest(subject, ["primary[9]"])).toThrow(/unknown/i);
    expect(() => buildNarrowBoundaryRequest(subject, ["primary[1]", "primary[1]"])).toThrow(/duplicate/i);
  });
});

// ---------------------------------------------------------------------------
// E — MERGE AUTHORITY (strict, unchanged)
// ---------------------------------------------------------------------------

describe("[R2.42][E] merge authority stays strict", () => {
  const failed = [...R240_FAILED_SURFACE_REFS];
  const derivedOf = (refs: readonly string[]) => refs.map((r) => ({ surfaceRef: r, boundaryId: C18_BOUNDARY.id } as never));
  const preserved = derivedOf(R240_PRESERVED_SURFACE_REFS);

  it("an exact six-row repair is accepted and yields twelve unique surfaces", () => {
    const m = mergeSubsetRepair(preserved, derivedOf(failed), failed);
    expect(m.ok).toBe(true);
    if (!m.ok) throw new Error("unreachable");
    expect(m.derived).toHaveLength(12);
    expect(new Set(m.derived.map((d) => d.surfaceRef)).size).toBe(12);
    // Preserved rows are carried through by reference — byte-identical.
    for (let i = 0; i < preserved.length; i++) expect(m.derived[i]).toBe(preserved[i]);
  });

  it("a TWELVE-row response to a six-row repair is refused", () => {
    const m = mergeSubsetRepair(preserved, derivedOf([...R240_PRESERVED_SURFACE_REFS, ...failed]), failed);
    expect(m.ok).toBe(false);
    if (m.ok) throw new Error("unreachable");
    expect(m.code).toBe("subset_repair_preserved_row_mutated");
  });

  it("a response mutating primary[0] is refused", () => {
    const m = mergeSubsetRepair(preserved, derivedOf(["primary[0]", ...failed.slice(1)]), failed);
    expect(m.ok).toBe(false);
  });

  it("missing, unknown and duplicate repair rows are all refused", () => {
    expect(mergeSubsetRepair(preserved, derivedOf(failed.slice(1)), failed).ok).toBe(false);
    expect(mergeSubsetRepair(preserved, derivedOf([...failed, "branch[1].tradeoff[0]"]), failed).ok).toBe(false);
    const dup = mergeSubsetRepair(preserved, derivedOf([...failed, failed[0]!]), failed);
    expect(dup.ok).toBe(false);
    if (dup.ok) throw new Error("unreachable");
    expect(dup.code).toBe("subset_repair_duplicate_row");
  });
});

// ---------------------------------------------------------------------------
// F — THE CAPTURED R2.40 LIVE REGRESSION
// ---------------------------------------------------------------------------

describe("[R2.42][F] the captured R2.40 attempt-1 response", () => {
  it("its six absent+sentinel rows still fail under the PRESERVED contract", () => {
    expect(R240_BOUNDARY_REVIEW_SUBJECT_SHA256).toBe("d5dea4be7dd274c7978c0544e8b9acea87990ec76b13432ec245b3bae88a11bb");
    const d = deriveBoundaryVerdict({ assessments: R240_LIVE_ATTEMPT_1 }, ctx);
    expect(d.outcome).toBe("boundary_review_malformed");
    if (d.outcome !== "boundary_review_malformed") throw new Error("unreachable");
    // The absent-parity defect this file owns: every one of the six is still refused.
    expect(d.codes).toContain("boundary_candidate_required_missing");
    for (const ref of R240_FAILED_SURFACE_REFS) expect(d.failedSurfaceRefs).toContain(ref);
    // R2.44 additionally refuses two rows that selected the satisfaction-as-failure span, so the
    // failed set is a strict superset now. Named explicitly rather than folded into the count.
    expect(d.codes).toContain("boundary_candidate_unknown");
    expect(d.failedSurfaceRefs).toContain("branch[0].resulting_world_state");
    expect(d.failedSurfaceRefs).toContain("branch[0].action[0]");
    // primary[0] — the empty-pool surface — passed then and passes now.
    expect(d.validSurfaceRefs).toContain(R240_MEASURED.emptyPoolSurface);
  });

  it("the repair projection generated from that failure carries SIX surfaces, not twelve", () => {
    const d = deriveBoundaryVerdict({ assessments: R240_LIVE_ATTEMPT_1 }, ctx);
    if (d.outcome !== "boundary_review_malformed") throw new Error("unreachable");
    const plan = planSubsetRepair(d);
    expect(plan.repairable).toBe(true);
    if (!plan.repairable) throw new Error("unreachable");
    const repair = buildNarrowBoundaryRequest(subject, plan.failedSurfaceRefs);
    // The projection carries EXACTLY the failed set, whatever its size — the property this file
    // owns. Under R2.44 that set is eight, not the twelve a full re-ask would send.
    expect(repair.requiredAssessmentCount).toBe(plan.failedSurfaceRefs.length);
    expect(repair.surfaces).toHaveLength(plan.failedSurfaceRefs.length);
    expect(repair.surfaces.map((s) => s.surfaceRef)).toEqual(plan.failedSurfaceRefs);
    expect(repair.surfaces.length).toBeLessThan(12);
    for (const ref of R240_FAILED_SURFACE_REFS) expect(repair.surfaces.map((s) => s.surfaceRef)).toContain(ref);
  });

  it("a compliant six-row repair completes the output contract locally", () => {
    const d = deriveBoundaryVerdict({ assessments: R240_LIVE_ATTEMPT_1 }, ctx);
    if (d.outcome !== "boundary_review_malformed") throw new Error("unreachable");
    // Each failed row corrected the one way the contract permits: select from the pools offered.
    // Where R2.44 emptied the failure pool, the honest answer is `not_applicable` with the sentinel.
    const repaired = R240_LIVE_ATTEMPT_1.filter((r) => d.failedSurfaceRefs.includes(r.surfaceRef)).map((r) => ({
      ...r,
      governedActionStatus: "absent" as const,
      prerequisiteStatus: "not_applicable" as const,
      temporalRelation: "not_applicable" as const,
      governedActionCandidateId: first(r.surfaceRef, "governed_action"),
      prerequisiteSatisfactionCandidateId: NO_CANDIDATE,
      prerequisiteFailureCandidateId: NO_CANDIDATE,
    }));
    const rv = validateNarrowBoundaryReview({ assessments: [...d.derived.map(toRow), ...repaired] }, ctx);
    expect(rv.ok).toBe(true);
    if (!rv.ok) throw new Error("unreachable");
    expect(rv.derived).toHaveLength(12);
    // NO product-quality claim: this proves the OUTPUT CONTRACT completes, nothing about semantics.
    expect(R240_MEASURED.primaryOneR240Status).toBe("NOT JUDGED — OUTPUT CONTRACT FAILURE");
  });
});

/** Re-express a server-derived row as the model row it came from, for the local completion proof. */
function toRow(d: { surfaceRef: string; boundaryId: string; facts: { governedActionStatus: string; prerequisiteStatus: string; temporalRelation: string }; governedAction: { candidateId: string } | null; satisfaction: { candidateId: string } | null; failure: { candidateId: string } | null; reason: string }): BoundaryTruthAssessment {
  return {
    boundaryId: d.boundaryId,
    surfaceRef: d.surfaceRef,
    governedActionStatus: d.facts.governedActionStatus as BoundaryTruthAssessment["governedActionStatus"],
    prerequisiteStatus: d.facts.prerequisiteStatus as BoundaryTruthAssessment["prerequisiteStatus"],
    temporalRelation: d.facts.temporalRelation as BoundaryTruthAssessment["temporalRelation"],
    governedActionCandidateId: d.governedAction?.candidateId ?? NO_CANDIDATE,
    prerequisiteSatisfactionCandidateId: d.satisfaction?.candidateId ?? NO_CANDIDATE,
    prerequisiteFailureCandidateId: d.failure?.candidateId ?? NO_CANDIDATE,
    reason: d.reason,
  };
}

// ---------------------------------------------------------------------------
// G — POLARITY NON-EXPANSION
// ---------------------------------------------------------------------------

describe("[R2.42][G] polarity — deferred here, ENFORCED by R2.44", () => {
  it("the collision this slice deliberately left is now refused by the successor authority", () => {
    // R2.42 asserted 15 collisions and that the safe branch KEPT its satisfaction-text-as-failure
    // candidate, because enforcing polarity was out of scope then. R2.44 is that scope. The
    // assertion is inverted rather than deleted, so the transition stays visible in the record.
    const build = buildAllEvidenceCandidates([C18_BOUNDARY], frames, C18_REACHABLE_SURFACES, segments);
    expect(build.polarityMetrics.prerequisiteSatisfactionRefusedFromFailureCount).toBe(5);
    expect(pool("branch[0].resulting_world_state", "prerequisite_failure")).toHaveLength(0);
    // The residue is the `uncertain` class, which R2.44 observes rather than forces.
    expect(build.roleMetrics.prerequisitePolarityCollisionObservedCount).toBe(5);
  });
});
