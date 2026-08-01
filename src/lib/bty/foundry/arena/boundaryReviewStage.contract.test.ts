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
import { deriveBoundaryVerdict, type DerivedBoundaryVerdict } from "@/domain/foundry/arena-draft/narrowBoundaryReview";
import { enumerateBoundarySurfaces } from "@/domain/foundry/arena-draft/boundarySurfaces";
import { buildBoundaryProvenance, noBoundaryProvenance } from "@/domain/foundry/arena-draft/boundaryProvenance";
import { draftFixture } from "@/domain/foundry/arena-draft/boundarySurfaces.test";
import { registeredCodes } from "@/domain/foundry/arena-draft/gatePrecedence";

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

const responseFor = (subject: NarrowBoundarySubject, mutate: (a: ReturnType<typeof baseAssessments>) => unknown = (a) => a) => {
  const parsed = { assessments: mutate(baseAssessments(subject)) };
  return deriveBoundaryVerdict(parsed, { boundaries: subject.boundaries, surfaces: subject.surfaces });
};

const baseAssessments = (subject: NarrowBoundarySubject) =>
  subject.surfaces.map((s) => ({
    boundaryId: subject.boundaries[0]!.id,
    surfaceRef: s.coordinate,
    result: "complies" as const,
    evidenceExcerpt: s.text.slice(0, 100),
    reason: "keeps the rule",
  }));

const call = (subject: NarrowBoundarySubject, attempt: number, verdict: DerivedBoundaryVerdict): NarrowBoundaryCallResult => ({
  kind: "derived",
  verdict,
  evidence: {
    boundaryReviewAttempt: attempt,
    boundaryReviewSubjectSha256: narrowBoundarySubjectSha256(subject),
    surfaceMapSha256: subject.surfaceMapSha256,
    activeBoundaryIds: subject.activeBoundaryIds,
    requiredAssessmentCount: subject.boundaries.length * subject.surfaces.length,
    parsed: { assessments: [] },
    outcome: verdict.outcome,
    verdict,
    finishReason: "stop",
    latencyMs: 1,
    sanitizedError: null,
  },
});

const deps = (review: BoundaryStageDeps["review"]): BoundaryStageDeps => ({ review });

describe("[25][26] pipeline order", () => {
  it("runs the narrow boundary review FIRST for a boundary-bearing scenario", async () => {
    const review = vi.fn(async (s: NarrowBoundarySubject, a: number) => call(s, a, responseFor(s)));
    const r = await runBoundaryReviewStage(deps(review), args());
    expect(review).toHaveBeenCalledTimes(1);
    expect(r.outcome).toBe("boundary_review_pass");
    expect(r.calls).toBe(1);
    expect(r.subject!.surfaces).toHaveLength(16);
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
      deps(async (s, a) => call(s, a, responseFor(s, (list) => list.map((x) => (x.surfaceRef === "primary[1]" ? { ...x, result: "violates" as const } : x))))),
      args(),
    );
    expect(r.outcome).toBe("boundary_review_reject");
    expect(r.broadReviewAllowed).toBe(false);
  });

  it("[28] an inconclusive SKIPS the broad review", async () => {
    const r = await runBoundaryReviewStage(
      deps(async (s, a) => call(s, a, responseFor(s, (list) => list.map((x) => (x.surfaceRef === "flat_action[1]" ? { ...x, result: "uncertain" as const } : x))))),
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
    broken.branches!.p2!.escalationText = "";
    const review = vi.fn();
    const r = await runBoundaryReviewStage(deps(review as never), args({ draft: broken }));
    expect(review).not.toHaveBeenCalled();
    expect(r.outcome).toBe("boundary_review_authority_failure");
    expect(r.codes).toContain("surface_map_missing_world_state");
  });
});

describe("[21][22] rerun authority in the stage", () => {
  it("[21] a first malformed response is rerun over the identical subject, exactly once", async () => {
    const seen: string[] = [];
    const review = vi.fn(async (s: NarrowBoundarySubject, a: number) => {
      seen.push(narrowBoundarySubjectSha256(s));
      return a === 1
        ? call(s, a, { outcome: "boundary_review_malformed", codes: ["boundary_review_missing_pair"], findings: [] })
        : call(s, a, responseFor(s, (l) => l.map((x) => (x.surfaceRef === "primary[1]" ? { ...x, result: "violates" as const } : x))));
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
      call(s, a, { outcome: "boundary_review_malformed", codes: ["boundary_evidence_ungrounded"], findings: [] }),
    );
    const r = await runBoundaryReviewStage(deps(review), args());
    expect(review).toHaveBeenCalledTimes(2);
    expect(r.outcome).toBe("boundary_reviewer_terminal_failure");
    expect(r.broadReviewAllowed).toBe(false);
  });

  it("a transport failure is terminal and never a scenario verdict", async () => {
    const review = vi.fn(async (s: NarrowBoundarySubject, a: number) => ({
      kind: "transport_failed" as const,
      evidence: call(s, a, { outcome: "boundary_review_malformed", codes: ["boundary_review_not_json"], findings: [] }).evidence,
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
      deps(async (s, a) =>
        call(s, a, responseFor(s, (l) => l.map((x) => (x.surfaceRef === "branch[1].resulting_world_state" ? { ...x, result: "violates" as const } : x)))),
      ),
      args(),
    );
    expect(r.findings).toHaveLength(1);
    expect(r.findings[0]).toMatchObject({ code: "branch_drops_boundary", gate: "narrow_boundary_review", boundaryId: "c1_verify", branchIndex: 1 });
    expect(r.findings[0]!.detail).toContain("branch[1].resulting_world_state");
    expect(r.findings[0]!.detail).toContain("remains unverified");
  });

  it("an inconclusive or malformed result produces NO correction findings — no blind rewrite", async () => {
    const inconclusive = await runBoundaryReviewStage(
      deps(async (s, a) => call(s, a, responseFor(s, (l) => l.map((x) => (x.surfaceRef === "primary[0]" ? { ...x, result: "uncertain" as const } : x))))),
      args(),
    );
    expect(inconclusive.findings).toEqual([]);
    const malformed = await runBoundaryReviewStage(
      deps(async (s, a) => call(s, a, { outcome: "boundary_review_malformed", codes: ["boundary_review_missing_pair"], findings: [] })),
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
    expect(m).toMatchObject({ boundaryReviewCallCount: 1, boundaryReviewPassCount: 1, broadReviewSkippedByBoundaryCount: 0 });
    expect(boundaryMetricsPass(m)).toBe(true);

    const ungrounded = await runBoundaryReviewStage(
      deps(async (s, a) => call(s, a, { outcome: "boundary_review_malformed", codes: ["boundary_evidence_ungrounded"], findings: [] })),
      args(),
    );
    m = accumulateBoundaryMetrics(m, ungrounded);
    expect(m.boundaryEvidenceUngroundedCount).toBeGreaterThan(0);
    expect(m.boundaryReviewerTerminalFailureCount).toBe(1);
    expect(m.broadReviewSkippedByBoundaryCount).toBe(1);
    expect(boundaryMetricsPass(m)).toBe(false);
  });
});
