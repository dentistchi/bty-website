/**
 * NARROW BOUNDARY STAGE — PIPELINE ORDER AND RERUN AUTHORITY
 * (Slice 3.2I-R5B1A.1-R2.29 Part 18 · PIPELINE).
 *
 * The stage runs BEFORE the broad semantic reviewer and decides whether it runs at all. These tests
 * prove the order and the precedence without a provider: every narrow call is injected.
 */
import { describe, expect, it, vi } from "vitest";
import {
  accumulateBoundaryMetrics,
  boundaryMetricsPass,
  emptyBoundaryMetrics,
  runBoundaryReviewStage,
  surfaceDefectCode,
  type BoundaryStageDeps,
} from "./boundaryReviewStage";
import { narrowBoundarySubjectSha256, type NarrowBoundarySubject } from "./narrowBoundaryContract";
import type { NarrowBoundaryCallResult } from "./narrowBoundaryReviewer";
import { classifyFailure, deriveBoundaryVerdict, type DerivedBoundaryVerdict } from "@/domain/foundry/arena-draft/narrowBoundaryReview";
import { enumerateBoundarySurfaces } from "@/domain/foundry/arena-draft/boundarySurfaces";
import { buildBoundaryProvenance, noBoundaryProvenance } from "@/domain/foundry/arena-draft/boundaryProvenance";
import { draftFixture } from "@/domain/foundry/arena-draft/boundarySurfaces.test";
import { registeredCodes } from "@/domain/foundry/arena-draft/gatePrecedence";
import {
  BOUNDARY_REPORTABLE_OUTCOMES,
  BOUNDARY_STAGE_OUTCOMES as STAGE_OUTCOMES,
  isReportableOutcome,
  renderAllowedOutcomes,
} from "@/domain/foundry/arena-draft/boundaryOutcomes";

const BOUNDARY = { id: "c1_verify", statement: "Two identifiers must be verified before treatment" };
const draft = draftFixture();
const surfaces = enumerateBoundarySurfaces(draft);

const bearingProvenance = buildBoundaryProvenance({
  sourceKind: "canonical_case_input",
  sourceReference: "test",
  sourceSha256: "0".repeat(64),
  available: [{ id: BOUNDARY.id, statement: BOUNDARY.statement, provenance: "manager_entered" }],
  activeIds: [BOUNDARY.id],
  scopeConfirmed: true,
});

const args = (over: Partial<Parameters<typeof runBoundaryReviewStage>[1]> = {}) => ({
  draft,
  constructions: {},
  boundaries: [BOUNDARY],
  boundaryProvenance: bearingProvenance,
  boundaryProvenanceSha256: "p".repeat(64),
  scenarioSha256: "s".repeat(64),
  reviewSubjectSha256: "r".repeat(64),
  language: "en",
  generationAttemptId: "gen1",
  caseId: "c18-constrained-clinical",
  ...over,
});

/** Returns BOTH the parsed rows and the derived verdict, so evidence carries what the model said. */
const responseFor = (subject: NarrowBoundarySubject, mutate: (a: ReturnType<typeof baseAssessments>) => unknown = (a) => a) => {
  const parsed = { assessments: mutate(baseAssessments(subject)) };
  return { parsed, verdict: deriveBoundaryVerdict(parsed, { boundaries: subject.boundaries, surfaces: subject.surfaces }) };
};

/** R2.30 — every reachable surface settles as `not_applicable`, each showing what it does. */
const baseAssessments = (subject: NarrowBoundarySubject) =>
  subject.surfaces.map((s) => ({
    boundaryId: subject.boundaries[0]!.id,
    surfaceRef: s.coordinate,
    applicability: "not_applicable" as const,
    compliance: "not_assessed" as const,
    governedActionEvidence: s.text.slice(0, 100),
    prerequisiteFailureEvidence: "",
    violationMechanism: "none" as const,
    // R2.32 — an EMPTY reason is correct here: the server owns this explanation.
    reason: "",
  }));

/** Turn one surface into a fully grounded violation. */
const asViolation = (subject: NarrowBoundarySubject, ref: string, mechanism = "governed_action_without_prerequisite") =>
  (rows: ReturnType<typeof baseAssessments>) =>
    rows.map((a) => {
      if (a.surfaceRef !== ref) return a;
      const s = subject.surfaces.find((x) => x.coordinate === ref)!;
      return {
        ...a,
        applicability: "applies" as const,
        compliance: "violates" as const,
        governedActionEvidence: s.text.slice(0, 100),
        prerequisiteFailureEvidence: (s.inheritedWorldState || s.text).slice(0, 100),
        violationMechanism: mechanism as "governed_action_without_prerequisite",
        reason: "",
      };
    });

const call = (
  subject: NarrowBoundarySubject,
  attempt: number,
  response: DerivedBoundaryVerdict | { parsed: unknown; verdict: DerivedBoundaryVerdict },
): NarrowBoundaryCallResult => {
  const { parsed, verdict } = "verdict" in response ? response : { parsed: { assessments: [] }, verdict: response };
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
  },
  };
};

const deps = (review: BoundaryStageDeps["review"]): BoundaryStageDeps => ({ review });

describe("[25][26] pipeline order", () => {
  it("runs the narrow boundary review FIRST for a boundary-bearing scenario", async () => {
    const review = vi.fn(async (s: NarrowBoundarySubject, a: number) => call(s, a, responseFor(s)));
    const r = await runBoundaryReviewStage(deps(review), args());
    expect(review).toHaveBeenCalledTimes(1);
    expect(r.outcome).toBe("boundary_review_pass");
    expect(r.calls).toBe(1);
    // R2.30 — only the TWELVE reachable surfaces reach the reviewer.
    expect(r.subject!.surfaces).toHaveLength(12);
    expect(r.subject!.compatibilitySurfaces).toHaveLength(4);
    expect(r.excludedCompatibilitySurfaces).toEqual(["flat_tradeoff[0]", "flat_tradeoff[1]", "flat_action[0]", "flat_action[1]"]);
  });

  it("[26] permits the broad review ONLY after a pass", async () => {
    const r = await runBoundaryReviewStage(deps(async (s, a) => call(s, a, responseFor(s))), args());
    expect(r.broadReviewAllowed).toBe(true);
  });

  it("[24] boundaryMode=none skips the narrow provider call entirely", async () => {
    const review = vi.fn();
    const r = await runBoundaryReviewStage(deps(review as never), args({ boundaries: [], boundaryProvenance: noBoundaryProvenance("c01", "0".repeat(64)) }));
    expect(review).not.toHaveBeenCalled();
    expect(r.outcome).toBe("boundary_review_not_applicable");
    expect(r.calls).toBe(0);
    expect(r.broadReviewAllowed).toBe(true);
  });

  it("[27] a reject SKIPS the broad review", async () => {
    const r = await runBoundaryReviewStage(
      deps(async (s, a) => call(s, a, responseFor(s, asViolation(s, "primary[1]")))),
      args(),
    );
    expect(r.outcome).toBe("boundary_review_reject");
    expect(r.broadReviewAllowed).toBe(false);
  });

  it("[28] an inconclusive SKIPS the broad review", async () => {
    const r = await runBoundaryReviewStage(
      deps(async (s, a) =>
        call(s, a, responseFor(s, (list) => list.map((x) => (x.surfaceRef === "branch[1].tradeoff[1]" ? { ...x, applicability: "uncertain" as const, reason: "the label does not say whether caring means treating" } : x)))),
      ),
      args(),
    );
    expect(r.outcome).toBe("boundary_review_inconclusive");
    expect(r.broadReviewAllowed).toBe(false);
  });

  it("[29] a boundary-bearing mode with no active boundary makes ZERO calls and fails closed", async () => {
    const review = vi.fn();
    const r = await runBoundaryReviewStage(deps(review as never), args({ boundaries: [] }));
    expect(review).not.toHaveBeenCalled();
    expect(r.outcome).toBe("boundary_review_authority_failure");
    expect(r.codes).toContain("boundary_bearing_without_active_boundary");
    expect(r.broadReviewAllowed).toBe(false);
  });

  it("[29b] boundaryMode=none contradicted by an active set makes ZERO calls", async () => {
    const review = vi.fn();
    const r = await runBoundaryReviewStage(deps(review as never), args({ boundaryProvenance: noBoundaryProvenance("c01", "0".repeat(64)) }));
    expect(review).not.toHaveBeenCalled();
    expect(r.outcome).toBe("boundary_review_authority_failure");
    expect(r.codes).toContain("boundary_mode_contradicts_active_set");
  });

  it("refuses a malformed surface map BEFORE any provider call", async () => {
    const broken = draftFixture();
    broken.branches!.p2!.resultingWorldState = "";
    const review = vi.fn();
    const r = await runBoundaryReviewStage(deps(review as never), args({ draft: broken }));
    expect(review).not.toHaveBeenCalled();
    expect(r.outcome).toBe("boundary_review_authority_failure");
    // R2.30 — a missing world state is an AUTHORITY failure, and the escalation is NOT substituted.
    expect(r.codes).toContain("boundary_world_state_missing");
  });
});

describe("[21][22] rerun authority in the stage", () => {
  it("[21] a first malformed response is rerun over the identical subject, exactly once", async () => {
    const seen: string[] = [];
    const review = vi.fn(async (s: NarrowBoundarySubject, a: number) => {
      seen.push(narrowBoundarySubjectSha256(s));
      return a === 1
        ? call(s, a, { outcome: "boundary_review_malformed" as const, codes: ["boundary_review_missing_pair"], findings: [], failureClass: classifyFailure(["boundary_review_missing_pair"]) })
        : call(s, a, responseFor(s, asViolation(s, "primary[1]")));
    });
    const r = await runBoundaryReviewStage(deps(review), args());
    expect(review).toHaveBeenCalledTimes(2);
    expect(seen[0]).toBe(seen[1]); // [15] the SAME frozen subject
    expect(r.outcome).toBe("boundary_review_reject");
    expect(r.reruns).toBe(1);
    expect(r.calls).toBe(2);
  });

  it("[22] two malformed responses → terminal reviewer failure, and never a third call", async () => {
    const review = vi.fn(async (s: NarrowBoundarySubject, a: number) =>
      call(s, a, { outcome: "boundary_review_malformed" as const, codes: ["boundary_evidence_ungrounded"], findings: [], failureClass: classifyFailure(["boundary_evidence_ungrounded"]) }),
    );
    const r = await runBoundaryReviewStage(deps(review), args());
    expect(review).toHaveBeenCalledTimes(2);
    expect(r.outcome).toBe("boundary_reviewer_terminal_failure");
    expect(r.broadReviewAllowed).toBe(false);
  });

  it("a transport failure is terminal and never a scenario verdict", async () => {
    const review = vi.fn(async (s: NarrowBoundarySubject, a: number) => ({
      kind: "transport_failed" as const,
      evidence: call(s, a, { outcome: "boundary_review_malformed" as const, codes: ["boundary_review_not_json"], findings: [], failureClass: classifyFailure(["boundary_review_not_json"]) }).evidence,
    }));
    const r = await runBoundaryReviewStage(deps(review), args());
    expect(review).toHaveBeenCalledTimes(1);
    expect(r.outcome).toBe("boundary_reviewer_terminal_failure");
  });
});

describe("correction-packet authority", () => {
  it("maps each violating surface to a REGISTERED boundary defect code", () => {
    expect(surfaceDefectCode(surfaces.find((s) => s.coordinate === "primary[1]"))).toBe("choice_bypasses_boundary");
    expect(surfaceDefectCode(surfaces.find((s) => s.coordinate === "flat_action[1]"))).toBe("action_reopens_boundary");
    expect(surfaceDefectCode(surfaces.find((s) => s.coordinate === "branch[1].resulting_world_state"))).toBe("branch_drops_boundary");
    const codes = registeredCodes();
    for (const c of ["choice_bypasses_boundary", "action_reopens_boundary", "branch_drops_boundary"]) {
      expect(JSON.stringify(codes)).toContain(c);
    }
  });

  it("produces server-authored findings carrying the coordinate and the grounded evidence", async () => {
    const r = await runBoundaryReviewStage(
      deps(async (s, a) => call(s, a, responseFor(s, asViolation(s, "branch[1].resulting_world_state", "resulting_state_missing_prerequisite")))),
      args(),
    );
    expect(r.findings).toHaveLength(1);
    expect(r.findings[0]).toMatchObject({ code: "branch_drops_boundary", gate: "narrow_boundary_review", boundaryId: "c1_verify", branchIndex: 1 });
    expect(r.findings[0]!.detail).toContain("branch[1].resulting_world_state");
    expect(r.findings[0]!.detail).toContain("resulting_state_missing_prerequisite");
    expect(r.findings[0]!.detail).toContain("remains unverified");
  });

  it("an inconclusive or malformed result produces NO correction findings — no blind rewrite", async () => {
    const inconclusive = await runBoundaryReviewStage(
      deps(async (s, a) =>
        call(s, a, responseFor(s, (l) => l.map((x) => (x.surfaceRef === "primary[0]" ? { ...x, applicability: "uncertain" as const, reason: "the label does not settle whether it treats" } : x)))),
      ),
      args(),
    );
    expect(inconclusive.findings).toEqual([]);
    const malformed = await runBoundaryReviewStage(
      deps(async (s, a) => call(s, a, { outcome: "boundary_review_malformed" as const, codes: ["boundary_review_missing_pair"], findings: [], failureClass: classifyFailure(["boundary_review_missing_pair"]) })),
      args(),
    );
    expect(malformed.findings).toEqual([]);
  });
});

describe("aggregate metrics", () => {
  it("counts calls, reruns and outcomes, and fails the hard gate on any terminal or ungrounded result", async () => {
    let m = emptyBoundaryMetrics();
    const pass = await runBoundaryReviewStage(deps(async (s, a) => call(s, a, responseFor(s))), args());
    m = accumulateBoundaryMetrics(m, pass);
    expect(m).toMatchObject({
      boundaryReviewCallCount: 1,
      boundaryReviewPassCount: 1,
      broadReviewSkippedByBoundaryCount: 0,
      // R2.30 — twelve reachable surfaces reviewed, four compatibility projections excluded.
      reachableSurfaceCount: 12,
      compatibilitySurfaceCount: 4,
      notApplicableSurfaceCount: 12,
      complianceViolationCount: 0,
      // R2.32 — twelve server-rendered explanations, and no model prose was required or missing.
      serverDerivedExplanationCount: 12,
      modelReasonRequiredCount: 0,
      modelReasonMissingCount: 0,
      modelReasonUnexpectedCount: 0,
      boundaryOutputContractFailureCount: 0,
    });
    expect(boundaryMetricsPass(m)).toBe(true);

    const ungrounded = await runBoundaryReviewStage(
      deps(async (s, a) => call(s, a, { outcome: "boundary_review_malformed" as const, codes: ["boundary_evidence_ungrounded"], findings: [], failureClass: classifyFailure(["boundary_evidence_ungrounded"]) })),
      args(),
    );
    m = accumulateBoundaryMetrics(m, ungrounded);
    expect(m.boundaryEvidenceUngroundedCount).toBeGreaterThan(0);
    expect(m.boundaryReviewerTerminalFailureCount).toBe(1);
    expect(m.broadReviewSkippedByBoundaryCount).toBe(1);
    expect(boundaryMetricsPass(m)).toBe(false);
  });
});

describe("[R2.32] reason parity, explanations and the output-contract subcode", () => {
  /** A response that omits a reason the parity table genuinely requires. */
  const missingRequiredReason = (s: NarrowBoundarySubject) =>
    responseFor(s, (l) =>
      l.map((x) => (x.surfaceRef === "branch[1].tradeoff[1]" ? { ...x, applicability: "uncertain" as const, reason: "" } : x)),
    );

  it("an EMPTY reason in a server-derived state is valid and produces a pass", async () => {
    const r = await runBoundaryReviewStage(deps(async (s, a) => call(s, a, responseFor(s))), args());
    expect(r.outcome).toBe("boundary_review_pass");
    expect(r.outputContractFailure).toBe(false);
    expect(r.explanations).toHaveLength(12);
    expect(r.explanationSha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it("[4][14][15][16] a missing REQUIRED reason reruns once, then terminates with the subcode", async () => {
    const review = vi.fn(async (s: NarrowBoundarySubject, a: number) => call(s, a, missingRequiredReason(s)));
    const r = await runBoundaryReviewStage(deps(review), args());
    expect(review).toHaveBeenCalledTimes(2); // one rerun, never a third
    expect(r.outcome).toBe("boundary_reviewer_terminal_failure");
    // The terminal CLASS is preserved; the precise SUBCODE travels with it.
    expect(r.outputContractFailure).toBe(true);
    expect(r.codes).toContain("boundary_output_contract_failure");
    expect(r.evidences.every((e) => e.verdict.outcome === "boundary_review_malformed" && e.verdict.failureClass === "output_contract")).toBe(true);
  });

  it("counts required / missing / unexpected model reasons per attempt", async () => {
    const r = await runBoundaryReviewStage(deps(async (s, a) => call(s, a, missingRequiredReason(s))), args());
    expect(r.modelReasonRequiredCount).toBe(1);
    expect(r.modelReasonMissingCount).toBe(1);
    expect(r.modelReasonUnexpectedCount).toBe(0);
  });

  it("[7] prose where the server owns the explanation is IGNORED but COUNTED as drift", async () => {
    const withProse = (s: NarrowBoundarySubject) =>
      responseFor(s, (l) => l.map((x) => ({ ...x, reason: "This surface does something else: it prepares a report." })));
    const r = await runBoundaryReviewStage(deps(async (s, a) => call(s, a, withProse(s))), args());
    expect(r.outcome).toBe("boundary_review_pass"); // never a failure
    expect(r.modelReasonUnexpectedCount).toBe(12);
    expect(r.modelReasonRequiredCount).toBe(0);
  });

  it("an output-contract failure fails the stability hard gate on its own", async () => {
    let m = emptyBoundaryMetrics();
    const r = await runBoundaryReviewStage(deps(async (s, a) => call(s, a, missingRequiredReason(s))), args());
    m = accumulateBoundaryMetrics(m, r);
    expect(m.boundaryOutputContractFailureCount).toBe(2);
    expect(boundaryMetricsPass(m)).toBe(false);
  });

  it("a grounding failure is NOT classified as an output-contract failure", async () => {
    const ungrounded = (s: NarrowBoundarySubject) =>
      responseFor(s, (l) => l.map((x) => (x.surfaceRef === "primary[0]" ? { ...x, governedActionEvidence: "invented text nobody wrote" } : x)));
    const r = await runBoundaryReviewStage(deps(async (s, a) => call(s, a, ungrounded(s))), args());
    expect(r.outputContractFailure).toBe(false);
    expect(r.codes).not.toContain("boundary_output_contract_failure");
  });
});

describe("[18][22] canonical outcome enumeration", () => {
  it("every stage outcome is reportable, including the terminal failure R2.30 printed without", () => {
    for (const o of STAGE_OUTCOMES) expect(BOUNDARY_REPORTABLE_OUTCOMES).toContain(o);
    expect(BOUNDARY_REPORTABLE_OUTCOMES).toContain("boundary_reviewer_terminal_failure");
    expect(BOUNDARY_REPORTABLE_OUTCOMES).toContain("boundary_output_contract_failure");
    expect(isReportableOutcome("boundary_reviewer_terminal_failure")).toBe(true);
    expect(isReportableOutcome("not_a_real_outcome")).toBe(false);
  });

  it("the rendered list covers the whole enumeration", () => {
    const rendered = renderAllowedOutcomes().join(" | ");
    for (const o of BOUNDARY_REPORTABLE_OUTCOMES) expect(rendered).toContain(o);
  });
});
