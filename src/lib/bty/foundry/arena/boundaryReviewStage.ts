/**
 * THE NARROW BOUNDARY-REVIEW STAGE (Slice 3.2I-R5B1A.1-R2.29).
 *
 * Runs BEFORE the broad semantic reviewer, and decides whether the broad reviewer runs at all.
 *
 * R2.28 measured why the order matters. The broad reviewer holds eight contracts at once; given
 * `c1_verify` it produced correct prose about the violation and incorrect booleans, and its
 * `overallVerdict: accept` was structurally consistent because the detail fields established no
 * derivable defect. Asking the boundary question first, alone, and deriving the answer server-side
 * from per-surface evidence removes every step in that chain.
 *
 * The broad reviewer keeps defensibility, good faith, branch progression, diversity, vague
 * reassurance, no-safe reasoning and general urgency. It is no longer the primary authority for
 * confirmed-boundary compliance, and it never sees a scenario this stage rejected.
 */

import type { Finding } from "@/domain/foundry/arena-draft/gatePrecedence";
import type { BoundaryReviewProvenance } from "@/domain/foundry/arena-draft/boundaryProvenance";
import {
  MAX_BOUNDARY_REVIEW_CALLS_PER_SUBJECT,
  decideAfterBoundaryReview,
  type BoundaryUncertainty,
  type BoundaryViolation,
} from "@/domain/foundry/arena-draft/narrowBoundaryReview";
import {
  compatibilitySurfaces,
  enumerateBoundarySurfaces,
  lineageSha256,
  reviewableSurfaces,
  surfaceMapSha256,
  validateSurfaceMap,
  type BoundarySurface,
} from "@/domain/foundry/arena-draft/boundarySurfaces";
import { isBranchAware } from "@/domain/foundry/arena-draft/types";
import type { ArenaScenarioDraft } from "@/domain/foundry/arena-draft/types";
import { buildNarrowBoundarySubject, narrowBoundarySubjectSha256, type NarrowBoundarySubject } from "./narrowBoundaryContract";
import type { NarrowBoundaryCallResult, NarrowBoundaryEvidence } from "./narrowBoundaryReviewer";

export const BOUNDARY_STAGE_OUTCOMES = [
  "boundary_review_pass",
  "boundary_review_not_applicable",
  "boundary_review_reject",
  "boundary_review_inconclusive",
  "boundary_reviewer_terminal_failure",
  "boundary_review_authority_failure",
] as const;
export type BoundaryStageOutcome = (typeof BOUNDARY_STAGE_OUTCOMES)[number];

export type BoundaryStageResult = {
  outcome: BoundaryStageOutcome;
  /** Every narrow call made, in order. Empty when the stage never reached the provider. */
  evidences: NarrowBoundaryEvidence[];
  subject: NarrowBoundarySubject | null;
  boundaryReviewSubjectSha256: string | null;
  surfaceMapSha256: string | null;
  calls: number;
  reruns: number;
  /** Populated only on a valid reject. */
  violations: BoundaryViolation[];
  /** Earliest causal + independently-new violations — the only ones that drive a correction. */
  causalViolations: BoundaryViolation[];
  /** Descendants that repeat an ancestor's violation. Evidence only, never an instruction. */
  downstreamViolations: BoundaryViolation[];
  /** The reachable surfaces actually reviewed, and the unreachable duplicates excluded. */
  reachableSurfaces: string[];
  excludedCompatibilitySurfaces: string[];
  /** Populated only on a valid inconclusive. */
  uncertainties: BoundaryUncertainty[];
  /** Server-authored findings for the correction packet. Only a valid reject produces them. */
  findings: Finding[];
  /** Authority / surface-map failure codes. */
  codes: string[];
  /** True exactly when the broad semantic reviewer is permitted to run next. */
  broadReviewAllowed: boolean;
};

export type BoundaryStageDeps = {
  /** One narrow provider call. Injected so the stage is provable without a network. */
  review: (subject: NarrowBoundarySubject, attempt: number) => Promise<NarrowBoundaryCallResult>;
  log?: (outcome: string, code: string | undefined, extra: Record<string, unknown>) => void;
};

/**
 * Which registered defect code a violation at this surface is. The narrow stage reuses the existing
 * boundary codes so a boundary rejection keeps its Level 3 precedence rather than inventing a
 * parallel severity ladder.
 */
export function surfaceDefectCode(surface: BoundarySurface | undefined): string {
  switch (surface?.phase) {
    case "branch_resulting_world_state":
      return "branch_drops_boundary";
    case "flat_action":
    case "branch_action":
      return "action_reopens_boundary";
    default:
      return "choice_bypasses_boundary";
  }
}

const empty = (outcome: BoundaryStageOutcome, codes: string[] = []): BoundaryStageResult => ({
  outcome,
  evidences: [],
  subject: null,
  boundaryReviewSubjectSha256: null,
  surfaceMapSha256: null,
  calls: 0,
  reruns: 0,
  violations: [],
  causalViolations: [],
  downstreamViolations: [],
  reachableSurfaces: [],
  excludedCompatibilitySurfaces: [],
  uncertainties: [],
  findings: [],
  codes,
  broadReviewAllowed: outcome === "boundary_review_not_applicable",
});

/**
 * Run the narrow boundary stage over one frozen scenario.
 *
 * `boundaryMode: "none"` — the canonical input PROVES no confirmed rule applies. No provider call is
 * made, the stage records `boundary_review_not_applicable`, and the broad reviewer proceeds. This is
 * the legitimate c01 shape, and R2.27's provenance record is what makes it distinguishable from lost
 * boundary data, which fails closed before this stage is ever reached.
 */
export async function runBoundaryReviewStage(
  deps: BoundaryStageDeps,
  args: {
    draft: ArenaScenarioDraft;
    constructions: Record<string, unknown>;
    boundaries: Array<{ id: string; statement: string }>;
    boundaryProvenance: BoundaryReviewProvenance;
    boundaryProvenanceSha256: string;
    scenarioSha256: string;
    reviewSubjectSha256: string;
    language: string;
    generationAttemptId: string;
    caseId: string;
  },
): Promise<BoundaryStageResult> {
  const log = deps.log ?? (() => undefined);
  const mode = args.boundaryProvenance.boundaryMode;

  // A no-boundary case costs zero provider calls. It is a recorded decision, never an assumption.
  if (mode === "none") {
    if (args.boundaries.length > 0) {
      log("boundary_review_authority_failure", "boundary_mode_contradicts_active_set", {});
      return empty("boundary_review_authority_failure", ["boundary_mode_contradicts_active_set"]);
    }
    log("boundary_review_not_applicable", undefined, { boundaryMode: mode });
    return empty("boundary_review_not_applicable");
  }
  if (args.boundaries.length === 0) {
    log("boundary_review_authority_failure", "boundary_bearing_without_active_boundary", {});
    return empty("boundary_review_authority_failure", ["boundary_bearing_without_active_boundary"]);
  }

  // The server owns the coordinates. A malformed map is refused BEFORE a credential is spent.
  const surfaces = enumerateBoundarySurfaces(args.draft, args.constructions);
  // R2.30 — the expected reachable count follows the RUNTIME shape, never a hardcoded number.
  const mapCheck = validateSurfaceMap(surfaces, { branchAware: isBranchAware(args.draft) });
  if (!mapCheck.ok) {
    log("boundary_review_authority_failure", mapCheck.codes[0], { surfaceCount: surfaces.length, defectCodes: mapCheck.codes });
    return empty("boundary_review_authority_failure", mapCheck.codes);
  }

  const subject = buildNarrowBoundarySubject({
    scenarioSha256: args.scenarioSha256,
    reviewSubjectSha256: args.reviewSubjectSha256,
    boundaryProvenance: args.boundaryProvenance,
    boundaryProvenanceSha256: args.boundaryProvenanceSha256,
    boundaries: args.boundaries,
    surfaces,
    language: args.language,
    generationAttemptId: args.generationAttemptId,
    caseId: args.caseId,
  });
  const subjectSha = narrowBoundarySubjectSha256(subject);
  const mapSha = subject.surfaceMapSha256;
  const surfaceByRef = new Map(surfaces.map((s) => [s.coordinate, s]));
  const reachable = reviewableSurfaces(surfaces);
  const excluded = compatibilitySurfaces(surfaces);

  log("boundary_review_subject_frozen", undefined, {
    boundaryReviewSubjectSha256: subjectSha,
    surfaceMapSha256: mapSha,
    lineageSha256: subject.lineageSha256,
    surfaceCount: reachable.length,
    reachableSurfaces: reachable.map((s) => s.coordinate),
    excludedCompatibilitySurfaces: excluded.map((s) => `${s.coordinate}${s.compatibilitySource ? ` -> ${s.compatibilitySource}` : ""}`),
    activeBoundaryIds: subject.activeBoundaryIds,
  });

  const evidences: NarrowBoundaryEvidence[] = [];
  let reruns = 0;

  for (let attempt = 1; attempt <= MAX_BOUNDARY_REVIEW_CALLS_PER_SUBJECT; attempt++) {
    if (attempt > 1) {
      // FAIL CLOSED before the second call: the subject and its surface map must be identical.
      const current = surfaceMapSha256(enumerateBoundarySurfaces(args.draft, args.constructions));
      if (current !== mapSha) {
        log("boundary_review_authority_failure", "surface_map_mismatch", { boundaryReviewSubjectSha256: subjectSha });
        return {
          ...empty("boundary_review_authority_failure", ["surface_map_mismatch"]),
          evidences,
          subject,
          boundaryReviewSubjectSha256: subjectSha,
          surfaceMapSha256: mapSha,
          calls: evidences.length,
          reruns,
        };
      }
    }

    const call = await deps.review(subject, attempt);
    evidences.push(call.evidence);

    const decision = decideAfterBoundaryReview(
      attempt,
      call.kind === "transport_failed" ? { kind: "transport_failed" } : { kind: "derived", verdict: call.verdict },
    );

    const base = {
      evidences,
      subject,
      boundaryReviewSubjectSha256: subjectSha,
      surfaceMapSha256: mapSha,
      reachableSurfaces: reachable.map((s) => s.coordinate),
      excludedCompatibilitySurfaces: excluded.map((s) => s.coordinate),
      calls: evidences.length,
      reruns,
    };

    if (decision.action === "rerun_boundary_review") {
      reruns++;
      log("boundary_review_rerun", call.evidence.verdict.outcome === "boundary_review_malformed" ? call.evidence.verdict.codes[0] : undefined, {
        boundaryReviewSubjectSha256: subjectSha,
        because: decision.because,
      });
      continue;
    }

    if (decision.action === "continue") {
      log("boundary_review_pass", undefined, { boundaryReviewSubjectSha256: subjectSha, surfaceMapSha256: mapSha });
      return { ...empty("boundary_review_pass"), ...base, outcome: "boundary_review_pass", reruns, broadReviewAllowed: true };
    }

    if (decision.action === "correction_path") {
      const rejected = call.evidence.verdict.outcome === "boundary_review_reject" ? call.evidence.verdict : null;
      const violations = rejected?.violations ?? [];
      const causal = rejected?.causalViolations ?? [];
      const downstream = rejected?.downstreamViolations ?? [];
      // R2.30 Part 9 — CORRECTION PRECISION. Only EARLIEST CAUSAL and independently-new violations
      // become correction findings. A descendant that repeats its ancestor's mechanism and governed
      // action is kept as evidence, never as a separate instruction: the R2.29 live run produced
      // nine defects where four describe the whole problem.
      const findings: Finding[] = causal.map((v: BoundaryViolation) => {
        const s = surfaceByRef.get(v.surfaceRef);
        return {
          code: surfaceDefectCode(s),
          gate: "narrow_boundary_review",
          boundaryId: v.boundaryId,
          phase: s?.phase,
          branchIndex: s?.branchIndex,
          choiceIndex: s && s.index >= 0 ? s.index : undefined,
          detail: `${v.surfaceRef} [${v.violationMechanism}]: ${v.governedActionEvidence} || ${v.prerequisiteFailureEvidence}`,
        };
      });
      log("boundary_review_reject", findings[0]?.code, {
        boundaryReviewSubjectSha256: subjectSha,
        defectCodes: [...new Set(findings.map((f) => f.code))],
        violations,
        causalViolations: causal.map((v) => v.surfaceRef),
        downstreamViolations: downstream.map((v) => v.surfaceRef),
      });
      return {
        ...empty("boundary_review_reject"),
        ...base,
        outcome: "boundary_review_reject",
        violations,
        causalViolations: causal,
        downstreamViolations: downstream,
        findings,
        reruns,
      };
    }

    if (decision.action === "inconclusive") {
      const uncertainties = call.evidence.verdict.outcome === "boundary_review_inconclusive" ? call.evidence.verdict.uncertainties : [];
      log("boundary_review_inconclusive", uncertainties[0]?.surfaceRef, { boundaryReviewSubjectSha256: subjectSha, uncertainties });
      return { ...empty("boundary_review_inconclusive"), ...base, outcome: "boundary_review_inconclusive", uncertainties, reruns };
    }

    if (decision.action === "boundary_reviewer_terminal_failure") {
      log("boundary_reviewer_terminal_failure", call.evidence.verdict.outcome === "boundary_review_malformed" ? call.evidence.verdict.codes[0] : undefined, {
        boundaryReviewSubjectSha256: subjectSha,
        scenarioUnjudged: true,
        because: decision.because,
      });
      return { ...empty("boundary_reviewer_terminal_failure"), ...base, outcome: "boundary_reviewer_terminal_failure", reruns };
    }

    // Transport / budget failure. Never a scenario verdict.
    log("boundary_reviewer_terminal_failure", decision.code, { boundaryReviewSubjectSha256: subjectSha, scenarioUnjudged: true });
    return { ...empty("boundary_reviewer_terminal_failure"), ...base, outcome: "boundary_reviewer_terminal_failure", codes: [decision.code], reruns };
  }

  // Budget exhausted without a decision — defensive; `decideAfterBoundaryReview` terminates first.
  return {
    ...empty("boundary_reviewer_terminal_failure"),
    evidences,
    subject,
    boundaryReviewSubjectSha256: subjectSha,
    surfaceMapSha256: mapSha,
    calls: evidences.length,
    reruns,
  };
}

/** Aggregate stability metrics (R2.29 Part 12). Any nonzero terminal count fails a hard gate. */
export type BoundaryReviewMetrics = {
  boundaryReviewCallCount: number;
  boundaryReviewRerunCount: number;
  boundaryReviewPassCount: number;
  boundaryReviewRejectCount: number;
  boundaryReviewInconclusiveCount: number;
  boundaryReviewerTerminalFailureCount: number;
  boundaryEvidenceUngroundedCount: number;
  broadReviewSkippedByBoundaryCount: number;
  // R2.30 — precision counters. Compatibility projections are NEVER counted as reviewed surfaces.
  reachableSurfaceCount: number;
  compatibilitySurfaceCount: number;
  applicableSurfaceCount: number;
  notApplicableSurfaceCount: number;
  applicabilityUncertainCount: number;
  complianceViolationCount: number;
  earliestCausalViolationCount: number;
  downstreamViolationCount: number;
  /** Violations the model asserted that grounding refused — the R2.29 false-positive family. */
  administrativeFalsePositivePreventedCount: number;
  missingWorldStateCount: number;
};

export const emptyBoundaryMetrics = (): BoundaryReviewMetrics => ({
  boundaryReviewCallCount: 0,
  boundaryReviewRerunCount: 0,
  boundaryReviewPassCount: 0,
  boundaryReviewRejectCount: 0,
  boundaryReviewInconclusiveCount: 0,
  boundaryReviewerTerminalFailureCount: 0,
  boundaryEvidenceUngroundedCount: 0,
  broadReviewSkippedByBoundaryCount: 0,
  reachableSurfaceCount: 0,
  compatibilitySurfaceCount: 0,
  applicableSurfaceCount: 0,
  notApplicableSurfaceCount: 0,
  applicabilityUncertainCount: 0,
  complianceViolationCount: 0,
  earliestCausalViolationCount: 0,
  downstreamViolationCount: 0,
  administrativeFalsePositivePreventedCount: 0,
  missingWorldStateCount: 0,
});

const UNGROUNDED_CODES = new Set([
  "boundary_evidence_missing",
  "boundary_evidence_generic",
  "boundary_evidence_too_short",
  "boundary_evidence_from_other_surface",
  "boundary_evidence_restates_boundary",
  "boundary_evidence_ungrounded",
]);

/** Codes that fire when a claimed violation could not prove a mechanism — a prevented false positive. */
const UNSUPPORTED_VIOLATION_CODES = new Set([
  "boundary_violation_mechanism_missing",
  "boundary_violation_governed_action_missing",
  "boundary_violation_prerequisite_evidence_missing",
]);

/** Fold one stage result into the running metrics. Pure. */
export function accumulateBoundaryMetrics(m: BoundaryReviewMetrics, r: BoundaryStageResult): BoundaryReviewMetrics {
  const malformedCodes = r.evidences.flatMap((e) => (e.verdict.outcome === "boundary_review_malformed" ? e.verdict.codes : []));
  const ungrounded = malformedCodes.filter((c) => UNGROUNDED_CODES.has(c)).length;
  const prevented = malformedCodes.filter((c) => UNSUPPORTED_VIOLATION_CODES.has(c)).length;
  // Applicability counters come from the LAST usable response, which is the one that decided.
  const last = [...r.evidences].reverse().find((e) => e.verdict.outcome !== "boundary_review_malformed");
  const parsed = (last?.parsed ?? null) as { assessments?: Array<{ applicability?: string; compliance?: string }> } | null;
  const rows = parsed?.assessments ?? [];
  return {
    boundaryReviewCallCount: m.boundaryReviewCallCount + r.calls,
    boundaryReviewRerunCount: m.boundaryReviewRerunCount + r.reruns,
    boundaryReviewPassCount: m.boundaryReviewPassCount + (r.outcome === "boundary_review_pass" ? 1 : 0),
    boundaryReviewRejectCount: m.boundaryReviewRejectCount + (r.outcome === "boundary_review_reject" ? 1 : 0),
    boundaryReviewInconclusiveCount: m.boundaryReviewInconclusiveCount + (r.outcome === "boundary_review_inconclusive" ? 1 : 0),
    boundaryReviewerTerminalFailureCount:
      m.boundaryReviewerTerminalFailureCount +
      (r.outcome === "boundary_reviewer_terminal_failure" || r.outcome === "boundary_review_authority_failure" ? 1 : 0),
    boundaryEvidenceUngroundedCount: m.boundaryEvidenceUngroundedCount + ungrounded,
    broadReviewSkippedByBoundaryCount: m.broadReviewSkippedByBoundaryCount + (r.broadReviewAllowed ? 0 : 1),
    reachableSurfaceCount: m.reachableSurfaceCount + r.reachableSurfaces.length,
    compatibilitySurfaceCount: m.compatibilitySurfaceCount + r.excludedCompatibilitySurfaces.length,
    applicableSurfaceCount: m.applicableSurfaceCount + rows.filter((a) => a.applicability === "applies").length,
    notApplicableSurfaceCount: m.notApplicableSurfaceCount + rows.filter((a) => a.applicability === "not_applicable").length,
    applicabilityUncertainCount: m.applicabilityUncertainCount + rows.filter((a) => a.applicability === "uncertain").length,
    complianceViolationCount: m.complianceViolationCount + r.violations.length,
    earliestCausalViolationCount: m.earliestCausalViolationCount + r.causalViolations.length,
    downstreamViolationCount: m.downstreamViolationCount + r.downstreamViolations.length,
    administrativeFalsePositivePreventedCount: m.administrativeFalsePositivePreventedCount + prevented,
    missingWorldStateCount: m.missingWorldStateCount + (r.codes.includes("boundary_world_state_missing") ? 1 : 0),
  };
}

/** Any nonzero terminal / inconclusive / ungrounded count fails the stability hard gate. */
export const boundaryMetricsPass = (m: BoundaryReviewMetrics): boolean =>
  m.boundaryReviewerTerminalFailureCount === 0 && m.boundaryReviewInconclusiveCount === 0 && m.boundaryEvidenceUngroundedCount === 0;
