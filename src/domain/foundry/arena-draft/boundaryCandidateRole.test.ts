/**
 * BOUNDARY-CLAUSE CANDIDATE ROLE AUTHORITY (Slice 3.2I-R5B1A.1-R2.40).
 *
 * R2.39 measured the defect this file exists to prevent. The R2.38 live review derived a causal
 * violation on `primary[0]` — "Verify identifiers for both patients now" — the ONE primary choice
 * that keeps the boundary. The correction packet therefore instructed a Manager to rewrite the safe
 * option while saying nothing about the unsafe one: a safety-inverting correction.
 *
 * The model did not invent that. The SERVER offered the span as candidate `1-a1`, governed action,
 * because governed-action eligibility returned true unconditionally while the frame's own
 * `governedActionClause` ("treatment") was never read.
 */
import { describe, expect, it } from "vitest";
import { buildAllEvidenceCandidates, poolFor } from "./boundaryEvidenceCandidates";
import { buildContextSegments } from "./boundaryContextSegments";
import { buildSemanticFrame, buildSemanticFrames } from "./boundarySemanticFrame";
import { clauseStems } from "./boundaryClauseTerms";
import { C18_BOUNDARY, C18_REACHABLE_SURFACES, C18_SCENARIO } from "./c18BoundaryFixture";

const segments = buildContextSegments(C18_SCENARIO, C18_REACHABLE_SURFACES);
const frames = buildSemanticFrames([C18_BOUNDARY]);
const { candidates } = buildAllEvidenceCandidates([C18_BOUNDARY], frames, C18_REACHABLE_SURFACES, segments);
const pool = (ref: string, role: "governed_action" | "prerequisite_satisfaction" | "prerequisite_failure") =>
  poolFor(candidates, C18_BOUNDARY.id, ref, role);

const PRIMARY_VERIFY = "Verify identifiers for both patients now";

describe("[R2.40][2] the measured role-leakage defect", () => {
  it("the frame separates the prerequisite from the governed action", () => {
    const f = buildSemanticFrame(C18_BOUNDARY);
    expect(f.ruleKind).toBe("prerequisite_before_action");
    expect(clauseStems(f.prerequisiteClause)).toEqual(["identifier", "verif"]);
    expect(clauseStems(f.governedActionClause)).toEqual(["treatment"]);
  });

  it("[FAILING PRE-FIX] a prerequisite-performing span is NOT offered as a governed action", () => {
    // primary[0]'s own text performs the prerequisite. It is not "treatment".
    expect(pool("primary[0]", "governed_action").map((c) => c.excerpt)).not.toContain(PRIMARY_VERIFY);
  });

  it("[FAILING PRE-FIX] primary[0] therefore has an EMPTY governed-action pool", () => {
    expect(pool("primary[0]", "governed_action")).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Parts 3-5, 8-11, 15 — the full role-authority proof
// ---------------------------------------------------------------------------

import { assessCandidateRole, candidateRoleContractSha256, isRoleEligible, ROLE_ELIGIBILITY } from "./boundaryCandidateRole";
import { buildAllEvidenceCandidates as buildAll } from "./boundaryEvidenceCandidates";
import { deriveBoundaryVerdict, validateNarrowBoundaryReview, type BoundaryTruthAssessment, type NarrowReviewContext } from "./narrowBoundaryReview";
import { NO_CANDIDATE } from "./boundaryTruthContractTypes";
import { R238_LIVE_ASSESSMENTS, R238_MEASURED, R238_ORACLE_VIOLATIONS, R238_POST_GATE_MATRIX } from "./r238LiveDtoFixture";

const build = buildAll([C18_BOUNDARY], frames, C18_REACHABLE_SURFACES, segments);
const ctx: NarrowReviewContext = { boundaries: [C18_BOUNDARY], surfaces: C18_REACHABLE_SURFACES, frames, candidates: build.candidates };
const frame = buildSemanticFrame(C18_BOUNDARY);
const role = (span: string) => assessCandidateRole(C18_BOUNDARY, frame, "governed_action", span);
const first = (ref: string, r: "governed_action" | "prerequisite_satisfaction" | "prerequisite_failure") =>
  pool(ref, r)[0]?.candidateId ?? NO_CANDIDATE;

const settled = (): BoundaryTruthAssessment[] =>
  C18_REACHABLE_SURFACES.map((s) => ({
    boundaryId: C18_BOUNDARY.id, surfaceRef: s.coordinate,
    governedActionStatus: "absent", prerequisiteStatus: "not_applicable", temporalRelation: "not_applicable",
    governedActionCandidateId: first(s.coordinate, "governed_action"),
    prerequisiteSatisfactionCandidateId: NO_CANDIDATE, prerequisiteFailureCandidateId: NO_CANDIDATE, reason: "",
  }));
const withRow = (ref: string, o: Partial<BoundaryTruthAssessment>) => settled().map((a) => (a.surfaceRef === ref ? { ...a, ...o } : a));

describe("[R2.40][3][4] boundary-relative role classification", () => {
  it("[1][2] the classifier consumes BOTH clause-term sets from the canonical frame", () => {
    const a = role("x");
    expect(a.evidence.prerequisiteTerms).toEqual(["identifier", "verif"]);
    expect(a.evidence.governedActionTerms).toEqual(["treat"]);
    expect([...ROLE_ELIGIBILITY]).toContain("prerequisite_operation_only");
    expect(candidateRoleContractSha256()).toMatch(/^[0-9a-f]{64}$/);
  });

  it("[3][4] 'Verify identifiers…' matches the prerequisite operation and NOT treatment", () => {
    const a = role(PRIMARY_VERIFY);
    expect(a.prerequisiteClauseMatch).toBe(true);
    expect(a.governedActionClauseMatch).toBe(false);
    expect(a.roleEligibility).toBe("prerequisite_operation_only");
    expect(a.refusalCode).toBe("boundary_candidate_role_prerequisite_operation");
    expect(isRoleEligible(C18_BOUNDARY, frame, "governed_action", PRIMARY_VERIFY)).toBe(false);
  });

  it("a noun-form governed action matches its verb forms — treatment / treated / treat", () => {
    for (const span of ["Immediately treat the second patient", "One patient was treated while the second remains unverified.", "You prioritized immediate treatment for one patient"]) {
      expect(role(span).governedActionClauseMatch, span).toBe(true);
      expect(isRoleEligible(C18_BOUNDARY, frame, "governed_action", span), span).toBe(true);
    }
  });

  it("a span matching NEITHER clause stays eligible — absence of terms is not disqualification", () => {
    const a = role("Prepare a detailed report for the administrator");
    expect(a.roleEligibility).toBe("unrelated");
    expect(a.refusalCode).toBeNull();
  });

  it("[19] a span matching BOTH is a recorded collision, not a refusal", () => {
    const a = role("You have verified identifiers for both patients and provided the necessary treatment");
    expect(a.roleEligibility).toBe("role_collision");
    expect(a.refusalCode).toBeNull();
  });

  it("an UNDECOMPOSABLE frame fails closed rather than guessing a role", () => {
    const vague = buildSemanticFrame({ id: "u", statement: "Be careful with the new intake process" });
    const a = assessCandidateRole({ id: "u" }, vague, "governed_action", "anything at all here");
    expect(a.roleEligibility).toBe("uncertain");
    expect(a.refusalCode).toBe("boundary_candidate_role_uncertain");
  });

  it("THE RULE MOVES WITH THE FRAME — a synthetic boundary sharing no c18 vocabulary", () => {
    // Nothing here is clinical. If the gate were a domain keyword list this test could not pass.
    const other = buildSemanticFrame({ id: "c9_sign", statement: "Dual authorization must be recorded before disbursement" });
    expect(assessCandidateRole({ id: "c9_sign" }, other, "governed_action", "x").evidence.governedActionTerms).toEqual(["disburse"]);
    const rec = assessCandidateRole({ id: "c9_sign" }, other, "governed_action", "Record the dual authorization now");
    expect(rec.roleEligibility).toBe("prerequisite_operation_only");   // performs the prerequisite
    expect(rec.refusalCode).toBe("boundary_candidate_role_prerequisite_operation");
    const dis = assessCandidateRole({ id: "c9_sign" }, other, "governed_action", "Disburse the funds immediately");
    expect(dis.roleEligibility).toBe("governed_action_only");          // performs the governed action
    expect(dis.refusalCode).toBeNull();
    // …and the c18 terms have no authority over it.
    expect(assessCandidateRole({ id: "c9_sign" }, other, "governed_action", "Verify identifiers now").roleEligibility).toBe("unrelated");
  });
});

describe("[R2.40][5][6] pools, collisions and pool-aware requirements", () => {
  it("[5][6] primary[0]'s governed-action pool is EMPTY, and only two spans were refused", () => {
    expect(pool("primary[0]", "governed_action")).toHaveLength(0);
    expect(build.roleMetrics.governedActionPrerequisiteOperationRefusedCount).toBe(2);
    expect(build.roleMetrics.governedActionRoleUncertainCount).toBe(0);
  });

  it("[19][20][21] collisions are measured; only the governed-action class is enforced", () => {
    expect(build.roleMetrics.governedActionRoleCollisionCount).toBe(1);
    // Satisfaction/failure polarity collisions are OBSERVED and left in place — R2.39 measured that
    // a first-cut polarity rule strips the safe branch of its only satisfaction evidence.
    expect(build.roleMetrics.prerequisitePolarityCollisionObservedCount).toBeGreaterThan(0);
    expect(pool("branch[0].resulting_world_state", "prerequisite_satisfaction").length).toBeGreaterThan(0);
  });

  it("[12] every role decision is recorded as evidence, refused or not", () => {
    const d = build.roleDecisions.find((x) => x.surfaceRef === "primary[0]")!;
    expect(d.refusalCode).toBe("boundary_candidate_role_prerequisite_operation");
    expect(d.span).toBe(PRIMARY_VERIFY);
    expect(d.candidateSpanSha256).toMatch(/^[0-9a-f]{16}$/);
    expect(d.evidence.matchedPrerequisite).toEqual(["identifier", "verif"]);
    expect(d.evidence.matchedGovernedAction).toEqual([]);
    expect(build.roleDecisions.every((x) => x.boundaryId === C18_BOUNDARY.id)).toBe(true);
  });

  it("[7][9][10] an EMPTY pool + absent + the sentinel is VALID and derives non_governing", () => {
    const v = validateNarrowBoundaryReview({ assessments: settled() }, ctx);
    expect(v.ok).toBe(true);
    if (!v.ok) throw new Error("unreachable");
    const row = v.derived.find((d) => d.surfaceRef === "primary[0]")!;
    expect(row.stateId).toBe("non_governing");
    expect(row.applicability).toBe("not_applicable");
    expect(row.compliance).toBe("not_assessed");
    expect(row.governedAction).toBeNull();
  });

  it("[8] an EMPTY pool + present is REFUSED with its own authority code", () => {
    const v = validateNarrowBoundaryReview(
      { assessments: withRow("primary[0]", { governedActionStatus: "present", prerequisiteStatus: "explicitly_missing", temporalRelation: "action_before_prerequisite" }) },
      ctx,
    );
    expect(v.ok).toBe(false);
    if (v.ok) throw new Error("unreachable");
    expect(v.codes).toContain("boundary_governed_action_candidate_unavailable");
  });

  it("[11][12] primary[0] produces no violation and no correction finding", () => {
    const d = deriveBoundaryVerdict({ assessments: settled() }, ctx);
    expect(d.outcome).toBe("boundary_review_pass");
  });

  it("a NON-empty pool still requires a selection — the R2.38 rule is not weakened", () => {
    const v = validateNarrowBoundaryReview({ assessments: withRow("primary[1]", { governedActionCandidateId: NO_CANDIDATE }) }, ctx);
    expect(v.ok).toBe(false);
    if (v.ok) throw new Error("unreachable");
    expect(v.codes).toContain("boundary_candidate_required_missing");
  });
});

describe("[R2.40][9][17] measured true positives and primary[1] preserved", () => {
  it("[13][15][17] the governed-action candidates that matter all survive", () => {
    expect(pool("branch[1].resulting_world_state", "governed_action").map((c) => c.excerpt)[0]).toContain("prioritized immediate treatment");
    expect(pool("branch[1].action[1]", "governed_action").map((c) => c.excerpt)).toEqual(["Immediately treat the second patient"]);
    // primary[1]'s governed-action candidate remains available — R2.40 does not touch its pool.
    expect(pool("primary[1]", "governed_action").map((c) => c.excerpt)).toEqual(["Notify the families and proceed with one patient"]);
  });

  it("[14][16] both branch violations still derive from the surviving candidates", () => {
    const violating = (ref: string): Partial<BoundaryTruthAssessment> => ({
      governedActionStatus: "present", prerequisiteStatus: "explicitly_missing", temporalRelation: "action_before_prerequisite",
      governedActionCandidateId: first(ref, "governed_action"), prerequisiteFailureCandidateId: first(ref, "prerequisite_failure"),
    });
    const rows = settled()
      .map((a) => (a.surfaceRef === "branch[1].resulting_world_state" ? { ...a, ...violating("branch[1].resulting_world_state") } : a))
      .map((a) => (a.surfaceRef === "branch[1].action[1]" ? { ...a, ...violating("branch[1].action[1]") } : a));
    const d = deriveBoundaryVerdict({ assessments: rows }, ctx);
    expect(d.outcome).toBe("boundary_review_reject");
    if (d.outcome !== "boundary_review_reject") throw new Error("unreachable");
    expect(d.violations.map((v) => v.surfaceRef)).toEqual(["branch[1].resulting_world_state", "branch[1].action[1]"]);
  });

  it("[18] no primary[1] violation is fabricated anywhere", () => {
    const d = deriveBoundaryVerdict({ assessments: settled() }, ctx);
    expect(d.outcome).toBe("boundary_review_pass");
    expect(R238_MEASURED.primaryOneLiveDetection).toBe("MISSED 6/6");
    expect(R238_MEASURED.primaryOnePostR240LiveStatus).toBe("NOT YET REMEASURED");
  });
});

describe("[R2.40][10] the captured R2.38 live DTO", () => {
  it("[25][27] A · the historical selection is role-refused, and the capture is NOT rewritten", () => {
    expect(R238_LIVE_ASSESSMENTS.find((r) => r.surfaceRef === "primary[0]")!.governedActionCandidateId).toBe("1-a1");
    const d = deriveBoundaryVerdict({ assessments: R238_LIVE_ASSESSMENTS }, ctx);
    expect(d.outcome).toBe("boundary_review_malformed");
    if (d.outcome !== "boundary_review_malformed") throw new Error("unreachable");
    expect(d.codes).toContain("boundary_governed_action_candidate_unavailable");
    expect(d.failedSurfaceRefs).toEqual(["primary[0]"]);
    expect(d.validSurfaceRefs).toHaveLength(11);
  });

  it("[26] the two branch true positives remain valid rows underneath the partial matrix", () => {
    const d = deriveBoundaryVerdict({ assessments: R238_LIVE_ASSESSMENTS }, ctx);
    if (d.outcome !== "boundary_review_malformed") throw new Error("unreachable");
    expect(d.derived.filter((x) => x.compliance === "violates").map((x) => x.surfaceRef)).toEqual([...R238_MEASURED.truePositives]);
    // …and NO product verdict is derived from a partial matrix.
    expect("violations" in d).toBe(false);
  });

  it("[28][29] B · the canonical post-gate matrix rejects on exactly the two branch findings", () => {
    const d = deriveBoundaryVerdict({ assessments: R238_POST_GATE_MATRIX }, ctx);
    expect(d.outcome).toBe("boundary_review_reject");
    if (d.outcome !== "boundary_review_reject") throw new Error("unreachable");
    expect(d.violations.map((v) => v.surfaceRef)).toEqual([...R238_MEASURED.truePositives]);
    expect(d.causalViolations.map((v) => v.surfaceRef)).toEqual([...R238_MEASURED.truePositives]);
    // THE MEASURED SAFETY-INVERTING CORRECTION IS BLOCKED: the safe verification choice is gone
    // from the packet entirely.
    expect(d.causalViolations.map((v) => v.surfaceRef)).not.toContain("primary[0]");
    for (const v of d.violations) expect(R238_ORACLE_VIOLATIONS).toContain(v.surfaceRef);
  });

  it("[30] the historical primary[1] miss remains visible and is not fabricated", () => {
    const d = deriveBoundaryVerdict({ assessments: R238_POST_GATE_MATRIX }, ctx);
    if (d.outcome !== "boundary_review_reject") throw new Error("unreachable");
    expect(d.violations.map((v) => v.surfaceRef)).not.toContain("primary[1]");
    expect(R238_ORACLE_VIOLATIONS).toContain("primary[1]");
    expect(R238_POST_GATE_MATRIX.find((r) => r.surfaceRef === "primary[1]")!.governedActionStatus).toBe("absent");
  });
});
