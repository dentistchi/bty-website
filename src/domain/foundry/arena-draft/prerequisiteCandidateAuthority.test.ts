/**
 * PREREQUISITE CANDIDATE AUTHORITY PARITY + EMPTY-POOL FAIL-CLOSED (Slice 3.2I-R5B1A.1-R2.48).
 *
 * R2.47 proved two things about the same axis. The governed-action candidate is chosen by POOL
 * CARDINALITY; the prerequisite candidates are chosen by the TRUTH STATE. The prompt stated only
 * the first, as a general principle, and the live reviewer applied it to the failure role — which
 * the state table forbids. And where a required prerequisite pool was EMPTY the validator accepted
 * the sentinel, so a violation could be derived with no evidence behind it at all.
 *
 * The decision matrix here is generated from TRUTH_STATES rather than written out, so a tenth state
 * cannot be added without its coverage appearing.
 */

import { describe, it, expect } from "vitest";
import {
  TRUTH_STATES,
  type TruthStateRule,
  prerequisiteUnavailableCode,
  PREREQUISITE_UNAVAILABLE_CODES,
} from "./boundaryTruthStates";
import { deriveBoundaryVerdict, validateNarrowBoundaryReview, type BoundaryTruthAssessment } from "./narrowBoundaryReview";
import { buildSemanticFrames } from "./boundarySemanticFrame";
import { NARROW_BOUNDARY_SYSTEM_PROMPT } from "@/lib/bty/foundry/arena/narrowBoundaryContract";
import type { BoundarySurface } from "./boundarySurfaces";
import type { BoundaryEvidenceCandidate } from "./boundaryEvidenceCandidates";
import { buildNarrowBoundarySubject } from "@/lib/bty/foundry/arena/narrowBoundaryContract";
import { projectCausalFindings } from "@/lib/bty/foundry/arena/boundaryReviewStage";
import { buildCorrectionPacket } from "./correctionPacket";
import { resolveRejection } from "./gatePrecedence";
import { C18_BOUNDARY, C18_SURFACES, C18_SCENARIO, C18_SCENARIO_SHA256 } from "./c18BoundaryFixture";
import {
  R246_ATTEMPT_1,
  R246_ATTEMPT_2_REPAIR,
  R246_ATTEMPT_1_VALID,
  R246_ATTEMPT_1_FAILED_REQUIRED_MISSING,
  R246_ATTEMPT_1_FAILED_WRONG_ROLE,
  R246_REPAIR_SURFACE_REFS,
  R246_REPAIR_FORBIDDEN_PRESENT,
  R246_MEASURED,
} from "./r246LiveDtoFixture";

// ---------------------------------------------------------------------------
// A synthetic one-surface world, so pool cardinality is set exactly per case
// ---------------------------------------------------------------------------

const BOUNDARY = { id: "b1", statement: "Two identifiers must be verified before treatment" };
const SURFACE: BoundarySurface = {
  coordinate: "primary[0]",
  kind: "choice",
  phase: "primary",
  reachability: "learner_decision",
  userReachable: true,
  independentlySelectable: true,
  branchIndex: -1,
  index: 0,
  parentPrimaryCoordinate: "",
  lineage: [],
  text: "Treat the second patient without verifying identifiers",
  selectedPrimaryLabel: "",
  branchContext: "",
  inheritedWorldState: "",
  isActionCommitment: false,
  acceptedCost: "",
  compatibilitySource: "",
} as BoundarySurface;

const ROLES = ["governed_action", "prerequisite_satisfaction", "prerequisite_failure"] as const;
const CODE: Record<string, string> = { governed_action: "a", prerequisite_satisfaction: "s", prerequisite_failure: "f" };

const candidate = (role: (typeof ROLES)[number], n: number): BoundaryEvidenceCandidate =>
  ({
    candidateId: `1-${CODE[role]}${n}`,
    boundaryId: "b1",
    assessedSurfaceRef: "primary[0]",
    semanticRole: role,
    canonicalSegmentRef: "1:own",
    canonicalSegmentKind: "own_surface",
    sourceSurfaceRef: "primary[0]",
    branchId: -1,
    lineage: [],
    excerpt: `span for ${role} ${n}`,
    startOffset: 0,
    endOffset: 10,
    sha256: `${role}${n}`,
  }) as BoundaryEvidenceCandidate;

/** Build a context whose three pools have exactly the requested cardinalities. */
const ctxFor = (sizes: { governed_action: number; prerequisite_satisfaction: number; prerequisite_failure: number }) => ({
  boundaries: [BOUNDARY],
  surfaces: [SURFACE],
  frames: buildSemanticFrames([BOUNDARY]),
  candidates: ROLES.flatMap((r) => Array.from({ length: sizes[r] }, (_, i) => candidate(r, i + 1))),
});

/** The canonical facts for a state — first permitted value of each axis. */
const factsFor = (s: TruthStateRule) => ({
  governedActionStatus: s.governedActionStatus,
  prerequisiteStatus: s.prerequisiteStatus[0]!,
  temporalRelation: s.temporalRelation[0]!,
});

const row = (s: TruthStateRule, ids: { ga?: string; sat?: string; fail?: string }): BoundaryTruthAssessment =>
  ({
    boundaryId: "b1",
    surfaceRef: "primary[0]",
    ...factsFor(s),
    governedActionCandidateId: ids.ga ?? "none",
    prerequisiteSatisfactionCandidateId: ids.sat ?? "none",
    prerequisiteFailureCandidateId: ids.fail ?? "none",
    reason: s.reasonAuthority === "model_required" ? "the wording does not settle which patient the order refers to" : "",
  }) as BoundaryTruthAssessment;

const codesOf = (v: ReturnType<typeof validateNarrowBoundaryReview>): string[] => (v.ok ? [] : v.codes);

/** Only PREREQUISITE rules use this file's matrix; the governed-action axis is R2.42's and is pinned separately. */
const PREREQ_ROLES = ["prerequisite_satisfaction", "prerequisite_failure"] as const;
const requirementOf = (s: TruthStateRule, role: (typeof PREREQ_ROLES)[number]) =>
  role === "prerequisite_satisfaction" ? s.satisfactionCandidate : s.failureCandidate;
const idKey = (role: (typeof PREREQ_ROLES)[number]) => (role === "prerequisite_satisfaction" ? "sat" : "fail") as "sat" | "fail";

/** Sizes that satisfy every OTHER role so only the role under test can fail. */
const sizesWith = (role: (typeof PREREQ_ROLES)[number], n: number, s: TruthStateRule) => ({
  governed_action: s.governedActionCandidate === "forbidden" ? 0 : 1,
  prerequisite_satisfaction: role === "prerequisite_satisfaction" ? n : s.satisfactionCandidate === "required" ? 1 : 0,
  prerequisite_failure: role === "prerequisite_failure" ? n : s.failureCandidate === "required" ? 1 : 0,
});
const otherIds = (role: (typeof PREREQ_ROLES)[number], s: TruthStateRule) => ({
  ga: s.governedActionCandidate === "forbidden" ? "none" : "1-a1",
  ...(role === "prerequisite_satisfaction" ? {} : { sat: s.satisfactionCandidate === "required" ? "1-s1" : "none" }),
  ...(role === "prerequisite_failure" ? {} : { fail: s.failureCandidate === "required" ? "1-f1" : "none" }),
});

// ---------------------------------------------------------------------------
// Part 5 — the generated decision matrix
// ---------------------------------------------------------------------------

describe("[R2.48][5] prerequisite candidate authority — every state x both roles", () => {
  it("covers every canonical truth state, so a new state cannot bypass this matrix", () => {
    expect(TRUTH_STATES.length).toBeGreaterThanOrEqual(9);
  });

  for (const state of TRUTH_STATES) {
    for (const role of PREREQ_ROLES) {
      const req = requirementOf(state, role);
      const key = idKey(role);
      const member = role === "prerequisite_satisfaction" ? "1-s1" : "1-f1";
      const unavailable = prerequisiteUnavailableCode(role);
      const label = `${state.id} / ${role} [${req}]`;

      if (req === "required") {
        it(`${label} — non-empty + valid member → VALID`, () => {
          const v = validateNarrowBoundaryReview({ assessments: [row(state, { ...otherIds(role, state), [key]: member })] }, ctxFor(sizesWith(role, 1, state)) as never);
          expect(codesOf(v)).toEqual([]);
        });
        it(`${label} — non-empty + none → required_missing`, () => {
          const v = validateNarrowBoundaryReview({ assessments: [row(state, { ...otherIds(role, state), [key]: "none" })] }, ctxFor(sizesWith(role, 1, state)) as never);
          expect(codesOf(v)).toContain("boundary_candidate_required_missing");
        });
        it(`${label} — EMPTY + none → ${unavailable}`, () => {
          const v = validateNarrowBoundaryReview({ assessments: [row(state, { ...otherIds(role, state), [key]: "none" })] }, ctxFor(sizesWith(role, 0, state)) as never);
          expect(codesOf(v)).toContain(unavailable);
          expect(codesOf(v)).not.toContain("boundary_candidate_required_missing");
          expect(v.ok).toBe(false);
        });
        it(`${label} — EMPTY + arbitrary id → ${unavailable} AND the id diagnostic`, () => {
          const v = validateNarrowBoundaryReview({ assessments: [row(state, { ...otherIds(role, state), [key]: "9-z9" })] }, ctxFor(sizesWith(role, 0, state)) as never);
          expect(codesOf(v)).toContain(unavailable);
          expect(codesOf(v)).toContain("boundary_candidate_unknown");
        });
      }

      if (req === "forbidden") {
        it(`${label} — non-empty + none → VALID (the pool is irrelevant)`, () => {
          const v = validateNarrowBoundaryReview({ assessments: [row(state, { ...otherIds(role, state), [key]: "none" })] }, ctxFor(sizesWith(role, 2, state)) as never);
          expect(codesOf(v)).toEqual([]);
        });
        it(`${label} — non-empty + member → forbidden_present (UNCHANGED by R2.48)`, () => {
          const v = validateNarrowBoundaryReview({ assessments: [row(state, { ...otherIds(role, state), [key]: member })] }, ctxFor(sizesWith(role, 2, state)) as never);
          expect(codesOf(v)).toContain("boundary_candidate_forbidden_present");
        });
        it(`${label} — EMPTY + none → VALID`, () => {
          const v = validateNarrowBoundaryReview({ assessments: [row(state, { ...otherIds(role, state), [key]: "none" })] }, ctxFor(sizesWith(role, 0, state)) as never);
          expect(codesOf(v)).toEqual([]);
        });
      }

      if (req === "optional") {
        it(`${label} — non-empty + none → VALID`, () => {
          const v = validateNarrowBoundaryReview({ assessments: [row(state, { ...otherIds(role, state), [key]: "none" })] }, ctxFor(sizesWith(role, 1, state)) as never);
          expect(codesOf(v)).toEqual([]);
        });
        it(`${label} — non-empty + member → VALID`, () => {
          const v = validateNarrowBoundaryReview({ assessments: [row(state, { ...otherIds(role, state), [key]: member })] }, ctxFor(sizesWith(role, 1, state)) as never);
          expect(codesOf(v)).toEqual([]);
        });
        it(`${label} — EMPTY + none → VALID`, () => {
          const v = validateNarrowBoundaryReview({ assessments: [row(state, { ...otherIds(role, state), [key]: "none" })] }, ctxFor(sizesWith(role, 0, state)) as never);
          expect(codesOf(v)).toEqual([]);
        });
        it(`${label} — EMPTY + candidate → INVALID`, () => {
          const v = validateNarrowBoundaryReview({ assessments: [row(state, { ...otherIds(role, state), [key]: member })] }, ctxFor(sizesWith(role, 0, state)) as never);
          expect(v.ok).toBe(false);
        });
      }
    }
  }
});

// ---------------------------------------------------------------------------
// Part 3 — no evidence-free finding, in either direction
// ---------------------------------------------------------------------------

describe("[R2.48][3] an empty required pool can never license an evidence-free finding", () => {
  const missing = TRUTH_STATES.find((s) => s.id === "governed_action_prerequisite_missing")!;
  const satisfied = TRUTH_STATES.find((s) => s.id === "governed_action_prerequisite_satisfied")!;

  it("explicitly_missing + EMPTY failure pool + none → refused, and NO violation is derived", () => {
    const ctx = ctxFor({ governed_action: 1, prerequisite_satisfaction: 0, prerequisite_failure: 0 });
    const d = deriveBoundaryVerdict({ assessments: [row(missing, { ga: "1-a1" })] }, ctx as never);
    expect(d.outcome).toBe("boundary_review_malformed");
    if (d.outcome !== "boundary_review_malformed") throw new Error("unreachable");
    expect(d.codes).toContain("boundary_prerequisite_failure_candidate_unavailable");
    expect(d.derived).toHaveLength(0);
    expect(d.failedSurfaceRefs).toEqual(["primary[0]"]);
  });

  it("explicitly_missing + EMPTY failure pool + any id → refused, unavailable authority still observable", () => {
    const ctx = ctxFor({ governed_action: 1, prerequisite_satisfaction: 1, prerequisite_failure: 0 });
    const d = deriveBoundaryVerdict({ assessments: [row(missing, { ga: "1-a1", fail: "1-s1" })] }, ctx as never);
    if (d.outcome !== "boundary_review_malformed") throw new Error("unreachable");
    expect(d.codes).toContain("boundary_prerequisite_failure_candidate_unavailable");
    // The wrong-role diagnostic is retained alongside it — R2.47's live attempt-1 shape.
    expect(d.codes).toContain("boundary_candidate_wrong_role");
  });

  it("satisfied + EMPTY satisfaction pool + none → refused, and NO compliant row is derived", () => {
    const ctx = ctxFor({ governed_action: 1, prerequisite_satisfaction: 0, prerequisite_failure: 0 });
    const d = deriveBoundaryVerdict({ assessments: [row(satisfied, { ga: "1-a1" })] }, ctx as never);
    if (d.outcome !== "boundary_review_malformed") throw new Error("unreachable");
    expect(d.codes).toContain("boundary_prerequisite_satisfaction_candidate_unavailable");
    expect(d.derived).toHaveLength(0);
  });

  it("satisfied + EMPTY satisfaction pool + any id → refused", () => {
    const ctx = ctxFor({ governed_action: 1, prerequisite_satisfaction: 0, prerequisite_failure: 1 });
    const d = deriveBoundaryVerdict({ assessments: [row(satisfied, { ga: "1-a1", sat: "1-f1" })] }, ctx as never);
    if (d.outcome !== "boundary_review_malformed") throw new Error("unreachable");
    expect(d.codes).toContain("boundary_prerequisite_satisfaction_candidate_unavailable");
  });

  it("the governed-action empty-pool contract is UNCHANGED — the sentinel still stands there", () => {
    // R2.42: an empty governed-action pool accepts `none` on an `absent` row. R2.48 must not
    // generalize the new guard to the role that already has its own authority.
    const nonGoverning = TRUTH_STATES.find((s) => s.id === "non_governing")!;
    const ctx = ctxFor({ governed_action: 0, prerequisite_satisfaction: 0, prerequisite_failure: 0 });
    const v = validateNarrowBoundaryReview({ assessments: [row(nonGoverning, {})] }, ctx as never);
    expect(codesOf(v)).toEqual([]);
  });

  it("every unavailable code is registered and role-distinguishing", () => {
    expect(PREREQUISITE_UNAVAILABLE_CODES).toHaveLength(2);
    expect(prerequisiteUnavailableCode("prerequisite_satisfaction")).not.toBe(prerequisiteUnavailableCode("prerequisite_failure"));
    for (const c of PREREQUISITE_UNAVAILABLE_CODES) expect(c).toMatch(/satisfaction|failure/);
  });
});

// ---------------------------------------------------------------------------
// Part 2 — prompt authority parity
// ---------------------------------------------------------------------------

describe("[R2.48][2] the prompt states ONE authority per role", () => {
  const P = NARROW_BOUNDARY_SYSTEM_PROMPT;

  it("the cross-role generalization is gone", () => {
    expect(P).not.toContain("This is decided by the LIST, not by your status");
    // Nothing may claim list-cardinality across all roles.
    expect(P).not.toMatch(/decided by the LIST(?![^.]*governedActionCandidates)/);
  });

  it("the governed-action pool rule survives verbatim in substance", () => {
    expect(P).toContain("governedActionCandidates");
    expect(P).toMatch(/governedActionCandidates list for that surface is empty/);
    expect(P).toMatch(/select[^.]*whether you answer `present` or `absent`/);
  });

  it("the prerequisite rule is stated as STATE-driven, explicitly not list-driven", () => {
    expect(P).toMatch(/PREREQUISITE CANDIDATES/);
    expect(P).toMatch(/chosen truth state/);
    expect(P).toMatch(/even (when|if) that (candidate )?list is non-empty/i);
  });

  it("required-with-an-empty-list is described as UNSUPPORTED, not as a sentinel case", () => {
    expect(P).toMatch(/unsupported/i);
    expect(P).toMatch(/do not select it|must not be selected|is not available/i);
  });

  it("every state whose prerequisite requirement is forbidden says `none` in the rendered prompt", () => {
    for (const s of TRUTH_STATES) {
      const line = P.split("\n").find((l) => l.trim().startsWith(s.id));
      expect(line, s.id).toBeDefined();
      if (s.satisfactionCandidate === "forbidden" && s.failureCandidate === "forbidden") {
        expect(line, s.id).toMatch(/both prerequisite candidate ids must be `none`/i);
      } else if (s.satisfactionCandidate === "forbidden") {
        expect(line, s.id).toMatch(/prerequisiteSatisfactionCandidateId must be `none`/i);
      } else if (s.failureCandidate === "forbidden") {
        expect(line, s.id).toMatch(/prerequisiteFailureCandidateId must be `none`/i);
      }
    }
  });

  it("every state whose prerequisite requirement is required says so AND names the empty-list case", () => {
    for (const s of TRUTH_STATES) {
      const line = P.split("\n").find((l) => l.trim().startsWith(s.id))!;
      if (s.satisfactionCandidate === "required") expect(line, s.id).toMatch(/prerequisiteSatisfactionCandidates/);
      if (s.failureCandidate === "required") expect(line, s.id).toMatch(/prerequisiteFailureCandidates/);
      if (s.satisfactionCandidate === "required" || s.failureCandidate === "required") expect(line, s.id).toMatch(/unsupported/i);
    }
  });

  it("no hand-written second authority survives — the per-state clauses are GENERATED", () => {
    // The old hand-written sentences are gone; if one returns, its wording will not match the
    // generated form and the two assertions above will disagree with each other.
    expect(P).not.toContain("Both prerequisite candidates must be none.");
    expect(P).not.toContain("The failure candidate must be none.");
    expect(P).not.toContain("The satisfaction candidate must be none.");
  });

  it("non_governing states the rule even though its prerequisite pools may be non-empty", () => {
    const line = NARROW_BOUNDARY_SYSTEM_PROMPT.split("\n").find((l) => l.trim().startsWith("non_governing"))!;
    expect(line).toMatch(/both prerequisite candidate ids must be `none`/i);
    expect(line).toMatch(/non-empty/i);
  });
});

// ---------------------------------------------------------------------------
// Part 4 — the captured R2.46 live attempts, and the merge they should have produced
// ---------------------------------------------------------------------------

describe("[R2.48][4] the captured R2.46 live attempts", () => {
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
  const c18 = { boundaries: [C18_BOUNDARY], surfaces: subject.surfaces, frames: buildSemanticFrames([C18_BOUNDARY]), candidates };
  const poolOf = (ref: string, role: string) => candidates.filter((c) => c.assessedSurfaceRef === ref && c.semanticRole === role);
  const surfaceByRef = new Map(subject.surfaces.map((s) => [s.coordinate, s]));
  /** The repair was validated against the PROJECTED nine-surface subject, not the full twelve. */
  const repairCtx = { ...c18, surfaces: subject.surfaces.filter((s) => (R246_REPAIR_SURFACE_REFS as readonly string[]).includes(s.coordinate)) };

  it("A — attempt 1 still produces 8 required_missing + 1 wrong_role, unchanged by R2.48", () => {
    const d = deriveBoundaryVerdict({ assessments: R246_ATTEMPT_1 }, c18 as never);
    expect(d.outcome).toBe("boundary_review_malformed");
    if (d.outcome !== "boundary_review_malformed") throw new Error("unreachable");
    const byCode = (c: string) => d.findings.filter((f) => f.code === c).map((f) => f.surfaceRef);
    expect(byCode("boundary_candidate_required_missing").sort()).toEqual([...R246_ATTEMPT_1_FAILED_REQUIRED_MISSING].sort());
    expect(byCode("boundary_candidate_wrong_role")).toEqual([...R246_ATTEMPT_1_FAILED_WRONG_ROLE]);
    expect(d.validSurfaceRefs.sort()).toEqual([...R246_ATTEMPT_1_VALID].sort());
  });

  it("A — the wrong_role row ALSO now reports the failure role as unavailable", () => {
    // Historical codes are not rewritten. The new authority is ADDED alongside: branch[0]'s failure
    // pool is empty, so `explicitly_missing` was never available there in the first place.
    const d = deriveBoundaryVerdict({ assessments: R246_ATTEMPT_1 }, c18 as never);
    if (d.outcome !== "boundary_review_malformed") throw new Error("unreachable");
    expect(d.codes).toContain("boundary_prerequisite_failure_candidate_unavailable");
    const row = (d.prerequisiteUnavailable ?? []).find((x) => x.surfaceRef === "branch[0].resulting_world_state")!;
    expect(row).toMatchObject({ role: "prerequisite_failure", stateId: "governed_action_prerequisite_missing", poolCardinality: 0, selectedCandidateId: "3-s1" });
  });

  it("B — the repair still produces exactly 3 forbidden_present, on the same surfaces", () => {
    const d = deriveBoundaryVerdict({ assessments: R246_ATTEMPT_2_REPAIR }, repairCtx as never);
    if (d.outcome !== "boundary_review_malformed") throw new Error("unreachable");
    expect(d.findings.filter((f) => f.code === "boundary_candidate_forbidden_present").map((f) => f.surfaceRef).sort()).toEqual([...R246_REPAIR_FORBIDDEN_PRESENT].sort());
    expect(d.failedSurfaceRefs.sort()).toEqual([...R246_REPAIR_FORBIDDEN_PRESENT].sort());
  });

  it("B — the repair carried exactly 9 rows, no preserved rows, post-R2.44 pools, no removed candidates", () => {
    expect(R246_ATTEMPT_2_REPAIR).toHaveLength(9);
    expect(R246_ATTEMPT_2_REPAIR.map((r) => r.surfaceRef)).toEqual([...R246_REPAIR_SURFACE_REFS]);
    for (const ref of R246_ATTEMPT_1_VALID) expect(R246_REPAIR_SURFACE_REFS).not.toContain(ref);
    // R2.44 pools as they stand: branch[0] failure pools empty, branch[1] retained.
    for (const ref of ["branch[0].resulting_world_state", "branch[0].tradeoff[0]", "branch[0].tradeoff[1]", "branch[0].action[0]", "branch[0].action[1]"]) {
      expect(poolOf(ref, "prerequisite_failure"), ref).toHaveLength(0);
    }
    for (const ref of ["branch[1].tradeoff[0]", "branch[1].tradeoff[1]", "branch[1].action[0]"]) expect(poolOf(ref, "prerequisite_failure"), ref).toHaveLength(1);
    const all = new Set(candidates.map((c) => c.candidateId));
    for (const removed of ["3-f1", "4-f1", "5-f1", "6-f1", "7-f1"]) expect(all.has(removed), removed).toBe(false);
    expect(candidates).toHaveLength(57);
  });

  it("B — the merge remains refused under the historical response", () => {
    const merged = [...R246_ATTEMPT_1.filter((r) => (R246_ATTEMPT_1_VALID as readonly string[]).includes(r.surfaceRef)), ...R246_ATTEMPT_2_REPAIR];
    const d = deriveBoundaryVerdict({ assessments: merged }, c18 as never);
    expect(d.outcome).toBe("boundary_review_malformed");
    expect(R246_MEASURED.finalOutcome).toBe("boundary_reviewer_terminal_failure");
  });

  it("C — empty failure pool + explicitly_missing on the real c18 surface: refused, no violation", () => {
    const rows = R246_ATTEMPT_2_REPAIR.map((r) =>
      r.surfaceRef === "branch[0].resulting_world_state"
        ? { ...r, prerequisiteStatus: "explicitly_missing" as const, temporalRelation: "action_before_prerequisite" as const, prerequisiteSatisfactionCandidateId: "none", prerequisiteFailureCandidateId: "none" }
        : r,
    );
    const d = deriveBoundaryVerdict({ assessments: rows }, repairCtx as never);
    if (d.outcome !== "boundary_review_malformed") throw new Error("unreachable");
    expect(d.codes).toContain("boundary_prerequisite_failure_candidate_unavailable");
    expect(d.failedSurfaceRefs).toContain("branch[0].resulting_world_state");
    expect("violations" in d).toBe(false);
    expect(d.derived.map((x) => x.surfaceRef)).not.toContain("branch[0].resulting_world_state");
  });

  it("C — symmetric satisfaction case is refused the same way", () => {
    // primary[0]'s governed-action pool is empty (R2.40), so build the case on a surface that can
    // hold `present`, and empty its satisfaction pool by construction.
    const noSat = candidates.filter((c) => !(c.assessedSurfaceRef === "branch[1].action[1]" && c.semanticRole === "prerequisite_satisfaction"));
    const ctx2 = { ...c18, candidates: noSat };
    const rows = R246_ATTEMPT_1.map((r) =>
      r.surfaceRef === "branch[1].action[1]"
        ? { ...r, prerequisiteStatus: "satisfied" as const, temporalRelation: "prerequisite_before_action" as const, prerequisiteSatisfactionCandidateId: "none", prerequisiteFailureCandidateId: "none" }
        : r,
    );
    const d = deriveBoundaryVerdict({ assessments: rows }, ctx2 as never);
    if (d.outcome !== "boundary_review_malformed") throw new Error("unreachable");
    expect(d.codes).toContain("boundary_prerequisite_satisfaction_candidate_unavailable");
  });

  /** D — the SAME live rows with only the contract-correct prerequisite fields. */
  const corrected = (): BoundaryTruthAssessment[] => {
    const gaOf = (ref: string) => poolOf(ref, "governed_action")[0]?.candidateId ?? "none";
    const nonGoverning = (ref: string): BoundaryTruthAssessment =>
      ({ boundaryId: "c1_verify", surfaceRef: ref, governedActionStatus: "absent", prerequisiteStatus: "not_applicable", temporalRelation: "not_applicable", governedActionCandidateId: gaOf(ref), prerequisiteSatisfactionCandidateId: "none", prerequisiteFailureCandidateId: "none", reason: "" }) as BoundaryTruthAssessment;
    return [
      R246_ATTEMPT_1.find((r) => r.surfaceRef === "primary[0]")!,
      nonGoverning("primary[1]"),
      R246_ATTEMPT_2_REPAIR.find((r) => r.surfaceRef === "branch[0].resulting_world_state")!,
      nonGoverning("branch[0].tradeoff[0]"),
      nonGoverning("branch[0].tradeoff[1]"),
      nonGoverning("branch[0].action[0]"),
      nonGoverning("branch[0].action[1]"),
      R246_ATTEMPT_1.find((r) => r.surfaceRef === "branch[1].resulting_world_state")!,
      nonGoverning("branch[1].tradeoff[0]"),
      nonGoverning("branch[1].tradeoff[1]"),
      nonGoverning("branch[1].action[0]"),
      R246_ATTEMPT_1.find((r) => r.surfaceRef === "branch[1].action[1]")!,
    ];
  };

  it("D — the canonical corrected merge completes with no output-contract failure", () => {
    const d = deriveBoundaryVerdict({ assessments: corrected() }, c18 as never);
    expect(d.outcome).toBe("boundary_review_reject");
    if (d.outcome !== "boundary_review_reject") throw new Error("unreachable");
    expect(d.assessedPairs).toBe(12);
    expect(d.violations.map((v) => v.surfaceRef)).toEqual(["branch[1].resulting_world_state", "branch[1].action[1]"]);
  });

  it("D — primary[1]'s direct row is unchanged and R2.46 attribution fires", () => {
    const d = deriveBoundaryVerdict({ assessments: corrected() }, c18 as never);
    if (d.outcome !== "boundary_review_reject") throw new Error("unreachable");
    const p1 = d.derived.find((x) => x.surfaceRef === "primary[1]")!;
    expect(p1.facts.governedActionStatus).toBe("absent");
    expect(p1.governedAction?.candidateId).toBe("2-a1");
    expect(p1.applicability).toBe("not_applicable");
    expect(d.causalAttributions.map((a) => `${a.ancestorSurfaceRef}<-${a.manifestationSurfaceRef}`)).toEqual(["primary[1]<-branch[1].resulting_world_state"]);
    expect(d.causalGroups.map((g) => [g.correctionOwnerSurfaceRef, ...g.manifestationSurfaceRefs].join("+"))).toEqual([
      "primary[1]+branch[1].resulting_world_state",
      "branch[1].action[1]",
    ]);
    expect(d.causalAttributionMetrics.ancestorDirectAssessmentMutationCount).toBe(0);
  });

  it("D — exactly TWO correction packet items, and no applicability false positive", () => {
    const d = deriveBoundaryVerdict({ assessments: corrected() }, c18 as never);
    if (d.outcome !== "boundary_review_reject") throw new Error("unreachable");
    const findings = projectCausalFindings(d.causalGroups, d.causalViolations, surfaceByRef);
    const packet = buildCorrectionPacket(1, findings[0]!.code, resolveRejection([...findings])!.findings, {
      title: "Managing a Backed-Up Ward",
      boundaryStatements: ["Two identifiers must be verified before treatment"],
    } as never);
    expect(packet.items).toHaveLength(2);
    expect(packet.defectCodes.sort()).toEqual(["action_reopens_boundary", "choice_bypasses_boundary"]);
    expect(packet.defectCodes).not.toContain("branch_drops_boundary");
    // The three R2.42 applicability false positives are absent from THIS fixture — because the rows
    // answer `absent`, not because any applicability rule was implemented. Still not a quality PASS.
    for (const ref of ["branch[1].tradeoff[0]", "branch[1].tradeoff[1]", "branch[1].action[0]"]) {
      expect(d.violations.map((v) => v.surfaceRef), ref).not.toContain(ref);
    }
  });

  it("records the one-run applicability observation without encoding a rule from it", () => {
    expect(R246_MEASURED.nonClauseMatchingGovernedActionCandidates).toBe(9);
    expect(R246_MEASURED.nonClauseMatchingMarkedPresent).toBe(0);
    expect(R246_MEASURED.nonClauseMatchingCitedWithAbsent).toBe(8);
    expect(R246_MEASURED.primaryOneHistoricalSemanticMisses).toBe("7/7");
  });
});
