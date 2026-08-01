/**
 * THE CAPTURED R2.36 LIVE DTOs UNDER SERVER-OWNED CANDIDATE AUTHORITY
 * (Slice 3.2I-R5B1A.1-R2.38 Parts 12, 14, 15, 18 cases 32-36).
 *
 * Two complete provider responses over the frozen c18 subject. Both satisfied the strict schema.
 * Both were discarded by R2.36's local validation. R2.37 proved the contract was at fault.
 *
 * These tests replay both captures through the R2.38 contract and assert what actually happens —
 * not what would be convenient. Nothing here is tuned to produce a nicer number.
 */
import { describe, expect, it } from "vitest";
import { R236_LIVE_ATTEMPT_1, R236_LIVE_ATTEMPT_2, R236_MEASURED, R236_ORACLE_VIOLATIONS } from "./r236LiveDtoFixture";
import { R234_UPGRADED_TO_TRUTH_CONTRACT } from "./r234LiveDtoFixture";
import { upgradeR236Response } from "./r236LegacyUpgrade";
import { buildAllEvidenceCandidates, poolFor } from "./boundaryEvidenceCandidates";
import { buildContextSegments } from "./boundaryContextSegments";
import { buildSemanticFrames } from "./boundarySemanticFrame";
import { deriveBoundaryVerdict, planSubsetRepair, type NarrowReviewContext } from "./narrowBoundaryReview";
import { NO_CANDIDATE } from "./boundaryTruthContractTypes";
import { C18_BOUNDARY, C18_REACHABLE_SURFACES, C18_SCENARIO } from "./c18BoundaryFixture";

const segments = buildContextSegments(C18_SCENARIO, C18_REACHABLE_SURFACES);
const frames = buildSemanticFrames([C18_BOUNDARY]);
const { candidates } = buildAllEvidenceCandidates([C18_BOUNDARY], frames, C18_REACHABLE_SURFACES, segments);
const ctx: NarrowReviewContext = { boundaries: [C18_BOUNDARY], surfaces: C18_REACHABLE_SURFACES, frames, candidates };

const replay = (rows: typeof R236_LIVE_ATTEMPT_1) => {
  const upgraded = upgradeR236Response(rows, candidates);
  return { upgraded, verdict: deriveBoundaryVerdict({ assessments: upgraded.assessments }, ctx) };
};

describe("[32][33][34] attempt 2 — the correct answer that R2.36 threw away", () => {
  const { upgraded, verdict } = replay(R236_LIVE_ATTEMPT_2);

  it("[32] validates under the candidate authority, with nothing guessed", () => {
    expect(upgraded.ambiguousCount).toBe(0);
    expect(upgraded.unmatchedCount).toBe(0);
    expect(verdict.outcome).toBe("boundary_review_reject");
  });

  it("[33] the correction packet contains exactly the two measured true positives", () => {
    if (verdict.outcome !== "boundary_review_reject") throw new Error("unreachable");
    expect(verdict.violations.map((v) => v.surfaceRef)).toEqual([...R236_MEASURED.attempt2.truePositives]);
    expect(verdict.causalViolations.map((v) => v.surfaceRef)).toEqual([...R236_MEASURED.attempt2.truePositives]);
    expect(verdict.violations).toHaveLength(2);
    // Zero false positives — the measured property that made this response worth recovering.
    for (const v of verdict.violations) expect(R236_ORACLE_VIOLATIONS).toContain(v.surfaceRef);
  });

  it("[34] the false negative at primary[1] is still VISIBLE and still unmeasured", () => {
    if (verdict.outcome !== "boundary_review_reject") throw new Error("unreachable");
    expect(verdict.violations.map((v) => v.surfaceRef)).not.toContain("primary[1]");
    expect(R236_ORACLE_VIOLATIONS).toContain(R236_MEASURED.falseNegative);
    // The reviewer answered `absent` at primary[1] in BOTH attempts. R2.38 changes what it is
    // OFFERED, not what it concluded, so live detection stays unmeasured until the next replay.
    const row = R236_LIVE_ATTEMPT_2.find((r) => r.surfaceRef === "primary[1]")!;
    expect(row.governedActionStatus).toBe("absent");
  });

  it("the alias that destroyed it cannot recur — the two refs are now separate candidates", () => {
    const { surfaceRef, legal } = R236_MEASURED.attempt2.aliasMisselection;
    const chosen = upgraded.assessments.find((a) => a.surfaceRef === surfaceRef)!.prerequisiteFailureCandidateId;
    expect(chosen).not.toBe(NO_CANDIDATE);
    const resolved = candidates.find((c) => c.candidateId === chosen)!;
    expect(resolved.assessedSurfaceRef).toBe(surfaceRef);
    expect(resolved.canonicalSegmentRef).toBe(legal);
    // The id the model would have needed is in its OWN list; the other surface's is not.
    expect(poolFor(candidates, C18_BOUNDARY.id, surfaceRef, "prerequisite_failure").map((c) => c.candidateId)).toContain(chosen);
  });

  it("every finding's excerpt was resolved by the SERVER from a candidate id", () => {
    if (verdict.outcome !== "boundary_review_reject") throw new Error("unreachable");
    for (const v of verdict.violations) {
      expect(v.governedActionCandidateId).not.toBe("");
      expect(v.prerequisiteFailureCandidateId).not.toBe("");
      const gov = candidates.find((c) => c.candidateId === v.governedActionCandidateId)!;
      expect(v.governedActionEvidence).toBe(gov.excerpt);
      expect(gov.canonicalSegmentKind).toBe("own_surface");
    }
  });
});

describe("[35][36] attempt 1 — the redundant axis is gone, and nothing is guessed", () => {
  const { upgraded, verdict } = replay(R236_LIVE_ATTEMPT_1);

  it("[35] the redundant-axis rows no longer fail: applicability is derived, not authored", () => {
    // Every row in the capture said `applicability: applies`; five of them alongside
    // `governedActionStatus: absent`. Under R2.38 there is no applicability field to disagree with.
    for (const ref of R236_MEASURED.attempt1.redundantAxisRows) {
      const row = R236_LIVE_ATTEMPT_1.find((r) => r.surfaceRef === ref)!;
      expect(row.applicability).toBe("applies");
      expect(row.governedActionStatus).toBe("absent");
      if (verdict.outcome === "boundary_review_malformed") expect(verdict.failedSurfaceRefs).not.toContain(ref);
    }
    expect(upgraded.assessments.every((a) => !("applicability" in a) && !("compliance" in a))).toBe(true);
  });

  it("[36] ambiguous or unsupported legacy evidence is NEVER guessed", () => {
    expect(upgraded.ambiguousCount).toBe(0);
    // Six references have no legal home under the candidate policy, and the upgrade says so rather
    // than resolving them to something plausible.
    expect(upgraded.unmatchedCount).toBeGreaterThan(0);
    expect(verdict.outcome).toBe("boundary_review_malformed");
  });

  it("BOTH measured false positives are refused, and reach no packet", () => {
    if (verdict.outcome !== "boundary_review_malformed") throw new Error("unreachable");
    for (const fp of R236_MEASURED.attempt1.falsePositives) expect(verdict.failedSurfaceRefs).toContain(fp);
    // A malformed outcome produces no correction packet at all, partial matrix or otherwise.
    expect(verdict.derived.every((d) => d.compliance !== "violates")).toBe(true);
  });

  it("the refusals are EARNED — each names a real defect in what the reviewer selected", () => {
    // branch[1].* cited the ANCESTOR PRIMARY as prerequisite-failure proof. An ancestor choice is
    // not a failure source for a descendant, so those references have no candidate.
    const notes = Object.entries(upgraded.notesBySurface).flatMap(([ref, ns]) => ns.map((n) => ({ ref, ...n })));
    const failureMisses = notes.filter((n) => n.role === "prerequisite_failure" && n.outcome === "unmatched");
    expect(failureMisses.length).toBe(4);
    for (const m of failureMisses) expect(m.excerpt).toContain("Notify the families and proceed with one patient");
    // branch[0].resulting_world_state MISQUOTED the scenario ("without compens"), which R2.36 also
    // flagged as `boundary_evidence_excerpt_not_in_segment`. It still finds no candidate.
    const misquote = notes.find((n) => n.ref === "branch[0].resulting_world_state" && n.role === "governed_action");
    expect(misquote?.outcome).toBe("unmatched");
    expect(misquote?.excerpt).toContain("without compens");
  });

  it("its valid rows are preserved for a failed-subset repair, never as a verdict", () => {
    if (verdict.outcome !== "boundary_review_malformed") throw new Error("unreachable");
    expect(verdict.validSurfaceRefs.length).toBeGreaterThan(0);
    expect(verdict.validSurfaceRefs.length + verdict.failedSurfaceRefs.length).toBe(12);
    const plan = planSubsetRepair(verdict);
    expect(plan.repairable).toBe(true);
    if (!plan.repairable) throw new Error("unreachable");
    expect(plan.failedSurfaceRefs.length).toBeLessThan(12);
  });
});

describe("the R2.34 capture still discriminates under candidate authority", () => {
  it("its two false positives find no failure candidate; its two true positives do", () => {
    const { upgraded } = { upgraded: upgradeR236Response(R234_UPGRADED_TO_TRUTH_CONTRACT, candidates) };
    const idOf = (ref: string) => upgraded.assessments.find((a) => a.surfaceRef === ref)!.prerequisiteFailureCandidateId;
    // The delay clause is not an eligible failure span, so neither R2.34 false positive resolves.
    expect(idOf("branch[0].resulting_world_state")).toBe(NO_CANDIDATE);
    expect(idOf("branch[0].action[0]")).toBe(NO_CANDIDATE);
    // The "left the second patient unverified" clause is eligible, so both true positives resolve.
    expect(idOf("branch[1].resulting_world_state")).not.toBe(NO_CANDIDATE);
    expect(idOf("branch[1].action[1]")).not.toBe(NO_CANDIDATE);
  });
});
