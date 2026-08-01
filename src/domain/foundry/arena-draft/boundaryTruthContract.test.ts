/**
 * THE TRUTH CONTRACT — CONTEXT SEGMENTS, RULE DECOMPOSITION, REQUEST PROJECTION, 32-CASE GATE PROOF
 * (Slice 3.2I-R5B1A.1-R2.36 Parts 2, 3, 4, 15).
 *
 * R2.35 traced two live failures to one cause: the reviewer received context as an unlabelled blob
 * and the boundary as one opaque sentence. Nothing could say where an excerpt came from, and nothing
 * could say what the rule required. These tests pin both halves of the fix, and then walk the whole
 * gate matrix case by case so that a future change cannot quietly weaken one gate while the headline
 * regression still passes.
 */
import { describe, expect, it } from "vitest";
import {
  CONTEXT_SEGMENT_VERSION,
  OPENING_SEGMENT_REF,
  SEGMENT_KINDS,
  buildContextSegments,
  contextSegmentMapSha256,
  segmentsForSurface,
  validateContextSegments,
} from "./boundaryContextSegments";
import {
  RULE_KINDS,
  buildSemanticFrame,
  buildSemanticFrames,
  semanticFrameContractSha256,
  validateSemanticFrames,
} from "./boundarySemanticFrame";
import {
  clauseStems,
  deriveBoundaryVerdict,
  excerptConcernsPrerequisite,
  validateNarrowBoundaryReview,
  type NarrowBoundaryAssessment,
  type NarrowBoundaryCode,
  type NarrowReviewContext,
} from "./narrowBoundaryReview";
import { buildNarrowBoundaryRequest, buildNarrowBoundarySubject } from "@/lib/bty/foundry/arena/narrowBoundaryContract";
import { C18_BOUNDARY, C18_REACHABLE_SURFACES, C18_SCENARIO, C18_SCENARIO_SHA256, C18_SURFACES } from "./c18BoundaryFixture";

const segments = buildContextSegments(C18_SCENARIO, C18_REACHABLE_SURFACES);
const frames = buildSemanticFrames([C18_BOUNDARY]);
const ctx: NarrowReviewContext = { boundaries: [C18_BOUNDARY], surfaces: C18_REACHABLE_SURFACES, segments, frames };

const seg = (ref: string, kind: string) => segments.find((x) => x.sourceSurfaceRef === ref && x.segmentKind === kind);
const ownRef = (ref: string) => seg(ref, "own_surface")!.segmentRef;
const parRef = (ref: string) => seg(ref, "parent_generated_state")?.segmentRef ?? "";
const parText = (ref: string) => seg(ref, "parent_generated_state")?.text ?? "";
const at = (ref: string) => C18_REACHABLE_SURFACES.find((s) => s.coordinate === ref)!;

const PREREQ_FAILURE = "this left the second patient unverified";
/** `branch[1].action[1]` — treating while its parent state says the patient is unverified. */
const GROUNDED = "branch[1].action[1]";

const settled = (): NarrowBoundaryAssessment[] =>
  C18_REACHABLE_SURFACES.map((s) => ({
    boundaryId: C18_BOUNDARY.id,
    surfaceRef: s.coordinate,
    applicability: "not_applicable",
    governedActionStatus: "absent",
    prerequisiteStatus: "not_applicable",
    temporalRelation: "not_applicable",
    compliance: "not_assessed",
    violationMechanism: "none",
    actionEvidence: { segmentRef: ownRef(s.coordinate), excerpt: s.text.slice(0, 90) },
    prerequisiteEvidence: { segmentRef: "", excerpt: "" },
    reason: "",
  }));

const withRow = (ref: string, over: Partial<NarrowBoundaryAssessment>): NarrowBoundaryAssessment[] =>
  settled().map((a) => (a.surfaceRef === ref ? { ...a, ...over } : a));

/** A violation that satisfies every gate — the baseline the negative cases deviate from. */
const groundedViolation = (over: Partial<NarrowBoundaryAssessment> = {}) =>
  withRow(GROUNDED, {
    applicability: "applies",
    governedActionStatus: "present",
    prerequisiteStatus: "explicitly_missing",
    temporalRelation: "action_before_prerequisite",
    compliance: "violates",
    violationMechanism: "governed_action_without_prerequisite",
    actionEvidence: { segmentRef: ownRef(GROUNDED), excerpt: at(GROUNDED).text },
    prerequisiteEvidence: { segmentRef: parRef(GROUNDED), excerpt: PREREQ_FAILURE },
    ...over,
  });

// ---------------------------------------------------------------------------
// Parts 2 & 3 — the server owns the context, and it is LABELLED
// ---------------------------------------------------------------------------

describe("[2][3] server-owned context segments", () => {
  it("cuts every reachable surface into its own segment, and the opening into exactly one", () => {
    const opening = segments.filter((s) => s.segmentKind === "scenario_opening");
    expect(opening).toHaveLength(1);
    expect(opening[0]!.segmentRef).toBe(OPENING_SEGMENT_REF);
    expect(opening[0]!.text).toBe(C18_SCENARIO.opening);
    for (const s of C18_REACHABLE_SURFACES) {
      expect(segments.some((x) => x.segmentKind === "own_surface" && x.sourceSurfaceRef === s.coordinate)).toBe(true);
    }
    expect(validateContextSegments(segments, C18_REACHABLE_SURFACES)).toEqual({ ok: true, codes: [] });
  });

  it("[3] a surface sees its own segments and the scenario-wide ones — never another surface's", () => {
    const visible = segmentsForSurface(segments, GROUNDED);
    expect(visible.map((x) => x.segmentKind)).toContain("scenario_opening");
    expect(visible.every((x) => x.sourceSurfaceRef === "" || x.sourceSurfaceRef === GROUNDED)).toBe(true);
    expect(visible.some((x) => x.sourceSurfaceRef === "branch[0].action[0]")).toBe(false);
  });

  it("[2] a MISSING OPENING fails closed — the exact R2.35 shape", () => {
    // `primary[1]` was judged as a bare label because no premise was ever sent.
    const noOpening = { ...C18_SCENARIO, opening: "" };
    const s = buildContextSegments(noOpening, C18_REACHABLE_SURFACES);
    expect(validateContextSegments(s, C18_REACHABLE_SURFACES)).toMatchObject({ ok: false });
    expect(validateContextSegments(s, C18_REACHABLE_SURFACES).codes).toContain("context_opening_missing");
  });

  it("segment refs are unique, and the map digest moves when any text moves", () => {
    expect(new Set(segments.map((x) => x.segmentRef)).size).toBe(segments.length);
    const before = contextSegmentMapSha256(segments);
    const moved = buildContextSegments({ ...C18_SCENARIO, opening: `${C18_SCENARIO.opening} (edited)` }, C18_REACHABLE_SURFACES);
    expect(contextSegmentMapSha256(moved)).not.toBe(before);
    expect(CONTEXT_SEGMENT_VERSION).toBe("practice-boundary-context-segments/1");
    expect(SEGMENT_KINDS).toContain("parent_generated_state");
  });
});

// ---------------------------------------------------------------------------
// Part 4 — the rule is DECOMPOSED, and an undecomposable rule fails closed
// ---------------------------------------------------------------------------

describe("[4] boundary semantic frame", () => {
  it("separates the prerequisite from the governed action and the ordering", () => {
    const f = buildSemanticFrame(C18_BOUNDARY);
    expect(f.ruleKind).toBe("prerequisite_before_action");
    expect(f.prerequisiteClause).toBe("Two identifiers must be verified");
    expect(f.governedActionClause).toBe("treatment");
    expect(f.temporalRequirement).toBe("prerequisite_before_action");
  });

  it("a prohibition is NOT read as a prerequisite rule — that would invert its meaning", () => {
    const f = buildSemanticFrame({ id: "p", statement: "Never treat before verifying two identifiers" });
    expect(f.ruleKind).toBe("prohibition");
    expect(f.prerequisiteClause).toBe("");
  });

  it("a bare condition is a state requirement, not an ordering", () => {
    expect(buildSemanticFrame({ id: "s", statement: "Consent must be recorded" }).ruleKind).toBe("state_requirement");
  });

  it("[4] an UNDECOMPOSABLE rule blocks semantic acceptance rather than being guessed at", () => {
    const f = buildSemanticFrame({ id: "u", statement: "Be careful with the new intake process" });
    expect(f.ruleKind).toBe("uncertain");
    const check = validateSemanticFrames([f]);
    expect(check.ok).toBe(false);
    expect(check.codes).toContain("boundary_semantic_frame_uncertain");
    expect(check.uncertainBoundaryIds).toEqual(["u"]);
    expect(RULE_KINDS).toContain("uncertain");
    expect(semanticFrameContractSha256()).toMatch(/^[0-9a-f]{64}$/);
  });

  it("the prerequisite gate follows the CLAUSE, so a negated form still matches", () => {
    const f = buildSemanticFrame(C18_BOUNDARY);
    expect(clauseStems(f.prerequisiteClause)).toEqual(["identifier", "verif"]);
    for (const t of ["remains unverified", "verification was skipped", "identifiers were never checked"]) {
      expect(excerptConcernsPrerequisite(t, f), t).toBe(true);
    }
    for (const t of ["delays in the ward", "the ward is short-staffed", "the administrator is unhappy"]) {
      expect(excerptConcernsPrerequisite(t, f), t).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// Parts 2 & 3 — the projection actually SENDS all of it
// ---------------------------------------------------------------------------

describe("[2][3] the request projection carries the premise and the labelled context", () => {
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
  const request = buildNarrowBoundaryRequest(subject);

  it("[2] the SCENARIO OPENING is present — the field R2.35 measured missing", () => {
    expect(request.opening).toBe(C18_SCENARIO.opening);
    expect(request.opening.length).toBeGreaterThan(0);
    expect(request.openingSegmentRef).toBe(OPENING_SEGMENT_REF);
    // …and it is reachable as a segment, so the model can cite it as CONTEXT.
    expect(request.contextSegments.some((s) => s.segmentRef === OPENING_SEGMENT_REF && s.text === C18_SCENARIO.opening)).toBe(true);
    expect(JSON.stringify(request)).toContain('"opening"');
  });

  it("[3] every surface is told exactly which segments it may cite", () => {
    for (const s of request.surfaces) {
      expect(s.citableSegmentRefs).toContain(OPENING_SEGMENT_REF);
      expect(s.citableSegmentRefs).toContain(ownRef(s.surfaceRef));
      // No surface is offered another surface's own text.
      const foreign = C18_REACHABLE_SURFACES.filter((o) => o.coordinate !== s.surfaceRef).map((o) => ownRef(o.coordinate));
      for (const f of foreign) expect(s.citableSegmentRefs).not.toContain(f);
    }
  });

  it("[4] the boundary arrives decomposed, and the authority block binds both new digests", () => {
    expect(request.constraints[0]).toMatchObject({
      id: C18_BOUNDARY.id,
      statement: C18_BOUNDARY.statement,
      ruleKind: "prerequisite_before_action",
      prerequisite: "Two identifiers must be verified",
    });
    expect(request.authority.contextSegmentMapSha256).toBe(subject.contextSegmentMapSha256);
    expect(request.authority.semanticFramesSha256).toBe(subject.semanticFramesSha256);
  });

  it("a subject with no opening records a NAMED defect instead of asking a thinner question", () => {
    const bad = buildNarrowBoundarySubject({
      scenarioSha256: C18_SCENARIO_SHA256,
      reviewSubjectSha256: "r".repeat(64),
      boundaryProvenance: { activeBoundaryIds: [C18_BOUNDARY.id] } as never,
      boundaryProvenanceSha256: "p".repeat(64),
      boundaries: [C18_BOUNDARY],
      surfaces: C18_SURFACES,
      draft: { ...C18_SCENARIO, opening: "" },
      language: "en",
      generationAttemptId: "gen1",
      caseId: "c18-constrained-clinical",
    });
    expect(bad.subjectDefects).toContain("context_opening_missing");
  });
});

// ---------------------------------------------------------------------------
// Part 15 — the 32-case gate matrix
// ---------------------------------------------------------------------------

/** How a case must be refused: as a malformed RESPONSE, as a refuted CLAIM, or accepted. */
type Expectation =
  | { kind: "malformed"; code: NarrowBoundaryCode }
  | { kind: "refuted"; code: NarrowBoundaryCode }
  | { kind: "accepted"; outcome: "boundary_review_pass" | "boundary_review_reject" | "boundary_review_inconclusive" };

const CASES: Array<{ n: number; name: string; rows: () => unknown; expect: Expectation }> = [
  // --- coverage (4) --------------------------------------------------------
  { n: 1, name: "a dropped pair", rows: () => ({ assessments: settled().slice(1) }), expect: { kind: "malformed", code: "boundary_review_missing_pair" } },
  { n: 2, name: "a duplicated pair", rows: () => ({ assessments: [...settled(), settled()[0]!] }), expect: { kind: "malformed", code: "boundary_review_duplicate_pair" } },
  { n: 3, name: "an unknown surface", rows: () => ({ assessments: [...settled(), { ...settled()[0]!, surfaceRef: "primary[9]" }] }), expect: { kind: "malformed", code: "boundary_review_unknown_surface" } },
  { n: 4, name: "an unknown boundary", rows: () => ({ assessments: [...settled(), { ...settled()[0]!, boundaryId: "nope" }] }), expect: { kind: "malformed", code: "boundary_review_unknown_boundary" } },

  // --- shape and state (4) -------------------------------------------------
  { n: 5, name: "not an object", rows: () => "nope", expect: { kind: "malformed", code: "boundary_review_not_an_object" } },
  { n: 6, name: "no assessments array", rows: () => ({}), expect: { kind: "malformed", code: "boundary_review_assessments_missing" } },
  { n: 7, name: "an enum value outside the contract", rows: () => ({ assessments: withRow(GROUNDED, { prerequisiteStatus: "probably" as never }) }), expect: { kind: "malformed", code: "boundary_review_invalid_result" } },
  { n: 8, name: "an applicability/compliance pair outside the table", rows: () => ({ assessments: withRow("primary[0]", { applicability: "not_applicable", compliance: "complies" }) }), expect: { kind: "malformed", code: "boundary_assessment_state_invalid" } },

  // --- evidence locality (6) ----------------------------------------------
  { n: 9, name: "a segment ref nobody assigned", rows: () => ({ assessments: withRow("primary[0]", { actionEvidence: { segmentRef: "99:own", excerpt: at("primary[0]").text } }) }), expect: { kind: "malformed", code: "boundary_evidence_unknown_segment" } },
  { n: 10, name: "ANOTHER SURFACE'S segment", rows: () => ({ assessments: withRow("primary[0]", { actionEvidence: { segmentRef: ownRef(GROUNDED), excerpt: at(GROUNDED).text } }) }), expect: { kind: "malformed", code: "boundary_evidence_segment_not_visible" } },
  { n: 11, name: "the scenario OPENING offered as own conduct", rows: () => ({ assessments: withRow("primary[0]", { actionEvidence: { segmentRef: OPENING_SEGMENT_REF, excerpt: C18_SCENARIO.opening.slice(0, 60) } }) }), expect: { kind: "malformed", code: "boundary_evidence_wrong_segment_kind" } },
  { n: 12, name: "the INHERITED STATE offered as own conduct", rows: () => ({ assessments: withRow(GROUNDED, { actionEvidence: { segmentRef: parRef(GROUNDED), excerpt: parText(GROUNDED).slice(0, 60) } }) }), expect: { kind: "malformed", code: "boundary_evidence_wrong_segment_kind" } },
  { n: 13, name: "an excerpt absent from the segment it names", rows: () => ({ assessments: withRow("primary[0]", { actionEvidence: { segmentRef: ownRef("primary[0]"), excerpt: "text nobody ever wrote here" } }) }), expect: { kind: "malformed", code: "boundary_evidence_excerpt_not_in_segment" } },
  { n: 14, name: "the boundary statement quoted back as conduct", rows: () => ({ assessments: withRow("primary[0]", { actionEvidence: { segmentRef: ownRef("primary[0]"), excerpt: C18_BOUNDARY.statement } }) }), expect: { kind: "malformed", code: "boundary_evidence_restates_boundary" } },

  // --- evidence quality (3) ------------------------------------------------
  { n: 15, name: "no evidence at all on a settled row", rows: () => ({ assessments: withRow("primary[0]", { actionEvidence: { segmentRef: "", excerpt: "" } }) }), expect: { kind: "malformed", code: "boundary_evidence_missing" } },
  { n: 16, name: "the absence-of-mention phrase as evidence", rows: () => ({ assessments: withRow("primary[0]", { actionEvidence: { segmentRef: ownRef("primary[0]"), excerpt: "does not address verification of identifiers" } }) }), expect: { kind: "malformed", code: "boundary_evidence_generic" } },
  { n: 17, name: "an excerpt too short to mean anything", rows: () => ({ assessments: withRow("primary[0]", { actionEvidence: { segmentRef: ownRef("primary[0]"), excerpt: at("primary[0]").text.slice(0, 5) } }) }), expect: { kind: "malformed", code: "boundary_evidence_too_short" } },

  // --- prerequisite truth (6) ---------------------------------------------
  { n: 18, name: "SATISFIED and violating — the R2.34 safe-branch shape", rows: () => ({ assessments: groundedViolation({ prerequisiteStatus: "satisfied" }) }), expect: { kind: "refuted", code: "boundary_prerequisite_contradiction" } },
  { n: 19, name: "NOT_ESTABLISHED and violating — silence is not failure", rows: () => ({ assessments: groundedViolation({ prerequisiteStatus: "not_established" }) }), expect: { kind: "refuted", code: "boundary_prerequisite_contradiction" } },
  { n: 20, name: "a DELAY offered as a verification failure", rows: () => ({ assessments: groundedViolation({ prerequisiteEvidence: { segmentRef: ownRef(GROUNDED), excerpt: at(GROUNDED).text } }) }), expect: { kind: "refuted", code: "boundary_prerequisite_failure_ungrounded" } },
  { n: 21, name: "a violation with no prerequisite evidence", rows: () => ({ assessments: groundedViolation({ prerequisiteEvidence: { segmentRef: "", excerpt: "" } }) }), expect: { kind: "refuted", code: "boundary_violation_prerequisite_evidence_missing" } },
  { n: 22, name: "a violation with no mechanism named", rows: () => ({ assessments: groundedViolation({ violationMechanism: "none" }) }), expect: { kind: "malformed", code: "boundary_assessment_state_invalid" } },
  { n: 23, name: "a violation whose governed action is ABSENT", rows: () => ({ assessments: groundedViolation({ governedActionStatus: "absent" }) }), expect: { kind: "refuted", code: "boundary_governed_action_absent_for_applies" } },

  // --- temporal (2) --------------------------------------------------------
  { n: 24, name: "an action that came AFTER the prerequisite, called a violation", rows: () => ({ assessments: groundedViolation({ temporalRelation: "prerequisite_before_action" }) }), expect: { kind: "refuted", code: "boundary_temporal_relation_unresolved" } },
  { n: 25, name: "a violation committed simultaneously — accepted", rows: () => ({ assessments: groundedViolation({ temporalRelation: "simultaneous_or_unclear" }) }), expect: { kind: "accepted", outcome: "boundary_review_reject" } },

  // --- inheritance locality (2) -------------------------------------------
  { n: 26, name: "inherited state cited behind NO own governed action", rows: () => ({ assessments: withRow("branch[1].action[0]", { applicability: "applies", governedActionStatus: "uncertain", prerequisiteStatus: "explicitly_missing", temporalRelation: "action_before_prerequisite", compliance: "uncertain", prerequisiteEvidence: { segmentRef: parRef("branch[1].action[0]"), excerpt: PREREQ_FAILURE } }) }), expect: { kind: "malformed", code: "boundary_inherited_state_without_own_action" } },
  { n: 27, name: "inherited state cited behind an own governed action — accepted", rows: () => ({ assessments: groundedViolation() }), expect: { kind: "accepted", outcome: "boundary_review_reject" } },

  // --- applicability consistency (2) --------------------------------------
  { n: 28, name: "applies with the governed action absent", rows: () => ({ assessments: withRow("primary[0]", { applicability: "applies", governedActionStatus: "absent", prerequisiteStatus: "satisfied", temporalRelation: "prerequisite_before_action", compliance: "complies", prerequisiteEvidence: { segmentRef: ownRef("primary[0]"), excerpt: at("primary[0]").text } }) }), expect: { kind: "malformed", code: "boundary_governed_action_absent_for_applies" } },
  { n: 29, name: "a satisfied prerequisite asserted with no evidence", rows: () => ({ assessments: withRow("primary[0]", { applicability: "applies", governedActionStatus: "present", prerequisiteStatus: "satisfied", temporalRelation: "prerequisite_before_action", compliance: "complies" }) }), expect: { kind: "malformed", code: "boundary_violation_prerequisite_evidence_missing" } },

  // --- verdicts (3) --------------------------------------------------------
  { n: 30, name: "every surface settled — pass", rows: () => ({ assessments: settled() }), expect: { kind: "accepted", outcome: "boundary_review_pass" } },
  { n: 31, name: "one surface uncertain — inconclusive, never a quiet pass", rows: () => ({ assessments: withRow("branch[1].tradeoff[1]", { applicability: "uncertain", governedActionStatus: "uncertain", prerequisiteStatus: "uncertain", reason: "'caring for' may or may not mean treating" }) }), expect: { kind: "accepted", outcome: "boundary_review_inconclusive" } },
  { n: 32, name: "a fully grounded violation — reject", rows: () => ({ assessments: groundedViolation({ violationMechanism: "resulting_state_missing_prerequisite" }) }), expect: { kind: "accepted", outcome: "boundary_review_reject" } },
];

describe("[15] the 32-case gate matrix", () => {
  it("covers thirty-two distinct cases, numbered without gaps", () => {
    expect(CASES).toHaveLength(32);
    expect(CASES.map((c) => c.n)).toEqual(Array.from({ length: 32 }, (_, i) => i + 1));
  });

  for (const c of CASES) {
    it(`[${c.n}] ${c.name}`, () => {
      const v = deriveBoundaryVerdict(c.rows(), ctx);
      if (c.expect.kind === "malformed") {
        expect(v.outcome).toBe("boundary_review_malformed");
        if (v.outcome !== "boundary_review_malformed") throw new Error("unreachable");
        expect(v.codes).toContain(c.expect.code);
        return;
      }
      if (c.expect.kind === "refuted") {
        // The RESPONSE stands; the CLAIM does not. The surface is left unsettled either way, so the
        // scenario can never pass on it.
        expect(v.outcome).not.toBe("boundary_review_malformed");
        const r = validateNarrowBoundaryReview(c.rows(), ctx);
        expect(r.ok).toBe(true);
        if (!r.ok) throw new Error("unreachable");
        expect(r.refutations.flatMap((x) => x.codes)).toContain(c.expect.code);
        expect(r.value.assessments.find((a) => a.compliance === "violates")).toBeUndefined();
        return;
      }
      expect(v.outcome).toBe(c.expect.outcome);
    });
  }
});
