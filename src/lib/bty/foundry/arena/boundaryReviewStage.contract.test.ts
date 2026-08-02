/**
 * NARROW BOUNDARY STAGE — PIPELINE ORDER AND RERUN AUTHORITY
 * (Slice 3.2I-R5B1A.1-R2.29 Part 18 · PIPELINE).
 *
 * The stage runs BEFORE the broad semantic reviewer and decides whether it runs at all. These tests
 * prove the order and the precedence without a provider: every narrow call is injected.
 */
import { describe, expect, it, vi } from "vitest";
import { poolFor } from "@/domain/foundry/arena-draft/boundaryEvidenceCandidates";
import { buildNarrowBoundaryRequest } from "./narrowBoundaryContract";
import { C18_BOUNDARY, C18_SCENARIO } from "@/domain/foundry/arena-draft/c18BoundaryFixture";
import { R240_FAILED_SURFACE_REFS, R240_LIVE_ATTEMPT_1 } from "@/domain/foundry/arena-draft/r240LiveDtoFixture";
import { NO_CANDIDATE } from "@/domain/foundry/arena-draft/boundaryTruthContractTypes";
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
import { emptyTransportEvidence } from "@/domain/foundry/arena-draft/boundaryTransportEvidence";
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
  return { parsed, verdict: deriveBoundaryVerdict(parsed, ctxFor(subject)) };
};

/** R2.30 — every reachable surface settles as `not_applicable`, each showing what it does. */
const ctxFor = (subject: NarrowBoundarySubject) => ({
  boundaries: subject.boundaries,
  surfaces: subject.surfaces,
  frames: subject.semanticFrames,
  candidates: subject.evidenceCandidates,
});
const actionIn = (subject: NarrowBoundarySubject, ref: string) =>
  poolFor(subject.evidenceCandidates, subject.boundaries[0]!.id, ref, "governed_action")[0]?.candidateId ?? NO_CANDIDATE;
const failureIn = (subject: NarrowBoundarySubject, ref: string) =>
  poolFor(subject.evidenceCandidates, subject.boundaries[0]!.id, ref, "prerequisite_failure").find((c) => /unverified/i.test(c.excerpt))?.candidateId ?? NO_CANDIDATE;

const baseAssessments = (subject: NarrowBoundarySubject) =>
  subject.surfaces.map((s) => ({
    boundaryId: subject.boundaries[0]!.id,
    surfaceRef: s.coordinate,
    governedActionStatus: "absent" as const,
    prerequisiteStatus: "not_applicable" as const,
    temporalRelation: "not_applicable" as const,
    governedActionCandidateId: actionIn(subject, s.coordinate),
    prerequisiteSatisfactionCandidateId: NO_CANDIDATE,
    prerequisiteFailureCandidateId: NO_CANDIDATE,
    // R2.32 — an EMPTY reason is correct here: the server owns this explanation.
    reason: "",
  }));

/** Turn one surface into a fully grounded violation. */
const asViolation = (subject: NarrowBoundarySubject, ref: string, mechanism = "governed_action_without_prerequisite") =>
  (rows: ReturnType<typeof baseAssessments>) =>
    rows.map((a) => {
      if (a.surfaceRef !== ref) return a;
      const s = subject.surfaces.find((x) => x.coordinate === ref)!;
      // A violation the server derives: own governed action plus an eligible failure candidate.
      void mechanism; // R2.38 — the mechanism is DERIVED; the model has no field for it.
      void s;
      return {
        ...a,
        governedActionStatus: "present" as const,
        prerequisiteStatus: "explicitly_missing" as const,
        temporalRelation: "action_before_prerequisite" as const,
        governedActionCandidateId: actionIn(subject, ref),
        prerequisiteSatisfactionCandidateId: NO_CANDIDATE,
        prerequisiteFailureCandidateId: failureIn(subject, ref),
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
    // A response DID arrive in these doubles; the transport record says so.
    transport: {
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
    },
    providerFailureCode: null,
  },
  };
};

/** A TRANSPORT failure double: no semantic DTO, complete transport evidence. */
const transportCall = (
  subject: NarrowBoundarySubject,
  attempt: number,
  over: Partial<ReturnType<typeof emptyTransportEvidence>> = {},
  providerFailureCode = "provider_failure_unknown",
): NarrowBoundaryCallResult => {
  const transport = { ...emptyTransportEvidence(`t#${attempt}`), requestConstructed: true, clientInvocationStarted: true, providerInvocationStarted: true, latencyMs: 5, ...over };
  const verdict: DerivedBoundaryVerdict = {
    outcome: "boundary_review_malformed",
    codes: ["boundary_review_transport_failed"],
    findings: [],
    failureClass: "transport",
    validSurfaceRefs: [],
    failedSurfaceRefs: [],
    derived: [],
  };
  return {
    kind: "transport_failed",
    evidence: {
      boundaryReviewAttempt: attempt,
      boundaryReviewSubjectSha256: narrowBoundarySubjectSha256(subject),
      surfaceMapSha256: subject.surfaceMapSha256,
      activeBoundaryIds: subject.activeBoundaryIds,
      requiredAssessmentCount: 12,
      parsed: null,
      outcome: verdict.outcome,
      verdict,
      finishReason: null,
      latencyMs: 5,
      sanitizedError: transport.sanitizedMessage || "boundary_review_request_failed",
      transport,
      providerFailureCode: providerFailureCode as never,
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
      deps(async (s, a) => call(s, a, responseFor(s, asViolation(s, "branch[1].action[1]")))),
      args(),
    );
    expect(r.outcome).toBe("boundary_review_reject");
    expect(r.broadReviewAllowed).toBe(false);
  });

  it("[28] an inconclusive SKIPS the broad review", async () => {
    const r = await runBoundaryReviewStage(
      deps(async (s, a) =>
        call(s, a, responseFor(s, (list) => list.map((x) => (x.surfaceRef === "branch[1].tradeoff[1]" ? { ...x, governedActionStatus: "uncertain" as const, prerequisiteStatus: "uncertain" as const, reason: "the label does not say whether caring means treating" } : x)))),
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
        ? call(s, a, { outcome: "boundary_review_malformed" as const, codes: ["boundary_review_missing_pair"], findings: [], failureClass: classifyFailure(["boundary_review_missing_pair"]), validSurfaceRefs: [], failedSurfaceRefs: [], derived: [] })
        : call(s, a, responseFor(s, asViolation(s, "branch[1].action[1]")));
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
      call(s, a, { outcome: "boundary_review_malformed" as const, codes: ["boundary_candidate_unknown"], findings: [], failureClass: classifyFailure(["boundary_candidate_unknown"]), validSurfaceRefs: [], failedSurfaceRefs: [], derived: [] }),
    );
    const r = await runBoundaryReviewStage(deps(review), args());
    expect(review).toHaveBeenCalledTimes(2);
    expect(r.outcome).toBe("boundary_reviewer_terminal_failure");
    expect(r.broadReviewAllowed).toBe(false);
  });

  it("a transport failure is terminal and never a scenario verdict", async () => {
    const review = vi.fn(async (s: NarrowBoundarySubject, a: number) => transportCall(s, a));
    const r = await runBoundaryReviewStage(deps(review), args());
    expect(review).toHaveBeenCalledTimes(1);
    // R2.34 — still terminal for the run, but the top level now names the PROVIDER. Reporting it as
    // `boundary_reviewer_terminal_failure` asserted the reviewer failed twice over an identical
    // subject; it never saw the subject at all.
    expect(r.outcome).toBe("provider_failure");
    expect(r.broadReviewAllowed).toBe(false);
    expect(r.semanticAttempts).toBe(0);
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
    // R2.46 — a violation proved on a GENERATED state is owned by the choice that produced it. One
    // correction, stated at two coordinates: the primary choice that must change, and the generated
    // state where the breach was proved. The code names the OWNER's defect.
    expect(r.findings).toHaveLength(2);
    for (const f of r.findings) expect(f).toMatchObject({ code: "choice_bypasses_boundary", gate: "narrow_boundary_review", boundaryId: "c1_verify" });
    expect(new Set(r.findings.map((f) => f.code)).size).toBe(1);
    expect(r.causalAttributions).toHaveLength(1);
    expect(r.causalAttributions[0]).toMatchObject({ ancestorSurfaceRef: "primary[1]", manifestationSurfaceRef: "branch[1].resulting_world_state" });
    // The manifestation's own evidence is still what the correction cites.
    const manifestation = r.findings.find((f) => f.detail?.startsWith("branch[1].resulting_world_state"))!;
    expect(manifestation.detail).toContain("resulting_state_missing_prerequisite");
    expect(manifestation.detail).toContain("remains unverified");
    expect(manifestation).toMatchObject({ branchIndex: 1 });
    // And the owner coordinate names primary[1] without borrowing the child's candidate id.
    const owner = r.findings.find((f) => f.detail?.startsWith("primary[1]"))!;
    expect(owner.detail).toContain("correction owner");
    // Direct rows untouched.
    expect(r.causalAttributionMetrics.ancestorDirectAssessmentMutationCount).toBe(0);
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
      deps(async (s, a) => call(s, a, { outcome: "boundary_review_malformed" as const, codes: ["boundary_review_missing_pair"], findings: [], failureClass: classifyFailure(["boundary_review_missing_pair"]), validSurfaceRefs: [], failedSurfaceRefs: [], derived: [] })),
      args(),
    );
    expect(malformed.findings).toEqual([]);
  });
});

/**
 * R2.42 — THE FAILED-SUBSET REPAIR, END TO END.
 *
 * R2.41 measured that this path had never once functioned: the stage computed six repair surfaces
 * and the reviewer rebuilt a twelve-surface request, whose answer the merge authority would then
 * have refused. This test drives the real stage over the captured R2.40 live response.
 */
describe("[R2.42] failed-subset repair asks only about the failed subset", () => {
  it("requests 12 then exactly the 6 failed refs, and merges into one complete verdict", async () => {
    const asked: Array<{ attempt: number; surfaces: number; required: number; refs?: readonly string[] }> = [];
    const r = await runBoundaryReviewStage(
      deps(async (subject, attempt, surfaceRefs) => {
        const req = buildNarrowBoundaryRequest(subject, surfaceRefs);
        asked.push({ attempt, surfaces: req.surfaces.length, required: req.requiredAssessmentCount, refs: surfaceRefs });
        const scoped = surfaceRefs ? subject.surfaces.filter((x) => surfaceRefs.includes(x.coordinate)) : subject.surfaces;
        const first = (ref: string) => poolFor(subject.evidenceCandidates, subject.boundaries[0]!.id, ref, "governed_action")[0]?.candidateId ?? NO_CANDIDATE;
        // Attempt 1 replays the live response verbatim; the repair corrects only the failed rows the
        // one way the contract permits — by selecting from the pool it was offered.
        // Attempt 1 replays the live response verbatim; the repair corrects each failed row the one
        // way the contract permits. Where R2.44's polarity authority emptied the failure pool, the
        // honest correction is `not_applicable` with the sentinel.
        const rows =
          attempt === 1
            ? R240_LIVE_ATTEMPT_1
            : R240_LIVE_ATTEMPT_1.filter((x) => surfaceRefs!.includes(x.surfaceRef)).map((x) => ({
                ...x,
                governedActionStatus: "absent" as const,
                prerequisiteStatus: "not_applicable" as const,
                temporalRelation: "not_applicable" as const,
                governedActionCandidateId: first(x.surfaceRef),
                prerequisiteSatisfactionCandidateId: NO_CANDIDATE,
                prerequisiteFailureCandidateId: NO_CANDIDATE,
              }));
        return call(subject, attempt, { parsed: { assessments: rows }, verdict: deriveBoundaryVerdict({ assessments: rows }, { ...ctxFor(subject), surfaces: scoped }) });
      }),
      args({ draft: C18_SCENARIO, boundaries: [C18_BOUNDARY] }),
    );
    expect(asked).toHaveLength(2);
    expect(asked[0]).toMatchObject({ attempt: 1, surfaces: 12, required: 12 });
    // Exactly the failed set, whatever its size. R2.44's polarity authority refuses two further
    // rows of this historical capture, so the set is a strict superset of the R2.42 six.
    expect(asked[1]!.surfaces).toBe(asked[1]!.refs!.length);
    expect(asked[1]!.required).toBe(asked[1]!.refs!.length);
    expect(asked[1]!.surfaces).toBeLessThan(12);
    for (const ref of R240_FAILED_SURFACE_REFS) expect(asked[1]!.refs).toContain(ref);
    // One complete verdict from the MERGED matrix — never from the partial one.
    expect(r.outcome).toBe("boundary_review_reject");
    expect(r.providerInvocations).toBe(2);
    expect(r.failedSubsetRepairSurfaceCount).toBe(asked[1]!.refs!.length);
    expect(r.failedSubsetRepairInvocationCount).toBe(1);
    expect(r.preservedValidAssessmentCount).toBe(12 - asked[1]!.refs!.length);
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
      deps(async (s, a) => call(s, a, { outcome: "boundary_review_malformed" as const, codes: ["boundary_candidate_unknown"], findings: [], failureClass: classifyFailure(["boundary_candidate_unknown"]), validSurfaceRefs: [], failedSurfaceRefs: [], derived: [] })),
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
      l.map((x) => (x.surfaceRef === "branch[1].tradeoff[1]" ? { ...x, governedActionStatus: "uncertain" as const, prerequisiteStatus: "uncertain" as const, reason: "" } : x)),
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

describe("[R2.34] transport failure is a PROVIDER failure, not a reviewer failure", () => {
  it("[19][20] a transport failure produces provider_failure, never reviewer terminal failure", async () => {
    const r = await runBoundaryReviewStage(deps(async (s, a) => transportCall(s, a, { responseState: "response_received", httpStatus: 401 }, "provider_authentication_failure")), args());
    expect(r.outcome).toBe("provider_failure");
    expect(r.outcome).not.toBe("boundary_reviewer_terminal_failure");
    expect(r.providerFailureCode).toBe("provider_authentication_failure");
    // The stage compatibility subcode is preserved beneath the corrected top level.
    expect(r.codes).toContain("boundary_review_transport_failed");
    expect(r.broadReviewAllowed).toBe(false);
  });

  it("[19] a transport failure never records boundary_review_not_json", async () => {
    const r = await runBoundaryReviewStage(deps(async (s, a) => transportCall(s, a, { responseState: "no_response" }, "provider_network_failure")), args());
    for (const e of r.evidences) {
      expect(e.verdict.outcome === "boundary_review_malformed" && e.verdict.codes).not.toContain("boundary_review_not_json");
      expect(e.verdict.outcome === "boundary_review_malformed" && e.verdict.failureClass).toBe("transport");
    }
  });

  it("[18][20][21] counts: invocation increments, semantic attempt does NOT, rerun does NOT", async () => {
    const r = await runBoundaryReviewStage(deps(async (s, a) => transportCall(s, a)), args());
    expect(r.providerInvocations).toBe(1);
    expect(r.semanticAttempts).toBe(0);
    expect(r.transportFailures).toBe(1);
    expect(r.reruns).toBe(0);
    // The deprecated alias now means provider invocations, and is documented as such.
    expect(r.calls).toBe(r.providerInvocations);
  });

  it("counts a provider RESPONSE only when one was confirmed", async () => {
    const withResponse = await runBoundaryReviewStage(deps(async (s, a) => transportCall(s, a, { responseState: "response_received", httpStatus: 500 })), args());
    expect(withResponse.providerResponses).toBe(1);
    const without = await runBoundaryReviewStage(deps(async (s, a) => transportCall(s, a, { responseState: "no_response" })), args());
    expect(without.providerResponses).toBe(0);
    const unknown = await runBoundaryReviewStage(deps(async (s, a) => transportCall(s, a, { responseState: "unknown" })), args());
    expect(unknown.providerResponses).toBe(0);
  });

  it("[23] performs NO automatic transport retry — one invocation, then stop", async () => {
    const review = vi.fn(async (s: NarrowBoundarySubject, a: number) => transportCall(s, a));
    const r = await runBoundaryReviewStage(deps(review), args());
    expect(review).toHaveBeenCalledTimes(1);
    expect(r.providerInvocations).toBe(1);
  });

  it("[22] the invocation cap applies even when semantic budget remains", async () => {
    // One malformed semantic response reruns; the second call is a transport failure. Both caps are
    // now spent, so no third invocation may occur.
    let n = 0;
    const review = vi.fn(async (s: NarrowBoundarySubject, a: number) => {
      n += 1;
      return n === 1
        ? call(s, a, { outcome: "boundary_review_malformed" as const, codes: ["boundary_review_missing_pair" as const], findings: [], failureClass: classifyFailure(["boundary_review_missing_pair"]), validSurfaceRefs: [], failedSurfaceRefs: [], derived: [] })
        : transportCall(s, a);
    });
    const r = await runBoundaryReviewStage(deps(review), args());
    expect(review).toHaveBeenCalledTimes(2);
    expect(r.providerInvocations).toBe(2);
    expect(r.invocationBudgetExhausted).toBe(true);
    expect(r.outcome).toBe("provider_failure");
  });

  it("carries complete transport evidence into the stage result", async () => {
    const r = await runBoundaryReviewStage(
      deps(async (s, a) => transportCall(s, a, { responseState: "response_received", httpStatus: 429, retryAfterMs: 3000, retriability: "retriable", failureLayer: "http_error_response" }, "provider_rate_limit")),
      args(),
    );
    expect(r.transportEvidence).toHaveLength(1);
    expect(r.transportEvidence[0]).toMatchObject({ httpStatus: 429, retryAfterMs: 3000, retriability: "retriable", failureLayer: "http_error_response" });
  });

  it("a transport failure fails the stability hard gate", async () => {
    let m = emptyBoundaryMetrics();
    m = accumulateBoundaryMetrics(m, await runBoundaryReviewStage(deps(async (s, a) => transportCall(s, a)), args()));
    expect(m).toMatchObject({
      boundaryProviderInvocationCount: 1,
      boundarySemanticReviewAttemptCount: 0,
      boundaryTransportFailureCount: 1,
      boundaryReviewRerunCount: 0,
      boundaryTransportRetryCount: 0,
    });
    expect(boundaryMetricsPass(m)).toBe(false);
  });

  it("a SUCCESSFUL call records a semantic attempt and no transport failure", async () => {
    let m = emptyBoundaryMetrics();
    const r = await runBoundaryReviewStage(deps(async (s, a) => call(s, a, responseFor(s))), args());
    m = accumulateBoundaryMetrics(m, r);
    expect(r.providerInvocations).toBe(1);
    expect(r.semanticAttempts).toBe(1);
    expect(r.transportFailures).toBe(0);
    expect(m.boundaryProviderResponseCount).toBe(1);
  });
});
