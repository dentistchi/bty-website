import { describe, it, expect } from "vitest";
import { validateNarrowBoundaryReview, type BoundaryTruthAssessment } from "./narrowBoundaryReview";
import { applyFieldRepair, planFieldRepair } from "./boundaryFieldRepair";
import { poolFor } from "./boundaryEvidenceCandidates";
import { NO_CANDIDATE } from "./boundaryTruthContractTypes";
import { TWO_RULE_BOUNDARIES, perfectAssessments, twoRuleContext, twoRuleDigests, twoRuleSubject } from "./twoRuleBoundaryFixture";

/**
 * MULTI-RULE BOUNDARY IDENTITY — the af921b9d failure.
 *
 * "Opening the Office Safely" is the first Practice with TWO confirmed rules. Every generation of it
 * that reached boundary review ended in `boundary_repair_validation_failed`, the latest on
 * 2026-10-09 (attempt 73f54c71, deploy 0c2e92c6). Production keeps no scenario or reviewer content,
 * so the exact run cannot be replayed; these tests rebuild the condition from the real rule text and
 * a representative scenario (see `twoRuleBoundaryFixture.ts`).
 *
 * Two defects, both invisible with one rule:
 *
 *  1. Evidence candidate ids are `${surface}-${role}${n}` — the same ids are issued to EVERY rule on
 *     a surface — and the index was `Map<candidateId, candidate>`, so the last rule overwrote the
 *     first. A reviewer citing rule 1's own candidate was refused `boundary_candidate_wrong_boundary`.
 *
 *  2. The field-repair layer identified a row by `surfaceRef` alone. With two rules there are two rows
 *     per surface: the plan targeted the wrong rule's row and the merge's base-row digest check
 *     collided, so every repair ended `field_repair_base_row_digest_mismatch` — reported upstream as
 *     `boundary_repair_validation_failed`.
 */

const subject = twoRuleSubject();
const ctx = twoRuleContext(subject);
const digests = twoRuleDigests(subject);
const C1 = TWO_RULE_BOUNDARIES[0]!.id;
const C2 = TWO_RULE_BOUNDARIES[1]!.id;

describe("[multi-rule · P] the precondition is real", () => {
  it("P1 the two rules really are issued the same candidate ids on the same surfaces", () => {
    const ids = (b: string) => new Set(subject.evidenceCandidates.filter((c) => c.boundaryId === b).map((c) => c.candidateId));
    const shared = [...ids(C1)].filter((id) => ids(C2).has(id));
    expect(shared.length).toBeGreaterThan(0);
  });

  it("P2 the correct answer covers every (rule, surface) cell", () => {
    expect(perfectAssessments(subject)).toHaveLength(TWO_RULE_BOUNDARIES.length * subject.surfaces.length);
  });
});

describe("[multi-rule · V] a correct reviewer answer is accepted", () => {
  it("V1 citing each rule's OWN candidates validates — no spurious wrong_boundary", () => {
    const v = validateNarrowBoundaryReview({ assessments: perfectAssessments(subject) }, ctx);
    const findings = v.ok ? [] : (v as { findings: Array<{ code: string }> }).findings.map((f) => f.code);
    expect(findings).toEqual([]);
    expect(v.ok).toBe(true);
  });

  it("V2 citing the OTHER rule's candidate is still refused as wrong_boundary", () => {
    const rows = perfectAssessments(subject);
    // A c1 row that cites an id only c2 was issued on that surface.
    const target = rows.find((r) => {
      if (r.boundaryId !== C1 || r.governedActionCandidateId === NO_CANDIDATE) return false;
      const own = new Set(poolFor(subject.evidenceCandidates, C1, r.surfaceRef, "governed_action").map((c) => c.candidateId));
      return poolFor(subject.evidenceCandidates, C2, r.surfaceRef, "governed_action").some((c) => !own.has(c.candidateId));
    });
    if (!target) return; // the fixture offers no c2-only id; V3 covers the unknown path
    const own = new Set(poolFor(subject.evidenceCandidates, C1, target.surfaceRef, "governed_action").map((c) => c.candidateId));
    const foreign = poolFor(subject.evidenceCandidates, C2, target.surfaceRef, "governed_action").find((c) => !own.has(c.candidateId))!.candidateId;
    const v = validateNarrowBoundaryReview({ assessments: rows.map((r) => (r === target ? { ...r, governedActionCandidateId: foreign } : r)) }, ctx);
    expect(v.ok).toBe(false);
    expect((v as { findings: Array<{ code: string; boundaryId: string }> }).findings).toContainEqual(
      expect.objectContaining({ code: "boundary_candidate_wrong_boundary", boundaryId: C1 }),
    );
  });

  it("V3 an id nobody issued is still unknown", () => {
    const rows = perfectAssessments(subject);
    const i = rows.findIndex((r) => r.governedActionCandidateId !== NO_CANDIDATE);
    const v = validateNarrowBoundaryReview({ assessments: rows.map((r, j) => (j === i ? { ...r, governedActionCandidateId: "99-a9" } : r)) }, ctx);
    expect((v as { findings: Array<{ code: string }> }).findings.map((f) => f.code)).toContain("boundary_candidate_unknown");
  });
});

describe("[multi-rule · R] a genuine reviewer slip on one rule is repairable", () => {
  /** Rule 1's row on some surface cites a candidate from the wrong ROLE — a real, field-local defect. */
  const withSlip = (): { rows: BoundaryTruthAssessment[]; slipped: BoundaryTruthAssessment } => {
    const rows = perfectAssessments(subject);
    const i = rows.findIndex(
      (r) => r.boundaryId === C1 && r.governedActionCandidateId !== NO_CANDIDATE && poolFor(subject.evidenceCandidates, C1, r.surfaceRef, "prerequisite_satisfaction").length > 0,
    );
    const wrongRole = poolFor(subject.evidenceCandidates, C1, rows[i]!.surfaceRef, "prerequisite_satisfaction")[0]!.candidateId;
    const slipped = { ...rows[i]!, governedActionCandidateId: wrongRole };
    return { rows: rows.map((r, j) => (j === i ? slipped : r)), slipped };
  };

  it("R1 the plan targets the slipped rule's row, not the other rule's row on that surface", () => {
    const { rows, slipped } = withSlip();
    const plan = planFieldRepair(rows, ctx, digests);
    expect(plan.repairable).toBe(true);
    expect(plan.targets.map((t) => [t.boundaryId, t.surfaceRef, t.field])).toEqual([[C1, slipped.surfaceRef, "governedActionCandidateId"]]);
  });

  it("R2 the correct patch is accepted, merges, and the merged matrix validates", () => {
    const { rows, slipped } = withSlip();
    const plan = planFieldRepair(rows, ctx, digests);
    const correct = poolFor(subject.evidenceCandidates, C1, slipped.surfaceRef, "governed_action")[0]!.candidateId;
    const app = applyFieldRepair({ repairs: [{ surfaceRef: slipped.surfaceRef, field: "governedActionCandidateId", value: correct }], groupSelections: [] }, rows, plan, ctx, digests);
    expect(app.validation.ok).toBe(true);
    expect(app.merge.codes).toEqual([]);
    expect(app.merge.ok).toBe(true);
    if (!app.merge.ok) return;
    // Only the slipped row moved; the other rule's row on the same surface is byte-identical.
    const other = rows.find((r) => r.boundaryId === C2 && r.surfaceRef === slipped.surfaceRef)!;
    expect(app.merge.rows.find((r) => r.boundaryId === C2 && r.surfaceRef === slipped.surfaceRef)).toEqual(other);
    expect(app.merge.rows.find((r) => r.boundaryId === C1 && r.surfaceRef === slipped.surfaceRef)!.governedActionCandidateId).toBe(correct);
    expect(validateNarrowBoundaryReview({ assessments: app.merge.rows }, ctx).ok).toBe(true);
  });

  it("R3 a patch addressing a surface whose row did not slip is still refused", () => {
    const { rows, slipped } = withSlip();
    const plan = planFieldRepair(rows, ctx, digests);
    const elsewhere = subject.surfaces.map((s) => s.coordinate).find((c) => c !== slipped.surfaceRef)!;
    const app = applyFieldRepair({ repairs: [{ surfaceRef: elsewhere, field: "governedActionCandidateId", value: NO_CANDIDATE }], groupSelections: [] }, rows, plan, ctx, digests);
    expect(app.validation.ok).toBe(false);
  });
});

describe("[multi-rule · A] a patch that cannot say which rule it means is never sent", () => {
  it("A1 both rules slipping on the SAME surface and field → not repairable (the patch DTO carries no rule id)", () => {
    const rows = perfectAssessments(subject);
    const surface = rows.find(
      (r) =>
        r.boundaryId === C1 &&
        r.governedActionCandidateId !== NO_CANDIDATE &&
        rows.some((o) => o.boundaryId === C2 && o.surfaceRef === r.surfaceRef && o.governedActionCandidateId !== NO_CANDIDATE),
    )!.surfaceRef;
    const broken = rows.map((r) => (r.surfaceRef === surface && r.governedActionCandidateId !== NO_CANDIDATE ? { ...r, governedActionCandidateId: "99-a9" } : r));
    const plan = planFieldRepair(broken, ctx, digests);
    expect(plan.repairable).toBe(false);
    expect(plan.because).toBe("field_repair_ambiguous_rule_target");
  });
});
