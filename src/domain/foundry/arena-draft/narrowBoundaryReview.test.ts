/**
 * COVERAGE, CAUSAL DERIVATION AND RERUN AUTHORITY UNDER THE R2.38 CONTRACT.
 *
 * The candidate authority and the truth-state table are proved in `boundaryCandidateAuthority`; the
 * captured live responses in `r236TruthRegression`. This file keeps the properties that survive
 * every contract revision: exact Cartesian coverage, earliest-causal derivation, and the call caps.
 */
import { describe, expect, it } from "vitest";
import {
  MAX_BOUNDARY_REVIEW_CALLS_PER_SUBJECT,
  MAX_NARROW_ASSESSMENTS,
  NARROW_BOUNDARY_JSON_SCHEMA,
  NARROW_REASON_MAX,
  allowsBroadReview,
  boundaryReviewCountsAsGenerationRetry,
  classifyFailure,
  decideAfterBoundaryReview,
  deriveBoundaryVerdict,
  isLocallyRepairable,
  producesCorrectionPacket,
  validateNarrowBoundaryReview,
  type BoundaryTruthAssessment,
  type DerivedBoundaryVerdict,
  type NarrowReviewContext,
} from "./narrowBoundaryReview";
import { MAX_ACTIVE_BOUNDARIES } from "./boundaryScope";
import { BRANCH_AWARE_REACHABLE_SURFACE_COUNT, enumerateBoundarySurfaces, reviewableSurfaces } from "./boundarySurfaces";
import { buildContextSegments } from "./boundaryContextSegments";
import { buildSemanticFrames } from "./boundarySemanticFrame";
import { buildAllEvidenceCandidates, poolFor } from "./boundaryEvidenceCandidates";
import { NO_CANDIDATE } from "./boundaryTruthContractTypes";
import { draftFixture } from "./boundarySurfaces.test";
import { GROUNDED_PRIMARY_TEXT, groundedPrimaryDraft } from "./primaryGroundedFixture";

const BOUNDARY = { id: "c1_verify", statement: "Two identifiers must be verified before treatment" };
const draft = draftFixture();
const surfaces = reviewableSurfaces(enumerateBoundarySurfaces(draft));
const segments = buildContextSegments(draft, surfaces);
const frames = buildSemanticFrames([BOUNDARY]);
const { candidates } = buildAllEvidenceCandidates([BOUNDARY], frames, surfaces, segments);
const ctx: NarrowReviewContext = { boundaries: [BOUNDARY], surfaces, frames, candidates };

const first = (ref: string, role: "governed_action" | "prerequisite_satisfaction" | "prerequisite_failure") =>
  poolFor(candidates, BOUNDARY.id, ref, role)[0]?.candidateId ?? NO_CANDIDATE;
const match = (ref: string, role: "prerequisite_failure" | "prerequisite_satisfaction", re: RegExp) =>
  poolFor(candidates, BOUNDARY.id, ref, role).find((c) => re.test(c.excerpt))?.candidateId ?? NO_CANDIDATE;

const baseline = (): BoundaryTruthAssessment[] =>
  surfaces.map((s) => ({
    boundaryId: BOUNDARY.id,
    surfaceRef: s.coordinate,
    governedActionStatus: "absent",
    prerequisiteStatus: "not_applicable",
    temporalRelation: "not_applicable",
    governedActionCandidateId: first(s.coordinate, "governed_action"),
    prerequisiteSatisfactionCandidateId: NO_CANDIDATE,
    prerequisiteFailureCandidateId: NO_CANDIDATE,
    reason: "",
  }));

const withRow = (ref: string, over: Partial<BoundaryTruthAssessment>) => baseline().map((a) => (a.surfaceRef === ref ? { ...a, ...over } : a));

const violationAt = (ref: string) =>
  withRow(ref, {
    governedActionStatus: "present",
    prerequisiteStatus: "explicitly_missing",
    temporalRelation: "action_before_prerequisite",
    governedActionCandidateId: first(ref, "governed_action"),
    prerequisiteFailureCandidateId: match(ref, "prerequisite_failure", /unverified/i),
  });

describe("the strict schema asks for facts and ids only", () => {
  it("has exactly nine properties, three of them candidate ids", () => {
    const item = NARROW_BOUNDARY_JSON_SCHEMA.properties.assessments.items;
    expect(Object.keys(item.properties)).toEqual([
      "boundaryId",
      "surfaceRef",
      "governedActionStatus",
      "prerequisiteStatus",
      "temporalRelation",
      "governedActionCandidateId",
      "prerequisiteSatisfactionCandidateId",
      "prerequisiteFailureCandidateId",
      "reason",
    ]);
    expect([...item.required]).toEqual(Object.keys(item.properties));
    expect(item.properties.reason.maxLength).toBe(NARROW_REASON_MAX);
    expect(MAX_NARROW_ASSESSMENTS).toBe(MAX_ACTIVE_BOUNDARIES * BRANCH_AWARE_REACHABLE_SURFACE_COUNT);
  });
});

describe("coverage over REACHABLE surfaces only", () => {
  it("accepts exactly one assessment per (boundary, reachable surface) pair", () => {
    expect(validateNarrowBoundaryReview({ assessments: baseline() }, ctx).ok).toBe(true);
    expect(baseline()).toHaveLength(12);
  });

  it("refuses an answer about a COMPATIBILITY projection", () => {
    const all = enumerateBoundarySurfaces(draftFixture());
    const flat = all.find((s) => s.coordinate === "flat_action[1]")!;
    const r = validateNarrowBoundaryReview(
      { assessments: [...baseline(), { ...baseline()[0]!, surfaceRef: flat.coordinate }] },
      { ...ctx, surfaces: [...surfaces, flat] },
    );
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.codes).toContain("boundary_review_unreviewable_surface");
  });

  it("rejects missing, duplicate and unknown pairs", () => {
    expect(validateNarrowBoundaryReview({ assessments: baseline().slice(1) }, ctx)).toMatchObject({ ok: false });
    const dup = validateNarrowBoundaryReview({ assessments: [...baseline(), baseline()[0]!] }, ctx);
    expect(dup.ok === false && dup.codes).toContain("boundary_review_duplicate_pair");
    const unknown = validateNarrowBoundaryReview({ assessments: [...baseline(), { ...baseline()[0]!, surfaceRef: "primary[9]" }] }, ctx);
    expect(unknown.ok === false && unknown.codes).toContain("boundary_review_unknown_surface");
  });

  it("classifies its failure families, and only output-contract failures are locally repairable", () => {
    expect(classifyFailure(["boundary_review_missing_pair"])).toBe("coverage");
    expect(classifyFailure(["boundary_candidate_unknown"])).toBe("output_contract");
    expect(classifyFailure(["boundary_review_transport_failed"])).toBe("transport");
    expect(isLocallyRepairable("output_contract")).toBe(true);
    expect(isLocallyRepairable("coverage")).toBe(false);
    expect(isLocallyRepairable("transport")).toBe(false);
  });
});

describe("server-derived verdict", () => {
  it("all settled → pass", () => {
    const v = deriveBoundaryVerdict({ assessments: baseline() }, ctx);
    expect(v.outcome).toBe("boundary_review_pass");
    if (v.outcome !== "boundary_review_pass") throw new Error("unreachable");
    expect(v.notApplicableCount).toBe(12);
  });

  it("one grounded violation → reject, and it produces the correction packet", () => {
    const v = deriveBoundaryVerdict({ assessments: violationAt("branch[1].action[1]") }, ctx);
    expect(v.outcome).toBe("boundary_review_reject");
    expect(producesCorrectionPacket(v)).toBe(true);
  });

  it("a violation OUTRANKS an uncertainty elsewhere", () => {
    const mixed = violationAt("branch[1].action[1]").map((a) =>
      a.surfaceRef === "branch[0].tradeoff[1]"
        ? { ...a, governedActionStatus: "uncertain" as const, prerequisiteStatus: "uncertain" as const, reason: "the label does not say whether care means treatment" }
        : a,
    );
    expect(deriveBoundaryVerdict({ assessments: mixed }, ctx).outcome).toBe("boundary_review_reject");
  });

  it("only pass and not_applicable let the broad reviewer run", () => {
    expect(allowsBroadReview("boundary_review_pass")).toBe(true);
    expect(allowsBroadReview("boundary_review_not_applicable")).toBe(true);
    expect(allowsBroadReview("boundary_review_reject")).toBe(false);
    expect(allowsBroadReview("boundary_review_inconclusive")).toBe(false);
  });
});

describe("earliest causal violation and descendant deduplication", () => {
  // A violation AT A PRIMARY needs that primary's own text to name an unmet prerequisite — see
  // `primaryGroundedFixture` for why the stock fixture cannot, and why that gap is carried forward.
  const gDraft = groundedPrimaryDraft(draftFixture());
  const gSurfaces = reviewableSurfaces(enumerateBoundarySurfaces(gDraft));
  const gSegments = buildContextSegments(gDraft, gSurfaces);
  const gCandidates = buildAllEvidenceCandidates([BOUNDARY], frames, gSurfaces, gSegments).candidates;
  const gCtx: NarrowReviewContext = { boundaries: [BOUNDARY], surfaces: gSurfaces, frames, candidates: gCandidates };
  const gFirst = (ref: string, role: "governed_action" | "prerequisite_failure") => poolFor(gCandidates, BOUNDARY.id, ref, role)[0]?.candidateId ?? NO_CANDIDATE;
  const gMatch = (ref: string, re: RegExp) => poolFor(gCandidates, BOUNDARY.id, ref, "prerequisite_failure").find((c) => re.test(c.excerpt))?.candidateId ?? NO_CANDIDATE;

  const gBaseline = (): BoundaryTruthAssessment[] =>
    gSurfaces.map((s) => ({
      boundaryId: BOUNDARY.id,
      surfaceRef: s.coordinate,
      governedActionStatus: "absent",
      prerequisiteStatus: "not_applicable",
      temporalRelation: "not_applicable",
      governedActionCandidateId: gFirst(s.coordinate, "governed_action"),
      prerequisiteSatisfactionCandidateId: NO_CANDIDATE,
      prerequisiteFailureCandidateId: NO_CANDIDATE,
      reason: "",
    }));

  const chain = () =>
    gBaseline().map((a) => {
      const violating = ["primary[1]", "branch[1].resulting_world_state", "branch[1].action[1]"].includes(a.surfaceRef);
      if (!violating) return a;
      return {
        ...a,
        governedActionStatus: "present" as const,
        prerequisiteStatus: "explicitly_missing" as const,
        temporalRelation: "action_before_prerequisite" as const,
        governedActionCandidateId: gFirst(a.surfaceRef, "governed_action"),
        prerequisiteFailureCandidateId: gMatch(a.surfaceRef, /unverified/i),
      };
    });

  it("the grounded primary fixture states the unmet prerequisite in its OWN text", () => {
    expect(gSurfaces.find((s) => s.coordinate === "primary[1]")!.text).toBe(GROUNDED_PRIMARY_TEXT);
    expect(gMatch("primary[1]", /unverified/i)).not.toBe(NO_CANDIDATE);
  });

  it("marks the root violation earliestCausal and keeps violations in surface order", () => {
    const v = deriveBoundaryVerdict({ assessments: chain() }, gCtx);
    if (v.outcome !== "boundary_review_reject") throw new Error("unreachable");
    expect(v.violations[0]!.surfaceRef).toBe("primary[1]");
    expect(v.violations[0]!.earliestCausal).toBe(true);
    expect(v.violations[0]!.lineage).toEqual([]);
  });

  it("a descendant that newly authorizes a different governed action is retained", () => {
    const v = deriveBoundaryVerdict({ assessments: chain() }, gCtx);
    if (v.outcome !== "boundary_review_reject") throw new Error("unreachable");
    expect(v.causalViolations.map((x) => x.surfaceRef)).toContain("branch[1].action[1]");
  });
});

/**
 * R2.38-CLOSURE-R1 — CORRECTION PRECISION, restored.
 *
 * R2.29's live run produced nine defects where four described the whole problem. R2.30 fixed that by
 * separating CAUSAL violations, which become correction instructions, from DOWNSTREAM ones, which
 * are evidence that the same failure persists. The assertion was lost when the R2.36 test files were
 * replaced; the production rule was never touched.
 *
 * Under R2.38 the mechanism is DERIVED, so the shape that exercises this is precise: a descendant
 * shares its ancestor's mechanism only when both derive the same one, and it is treated as
 * downstream only when the learner cannot select it independently — which is exactly a generated
 * resulting world state.
 */
describe("[R1] downstream causal deduplication", () => {
  // A violation AT A PRIMARY needs that primary's own text to name the unmet prerequisite, so this
  // block uses the grounded fixture — the stock one correctly offers no failure candidate there.
  const gDraft = groundedPrimaryDraft(draftFixture());
  const gSurfaces = reviewableSurfaces(enumerateBoundarySurfaces(gDraft));
  const gCandidates = buildAllEvidenceCandidates([BOUNDARY], frames, gSurfaces, buildContextSegments(gDraft, gSurfaces)).candidates;
  const gCtx: NarrowReviewContext = { boundaries: [BOUNDARY], surfaces: gSurfaces, frames, candidates: gCandidates };
  const gId = (ref: string, role: "governed_action" | "prerequisite_failure") =>
    poolFor(gCandidates, BOUNDARY.id, ref, role)[0]?.candidateId ?? NO_CANDIDATE;

  const gBaseline = (): BoundaryTruthAssessment[] =>
    gSurfaces.map((s) => ({
      boundaryId: BOUNDARY.id,
      surfaceRef: s.coordinate,
      governedActionStatus: "absent",
      prerequisiteStatus: "not_applicable",
      temporalRelation: "not_applicable",
      governedActionCandidateId: gId(s.coordinate, "governed_action"),
      prerequisiteSatisfactionCandidateId: NO_CANDIDATE,
      prerequisiteFailureCandidateId: NO_CANDIDATE,
      reason: "",
    }));

  const contradicted = (ref: string): Partial<BoundaryTruthAssessment> => ({
    governedActionStatus: "present",
    prerequisiteStatus: "contradicted",
    temporalRelation: "action_before_prerequisite",
    governedActionCandidateId: gId(ref, "governed_action"),
    prerequisiteFailureCandidateId: gId(ref, "prerequisite_failure"),
  });
  const chain = (descendant: string) =>
    gBaseline()
      .map((a) => (a.surfaceRef === "primary[1]" ? { ...a, ...contradicted("primary[1]") } : a))
      .map((a) => (a.surfaceRef === descendant ? { ...a, ...contradicted(descendant) } : a));

  it("[R1d] a descendant repeating its ancestor's mechanism is DOWNSTREAM, not a second root", () => {
    const v = deriveBoundaryVerdict({ assessments: chain("branch[1].resulting_world_state") }, gCtx);
    expect(v.outcome).toBe("boundary_review_reject");
    if (v.outcome !== "boundary_review_reject") throw new Error("unreachable");

    const descendant = v.violations.find((x) => x.surfaceRef === "branch[1].resulting_world_state")!;
    const ancestor = v.violations.find((x) => x.surfaceRef === "primary[1]")!;
    // Both derive the same mechanism, and the descendant cannot be selected on its own.
    expect(descendant.violationMechanism).toBe(ancestor.violationMechanism);
    expect(descendant.downstreamOfPriorViolation).toBe(true);
    expect(descendant.earliestCausal).toBe(false);
    expect(descendant.lineage).toContain("primary[1]");

    // It remains fully inspectable as evidence…
    expect(v.downstreamViolations.map((x) => x.surfaceRef)).toEqual(["branch[1].resulting_world_state"]);
    // …and is excluded from the set the correction packet is built from, so a Manager is told to
    // fix the root once rather than the same failure twice. `boundaryReviewStage` builds `findings`
    // from `causalViolations` alone; `c18NarrowBoundary` asserts that packet end to end.
    expect(v.causalViolations.map((x) => x.surfaceRef)).toEqual(["primary[1]"]);
    expect(v.causalViolations.map((x) => x.surfaceRef)).not.toContain("branch[1].resulting_world_state");
    expect(ancestor.earliestCausal).toBe(true);
    expect(producesCorrectionPacket(v)).toBe(true);
  });

  it("[R1e] a descendant the learner can select INDEPENDENTLY stays causal, not deduplicated", () => {
    // Being later in the branch is never on its own a reason to suppress a finding: this surface
    // newly authorizes the governed action, so it is a root the learner can reach by itself.
    const v = deriveBoundaryVerdict({ assessments: chain("branch[1].action[1]") }, gCtx);
    if (v.outcome !== "boundary_review_reject") throw new Error("unreachable");
    const descendant = v.violations.find((x) => x.surfaceRef === "branch[1].action[1]")!;
    expect(descendant.downstreamOfPriorViolation).toBe(false);
    expect(descendant.earliestCausal).toBe(false); // it HAS a violating ancestor…
    expect(v.causalViolations.map((x) => x.surfaceRef)).toContain("branch[1].action[1]"); // …and is still its own root
    expect(v.downstreamViolations).toHaveLength(0);
  });
});

describe("rerun authority", () => {
  const malformed = (codes: DerivedBoundaryVerdict extends never ? never : string[], failed: string[]): DerivedBoundaryVerdict => ({
    outcome: "boundary_review_malformed",
    codes: codes as never,
    findings: [],
    failureClass: failed.length ? "output_contract" : "coverage",
    validSurfaceRefs: [],
    failedSurfaceRefs: failed,
    derived: [],
  });

  it("an output-contract failure repairs the FAILED SUBSET, not the whole matrix", () => {
    const d = decideAfterBoundaryReview(1, { kind: "derived", verdict: malformed(["boundary_candidate_unknown"], ["primary[0]"]) });
    expect(d.action).toBe("repair_failed_subset");
    if (d.action !== "repair_failed_subset") throw new Error("unreachable");
    expect(d.surfaceRefs).toEqual(["primary[0]"]);
  });

  it("a coverage failure reruns the whole review, and the second failure terminates", () => {
    expect(decideAfterBoundaryReview(1, { kind: "derived", verdict: malformed(["boundary_review_missing_pair"], []) }).action).toBe("rerun_boundary_review");
    expect(decideAfterBoundaryReview(2, { kind: "derived", verdict: malformed(["boundary_review_missing_pair"], []) }).action).toBe("boundary_reviewer_terminal_failure");
    expect(MAX_BOUNDARY_REVIEW_CALLS_PER_SUBJECT).toBe(2);
    expect(decideAfterBoundaryReview(3, { kind: "derived", verdict: malformed([], []) })).toMatchObject({ code: "boundary_review_attempt_budget_violated" });
  });

  it("a transport failure is never a reviewer failure and never spends rerun budget", () => {
    expect(decideAfterBoundaryReview(1, { kind: "transport_failed" })).toMatchObject({ action: "boundary_reviewer_infrastructure_failure" });
  });

  it("only the correction path counts as a generation retry", () => {
    expect(boundaryReviewCountsAsGenerationRetry({ action: "correction_path" })).toBe(true);
    expect(boundaryReviewCountsAsGenerationRetry({ action: "repair_failed_subset", surfaceRefs: [], because: "" })).toBe(false);
    expect(boundaryReviewCountsAsGenerationRetry({ action: "continue" })).toBe(false);
  });
});
