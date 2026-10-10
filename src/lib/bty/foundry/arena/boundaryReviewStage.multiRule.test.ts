import { describe, expect, it } from "vitest";
import { runBoundaryReviewStage, type BoundaryStageDeps } from "./boundaryReviewStage";
import { narrowBoundarySubjectSha256, type NarrowBoundarySubject } from "./narrowBoundaryContract";
import type { FieldRepairCallResult, NarrowBoundaryCallResult } from "./narrowBoundaryReviewer";
import { deriveBoundaryVerdict, type BoundaryTruthAssessment } from "@/domain/foundry/arena-draft/narrowBoundaryReview";
import { buildBoundaryProvenance } from "@/domain/foundry/arena-draft/boundaryProvenance";
import { buildSemanticFrames } from "@/domain/foundry/arena-draft/boundarySemanticFrame";
import { emptyTransportEvidence } from "@/domain/foundry/arena-draft/boundaryTransportEvidence";
import { poolFor } from "@/domain/foundry/arena-draft/boundaryEvidenceCandidates";
import { NO_CANDIDATE } from "@/domain/foundry/arena-draft/boundaryTruthContractTypes";
import { TWO_RULE_BOUNDARIES, TWO_RULE_SCENARIO, perfectAssessments } from "@/domain/foundry/arena-draft/twoRuleBoundaryFixture";

/**
 * THE af921b9d STAGE PATH, end to end, with the provider replaced by doubles.
 *
 * Production (attempt 73f54c71, deploy 0c2e92c6) recorded: generation → boundary_review →
 * boundary_repair → terminal `boundary_repair_validation_failed`. Before the fix, these doubles
 * reproduce that exact terminal diagnostic from a reviewer that answered CORRECTLY.
 */

const provenance = buildBoundaryProvenance({
  sourceKind: "canonical_case_input",
  sourceReference: "test",
  sourceSha256: "0".repeat(64),
  available: TWO_RULE_BOUNDARIES.map((b) => ({ id: b.id, statement: b.statement, provenance: "manager_entered" as const })),
  activeIds: TWO_RULE_BOUNDARIES.map((b) => b.id),
  scopeConfirmed: true,
});

const args = {
  draft: TWO_RULE_SCENARIO,
  constructions: {},
  boundaries: TWO_RULE_BOUNDARIES,
  boundaryProvenance: provenance,
  boundaryProvenanceSha256: "p".repeat(64),
  scenarioSha256: "s".repeat(64),
  reviewSubjectSha256: "r".repeat(64),
  language: "en",
  generationAttemptId: "gen1",
  caseId: "two-rule",
};

const transport = () => ({
  ...emptyTransportEvidence("test"),
  requestConstructed: true,
  clientInvocationStarted: true,
  providerInvocationStarted: true,
  latencyMs: 1,
  responseState: "response_received" as const,
  responseEnvelopePresent: true,
  structuredOutputPresent: true,
  timeoutState: "armed_not_fired" as const,
  timeoutOwner: "test",
  evidenceSource: "structured" as const,
});

const ctxOf = (s: NarrowBoundarySubject) => ({ boundaries: TWO_RULE_BOUNDARIES, surfaces: s.surfaces, frames: buildSemanticFrames(TWO_RULE_BOUNDARIES), candidates: s.evidenceCandidates });

/** The reviewer double: derives the verdict exactly as `narrowBoundaryReviewer` does in production. */
const reviewWith =
  (rowsFor: (s: NarrowBoundarySubject) => BoundaryTruthAssessment[]): BoundaryStageDeps["review"] =>
  async (subject, attempt) => {
    const parsed = { assessments: rowsFor(subject) };
    const verdict = deriveBoundaryVerdict(parsed, ctxOf(subject));
    return {
      kind: "derived",
      verdict,
      evidence: {
        boundaryReviewAttempt: attempt,
        boundaryReviewSubjectSha256: narrowBoundarySubjectSha256(subject),
        surfaceMapSha256: subject.surfaceMapSha256,
        activeBoundaryIds: subject.activeBoundaryIds,
        requiredAssessmentCount: subject.boundaries.length * subject.surfaces.length,
        parsed,
        outcome: verdict.outcome,
        verdict,
        finishReason: "stop",
        latencyMs: 1,
        sanitizedError: null,
        transport: transport(),
        providerFailureCode: null,
      },
    } as NarrowBoundaryCallResult;
  };

/** What the reviewer's own (correct) answer means — the verdict the stage must report, not a system failure. */
const correctVerdict = () => (s: NarrowBoundarySubject): string => deriveBoundaryVerdict({ assessments: perfectAssessments(s) }, ctxOf(s)).outcome;

const patchOf = (raw: unknown, subject: NarrowBoundarySubject, attempt: number): FieldRepairCallResult => ({
  kind: "patch",
  raw,
  evidence: {
    boundaryReviewAttempt: attempt,
    boundaryReviewSubjectSha256: narrowBoundarySubjectSha256(subject),
    repairPlanSha256: "",
    requiredOperationCount: 0,
    request: null,
    parsed: raw,
    finishReason: "stop",
    latencyMs: 1,
    sanitizedError: null,
    transport: transport(),
    providerFailureCode: null,
    parseFailed: false,
  },
});

describe("[af921b9d stage] two confirmed rules", () => {
  it("S1 a CORRECT reviewer answer is judged on its content on the first call — no repair, no system failure", async () => {
    let repairs = 0;
    let expected = "";
    const judge = correctVerdict();
    const r = await runBoundaryReviewStage(
      {
        review: reviewWith((s) => {
          expected = judge(s);
          return perfectAssessments(s);
        }),
        repair: async () => {
          repairs++;
          throw new Error("repair must not run");
        },
      },
      args,
    );
    expect(r.terminalDiagnostic ?? null).toBeNull();
    expect(r.outcome).not.toBe("boundary_reviewer_terminal_failure");
    // The correct answer is well-formed: whatever it concludes, it is a content verdict.
    expect(expected).not.toBe("boundary_review_malformed");
    expect(r.outcome).toBe(expected);
    expect(repairs).toBe(0);
  });

  it("S2 a genuine slip on ONE rule is repaired by the correct patch, then judged exactly like the correct answer", async () => {
    let slipSurface = "";
    let correct = "";
    let expected = "";
    const judge = correctVerdict();
    const r = await runBoundaryReviewStage(
      {
        review: reviewWith((s) => {
          expected = judge(s);
          const rows = perfectAssessments(s);
          const C1 = TWO_RULE_BOUNDARIES[0]!.id;
          const i = rows.findIndex(
            (x) => x.boundaryId === C1 && x.governedActionCandidateId !== NO_CANDIDATE && poolFor(s.evidenceCandidates, C1, x.surfaceRef, "prerequisite_satisfaction").length > 0,
          );
          slipSurface = rows[i]!.surfaceRef;
          correct = rows[i]!.governedActionCandidateId;
          const wrongRole = poolFor(s.evidenceCandidates, C1, slipSurface, "prerequisite_satisfaction")[0]!.candidateId;
          return rows.map((x, j) => (j === i ? { ...x, governedActionCandidateId: wrongRole } : x));
        }),
        repair: async (subject, _plan, attempt) =>
          patchOf({ repairs: [{ surfaceRef: slipSurface, field: "governedActionCandidateId", value: correct }], groupSelections: [] }, subject, attempt),
      },
      args,
    );
    expect(r.terminalDiagnostic ?? null).toBeNull();
    expect(r.outcome).not.toBe("boundary_reviewer_terminal_failure");
    expect(r.outcome).toBe(expected);
  });
});

describe("[af921b9d stage] the terminal exit names what the validators refused", () => {
  /** Both rules misjudge the SAME surface the same way — natural for two near-duplicate rules. */
  const sameSlipOnBothRules = (s: NarrowBoundarySubject) => {
    const rows = perfectAssessments(s);
    const surface = rows.find(
      (r) =>
        r.governedActionCandidateId !== NO_CANDIDATE &&
        TWO_RULE_BOUNDARIES.every(
          (b) =>
            rows.some((x) => x.boundaryId === b.id && x.surfaceRef === r.surfaceRef && x.governedActionCandidateId !== NO_CANDIDATE) &&
            poolFor(s.evidenceCandidates, b.id, r.surfaceRef, "prerequisite_satisfaction").length > 0,
        ),
    )!.surfaceRef;
    return rows.map((r) =>
      r.surfaceRef === surface && r.governedActionCandidateId !== NO_CANDIDATE
        ? { ...r, governedActionCandidateId: poolFor(s.evidenceCandidates, r.boundaryId, surface, "prerequisite_satisfaction")[0]!.candidateId }
        : r,
    );
  };

  it("S3 same slip on both rules → no patch (ambiguous) → full re-review repeats it → terminal, and the codes say so", async () => {
    let repairs = 0;
    const r = await runBoundaryReviewStage(
      {
        review: reviewWith(sameSlipOnBothRules),
        repair: async () => {
          repairs++;
          throw new Error("an unaddressable patch must never be requested");
        },
      },
      args,
    );
    expect(repairs).toBe(0);
    expect(r.outcome).toBe("boundary_reviewer_terminal_failure");
    expect(r.terminalDiagnostic?.code).toBe("boundary_review_validation_failed");
    expect(r.diagnosticCodes).toEqual([
      "r1_boundary_candidate_wrong_role",
      "fp_field_repair_ambiguous_rule_target",
      "r2_boundary_candidate_wrong_role",
    ]);
  });

  it("S4 a refused patch names its own refusal under fr_", async () => {
    const r = await runBoundaryReviewStage(
      {
        review: reviewWith((s) => {
          const rows = perfectAssessments(s);
          const C1 = TWO_RULE_BOUNDARIES[0]!.id;
          const i = rows.findIndex(
            (x) => x.boundaryId === C1 && x.governedActionCandidateId !== NO_CANDIDATE && poolFor(s.evidenceCandidates, C1, x.surfaceRef, "prerequisite_satisfaction").length > 0,
          );
          const wrongRole = poolFor(s.evidenceCandidates, C1, rows[i]!.surfaceRef, "prerequisite_satisfaction")[0]!.candidateId;
          return rows.map((x, j) => (j === i ? { ...x, governedActionCandidateId: wrongRole } : x));
        }),
        // An empty patch: the model answered nothing the plan asked for.
        repair: async (subject, _plan, attempt) => patchOf({ repairs: [], groupSelections: [] }, subject, attempt),
      },
      args,
    );
    expect(r.outcome).toBe("boundary_reviewer_terminal_failure");
    expect(r.terminalDiagnostic?.code).toBe("boundary_repair_validation_failed");
    expect(r.diagnosticCodes[0]).toBe("r1_boundary_candidate_wrong_role");
    expect(r.diagnosticCodes).toContain("fr_field_repair_operation_missing");
    for (const c of r.diagnosticCodes) expect(c).toMatch(/^(r1|fp|fr|r2)_[a-z0-9_]+$/);
  });

  it("S5 a review judged on its content (no malformed call) carries no diagnostic codes", async () => {
    const r = await runBoundaryReviewStage({ review: reviewWith((s) => perfectAssessments(s)), repair: async () => { throw new Error("unused"); } }, args);
    expect(r.terminalDiagnostic ?? null).toBeNull();
    expect(r.diagnosticCodes).toEqual([]);
  });
});
