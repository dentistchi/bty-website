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
// R2.46 — causal correction ownership. Additive: the derived rows are already final.
import {
  summarizeCausalAttribution,
  type CausalAttribution,
  type CausalAttributionMetrics,
  type CausalGroup,
} from "@/domain/foundry/arena-draft/generatedResultAttribution";
import { summarizePrerequisiteUnavailable } from "@/domain/foundry/arena-draft/narrowBoundaryReview";
import {
  BOUNDARY_STAGE_OUTCOMES as STAGE_OUTCOMES,
  MAX_BOUNDARY_PROVIDER_INVOCATIONS_PER_FROZEN_SUBJECT,
  MAX_BOUNDARY_SEMANTIC_RESPONSES_PER_FROZEN_SUBJECT,
  type BoundaryStageOutcome as StageOutcome,
} from "@/domain/foundry/arena-draft/boundaryOutcomes";
import { validateTransportEvidence, type BoundaryTransportEvidence, type ProviderFailureCode } from "@/domain/foundry/arena-draft/boundaryTransportEvidence";
import { classifyAssessmentState, requiresModelReason } from "@/domain/foundry/arena-draft/boundaryReasonParity";
import { explanationSha256, type ServerExplanation } from "@/domain/foundry/arena-draft/boundaryExplanation";
import type { BoundaryReviewProvenance } from "@/domain/foundry/arena-draft/boundaryProvenance";
import {
  MAX_BOUNDARY_REVIEW_CALLS_PER_SUBJECT,
  NARROW_BOUNDARY_JSON_SCHEMA,
  REMOVED_MODEL_AUTHORED_FIELDS,
  decideAfterBoundaryReview,
  mergeSubsetRepair,
  verdictFromDerived,
  type BoundaryUncertainty,
  type BoundaryViolation,
  type DerivedAssessment,
  type NarrowReviewContext,
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
import { classifyTruthState, truthStateTableSha256 } from "@/domain/foundry/arena-draft/boundaryTruthStates";
import { NO_CANDIDATE } from "@/domain/foundry/arena-draft/boundaryTruthContractTypes";
import {
  checkPromptFieldParity,
  instructiveRemovedFieldMentions,
} from "@/domain/foundry/arena-draft/promptFieldParity";
import { isBranchAware } from "@/domain/foundry/arena-draft/types";
import type { ArenaScenarioDraft } from "@/domain/foundry/arena-draft/types";
import {
  NARROW_BOUNDARY_SYSTEM_PROMPT,
  PROMPT_EXPLANATORY_VOCABULARY,
  buildNarrowBoundarySubject,
  narrowBoundarySubjectSha256,
  type NarrowBoundarySubject,
} from "./narrowBoundaryContract";
import type { NarrowBoundaryCallResult, NarrowBoundaryEvidence } from "./narrowBoundaryReviewer";

// R2.32 Part 9 — ONE canonical enumeration, re-exported so existing importers keep working.
export { BOUNDARY_STAGE_OUTCOMES, type BoundaryStageOutcome } from "@/domain/foundry/arena-draft/boundaryOutcomes";

export type BoundaryStageResult = {
  outcome: StageOutcome;
  /** Every narrow call made, in order. Empty when the stage never reached the provider. */
  evidences: NarrowBoundaryEvidence[];
  subject: NarrowBoundarySubject | null;
  boundaryReviewSubjectSha256: string | null;
  surfaceMapSha256: string | null;
  /**
   * R2.34 — SEPARATED COUNTS. `calls` was one number doing three jobs, which is how a transport
   * failure came to consume reviewer rerun authority it never earned.
   */
  providerInvocations: number;
  providerResponses: number;
  semanticAttempts: number;
  transportFailures: number;
  /** DEPRECATED alias of `providerInvocations`, kept so existing readers do not silently change
   *  meaning. Old meaning: "review calls". New meaning: provider invocations. */
  calls: number;
  reruns: number;
  /** Populated when the stage ended below the semantic layer. */
  providerFailureCode: ProviderFailureCode | null;
  transportEvidence: BoundaryTransportEvidence[];
  invocationBudgetExhausted: boolean;
  /** Populated only on a valid reject. */
  violations: BoundaryViolation[];
  /** Earliest causal + independently-new violations — the only ones that drive a correction. */
  causalViolations: BoundaryViolation[];
  /** Descendants that repeat an ancestor's violation. Evidence only, never an instruction. */
  downstreamViolations: BoundaryViolation[];
  /** R2.46 — who owns each correction, derived from the generation schema's own lineage edges. */
  causalAttributions: CausalAttribution[];
  causalGroups: CausalGroup[];
  causalAttributionMetrics: CausalAttributionMetrics;
  /** The reachable surfaces actually reviewed, and the unreachable duplicates excluded. */
  reachableSurfaces: string[];
  excludedCompatibilitySurfaces: string[];
  /** Populated only on a valid inconclusive. */
  uncertainties: BoundaryUncertainty[];
  /** Context authority actually used for this subject. */
  contextSegmentCount: number;
  contextSegmentMapSha256: string | null;
  openingPresent: boolean;
  /** Rule decomposition. A non-empty `undecomposableBoundaryIds` fails the subject closed. */
  semanticFramesSha256: string | null;
  undecomposableBoundaryIds: string[];
  /** Truth-field distributions over the deciding attempt. */
  governedActionStatusCounts: Record<string, number>;
  prerequisiteStatusCounts: Record<string, number>;
  temporalRelationCounts: Record<string, number>;
  // --- R2.38 candidate authority -------------------------------------------------------------
  boundaryEvidenceCandidateCount: number;
  boundaryEvidenceCandidateAliasRemovedCount: number;
  boundaryEvidenceCandidateProvenanceRetainedCount: number;
  // R2.40 — governed-action role authority.
  governedActionRoleCollisionCount: number;
  governedActionPrerequisiteOperationRefusedCount: number;
  governedActionRoleUncertainCount: number;
  prerequisitePolarityCollisionObservedCount: number;
  /** Sanitized role decisions. Evidence for an auditor; never a semantic finding. */
  candidateRoleDecisions: Array<{ surfaceRef: string; candidateId: string; roleEligibility: string; refusalCode: string | null; spanSha256: string }>;
  evidenceCandidateMapSha256: string | null;
  truthStateTableSha256: string | null;
  governedActionCandidateSelectedCount: number;
  prerequisiteSatisfactionCandidateSelectedCount: number;
  prerequisiteFailureCandidateSelectedCount: number;
  unknownCandidateIdCount: number;
  ambiguousLegacyCandidateCount: number;
  /**
   * The three numbers that prove the R2.37 root cause is gone. `modelAuthored*` must be 0: the
   * model has no field in which to author either conclusion.
   */
  derivedApplicabilityCount: number;
  derivedComplianceCount: number;
  modelAuthoredApplicabilityCount: number;
  modelAuthoredComplianceCount: number;
  promptSchemaFieldDriftCount: number;
  // --- R2.38 failed-subset repair --------------------------------------------------------------
  failedSubsetRepairSurfaceCount: number;
  failedSubsetRepairInvocationCount: number;
  preservedValidAssessmentCount: number;
  /** Server-authored findings for the correction packet. Only a valid reject produces them. */
  findings: Finding[];
  /** Authority / surface-map failure codes. */
  codes: string[];
  /** R2.32 — server-rendered explanations from the deciding attempt. Never a semantic finding. */
  explanations: ServerExplanation[];
  explanationSha256: string | null;
  /** The precise subcode when a response failed the SERVER state contract, not the provider's. */
  outputContractFailure: boolean;
  /** Per-attempt reason bookkeeping, so an auditor can tell correct silence from a real omission. */
  modelReasonRequiredCount: number;
  modelReasonMissingCount: number;
  modelReasonUnexpectedCount: number;
  /** True exactly when the broad semantic reviewer is permitted to run next. */
  broadReviewAllowed: boolean;
};

export type BoundaryStageDeps = {
  /**
   * One narrow provider call. Injected so the stage is provable without a network.
   *
   * `surfaceRefs` is present ONLY on a failed-subset repair, and names exactly the surfaces whose
   * assessments were refused. Rows the first response got right are never re-requested.
   */
  review: (subject: NarrowBoundarySubject, attempt: number, surfaceRefs?: string[]) => Promise<NarrowBoundaryCallResult>;
  log?: (outcome: string, code: string | undefined, extra: Record<string, unknown>) => void;
};

/**
 * Which registered defect code a violation at this surface is. The narrow stage reuses the existing
 * boundary codes so a boundary rejection keeps its Level 3 precedence rather than inventing a
 * parallel severity ladder.
 */
export const EMPTY_PREREQ_UNAVAILABLE = summarizePrerequisiteUnavailable([]);

export const EMPTY_CAUSAL_METRICS: CausalAttributionMetrics = summarizeCausalAttribution([], [], []);

/**
 * The finding detail for one coordinate of one causal group.
 *
 * Every excerpt here was RESOLVED by the server from a candidate id the reviewer selected (R2.38),
 * so nothing in this string is model-authored prose. When the item is owned by an ancestor the
 * detail says so explicitly, and still cites the manifestation's own candidate ids — the evidence
 * never migrates to the parent, only the instruction does.
 */
function causalDetail(g: CausalGroup, v: BoundaryViolation, coordinateRef: string): string {
  const evidence =
    `[${v.stateId} -> ${v.violationMechanism}] ` +
    `action(${v.governedActionCandidateId}@${v.governedActionSegmentRef}): ${v.governedActionEvidence} || ` +
    `prerequisite ${v.prerequisiteStatus} (${v.prerequisiteFailureCandidateId}@${v.prerequisiteSegmentRef}/${v.prerequisiteSegmentKind}, ${v.temporalRelation}): ` +
    v.prerequisiteFailureEvidence;
  if (!g.attributed) return `${coordinateRef} ${evidence}`;
  const role = coordinateRef === g.correctionOwnerSurfaceRef ? "correction owner" : "manifestation";
  return `${coordinateRef} (${role}; owner ${g.correctionOwnerSurfaceRef}, proved at ${g.manifestationSurfaceRefs.join(",")}) ${evidence}`;
}

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

/**
 * CORRECTION OWNERSHIP PROJECTION (R2.46).
 *
 * A violation proved on a generated world state is owned by the one choice that produced it, because
 * the generation schema defines that state as that choice's result. The generated state stays the
 * EVIDENCE and stops being a separate instruction: an author told to rewrite a resulting world state
 * without touching the choice that generates it will regenerate the same state.
 *
 * One item at two coordinates, not two items. `buildCorrectionPacket` already collapses findings
 * that share a code into a single item listing every affected place, so the projection emits one
 * finding per coordinate and lets the packet do the collapsing — the existing idiom, not a new one.
 */
export function projectCausalFindings(
  groups: readonly CausalGroup[],
  causal: readonly BoundaryViolation[],
  surfaceByRef: Map<string, BoundarySurface>,
): Finding[] {
  const bySurface = new Map(causal.map((v) => [v.boundaryId + " " + v.surfaceRef, v]));
  const coordinatesOf = (g: CausalGroup): string[] =>
    g.attributed ? [g.correctionOwnerSurfaceRef, ...g.manifestationSurfaceRefs] : [g.correctionOwnerSurfaceRef];
  return groups.flatMap((g) => {
    // The code names the OWNER's defect: a primary choice that leads past the rule is a
    // `choice_bypasses_boundary`, not a `branch_drops_boundary`.
    const code = surfaceDefectCode(surfaceByRef.get(g.correctionOwnerSurfaceRef));
    const source = bySurface.get(g.boundaryId + " " + (g.attributed ? g.manifestationSurfaceRefs[0]! : g.correctionOwnerSurfaceRef));
    if (!source) return [];
    return coordinatesOf(g).map((ref) => {
      const s = surfaceByRef.get(ref);
      return {
        code,
        gate: "narrow_boundary_review",
        boundaryId: source.boundaryId,
        phase: s?.phase,
        branchIndex: s?.branchIndex,
        choiceIndex: s && s.index >= 0 ? s.index : undefined,
        detail: causalDetail(g, source, ref),
      };
    });
  });
}


const empty = (outcome: StageOutcome, codes: string[] = []): BoundaryStageResult => ({
  outcome,
  evidences: [],
  subject: null,
  boundaryReviewSubjectSha256: null,
  surfaceMapSha256: null,
  providerInvocations: 0,
  providerResponses: 0,
  semanticAttempts: 0,
  transportFailures: 0,
  calls: 0,
  reruns: 0,
  providerFailureCode: null,
  transportEvidence: [],
  invocationBudgetExhausted: false,
  violations: [],
  causalViolations: [],
  downstreamViolations: [],
  causalAttributions: [],
  causalGroups: [],
  causalAttributionMetrics: EMPTY_CAUSAL_METRICS,
  reachableSurfaces: [],
  excludedCompatibilitySurfaces: [],
  uncertainties: [],
  contextSegmentCount: 0,
  contextSegmentMapSha256: null,
  openingPresent: false,
  semanticFramesSha256: null,
  undecomposableBoundaryIds: [],
  governedActionStatusCounts: {},
  prerequisiteStatusCounts: {},
  temporalRelationCounts: {},
  boundaryEvidenceCandidateCount: 0,
  boundaryEvidenceCandidateAliasRemovedCount: 0,
  boundaryEvidenceCandidateProvenanceRetainedCount: 0,
  governedActionRoleCollisionCount: 0,
  governedActionPrerequisiteOperationRefusedCount: 0,
  governedActionRoleUncertainCount: 0,
  prerequisitePolarityCollisionObservedCount: 0,
  candidateRoleDecisions: [],
  evidenceCandidateMapSha256: null,
  truthStateTableSha256: null,
  governedActionCandidateSelectedCount: 0,
  prerequisiteSatisfactionCandidateSelectedCount: 0,
  prerequisiteFailureCandidateSelectedCount: 0,
  unknownCandidateIdCount: 0,
  ambiguousLegacyCandidateCount: 0,
  derivedApplicabilityCount: 0,
  derivedComplianceCount: 0,
  modelAuthoredApplicabilityCount: 0,
  modelAuthoredComplianceCount: 0,
  promptSchemaFieldDriftCount: 0,
  failedSubsetRepairSurfaceCount: 0,
  failedSubsetRepairInvocationCount: 0,
  preservedValidAssessmentCount: 0,
  findings: [],
  codes,
  explanations: [],
  explanationSha256: null,
  outputContractFailure: false,
  modelReasonRequiredCount: 0,
  modelReasonMissingCount: 0,
  modelReasonUnexpectedCount: 0,
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
    draft: args.draft,
    language: args.language,
    generationAttemptId: args.generationAttemptId,
    caseId: args.caseId,
  });
  // R2.36 — a missing scenario opening or an undecomposable rule is a NAMED refusal BEFORE a
  // credential is spent. R2.35 measured the opening simply absent and the question silently thinner:
  // `primary[1]` was judged as a bare label with no clinical premise in 3 of 3 live runs.
  if (subject.subjectDefects.length > 0) {
    log("boundary_review_authority_failure", subject.subjectDefects[0], {
      defectCodes: subject.subjectDefects,
      openingPresent: subject.opening.trim().length > 0,
      undecomposableBoundaryIds: subject.semanticFrames.filter((f) => f.ruleKind === "uncertain").map((f) => f.boundaryId),
    });
    return empty("boundary_review_authority_failure", subject.subjectDefects);
  }

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
  // R2.34 — three independent counters. `providerInvocations` is the COST authority (every call,
  // response or not); `semanticAttempts` is the RERUN authority (only responses that reached the
  // semantic layer). Collapsing them is how a transport failure spent rerun budget it never earned.
  let providerInvocations = 0;
  let providerResponses = 0;
  let semanticAttempts = 0;
  let transportFailures = 0;
  // R2.38 — a failed-subset repair carries these forward. `preserved` rows are IMMUTABLE: the repair
  // may only supply the surfaces the server names, and merging refuses anything else.
  let repairSurfaceRefs: string[] | undefined;
  let preserved: DerivedAssessment[] = [];
  let failedSubsetRepairSurfaceCount = 0;
  let failedSubsetRepairInvocationCount = 0;

  for (let attempt = 1; attempt <= MAX_BOUNDARY_REVIEW_CALLS_PER_SUBJECT; attempt++) {
    // BOTH caps apply, and the invocation cap is checked first because it is the cost authority.
    if (providerInvocations >= MAX_BOUNDARY_PROVIDER_INVOCATIONS_PER_FROZEN_SUBJECT) break;
    if (semanticAttempts >= MAX_BOUNDARY_SEMANTIC_RESPONSES_PER_FROZEN_SUBJECT) break;
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

    providerInvocations += 1; // incremented for the invocation itself, before any outcome is known
    const call = await deps.review(subject, attempt, repairSurfaceRefs);
    evidences.push(call.evidence);
    if (call.evidence.transport?.responseState === "response_received") providerResponses += 1;
    if (call.kind === "transport_failed") transportFailures += 1;
    else semanticAttempts += 1; // ONLY a response that reached schema/semantic validation

    const tally = tallyModelReason(call.evidence.parsed);
    const verdict = call.evidence.verdict;
    const truth = tallyTruthFields(call.evidence.parsed);
    const ctx: NarrowReviewContext = {
      boundaries: subject.boundaries,
      surfaces: subject.surfaces,
      frames: subject.semanticFrames,
      candidates: subject.evidenceCandidates,
    };

    // A repair response covers only the failed surfaces. Merge it onto the preserved rows and
    // derive ONE verdict from the complete matrix — never from a partial one.
    let effective = verdict;
    if (repairSurfaceRefs && verdict.outcome !== "boundary_review_malformed") {
      const merge = mergeSubsetRepair(preserved, verdict.derived, repairSurfaceRefs);
      effective = merge.ok
        ? verdictFromDerived(merge.derived, ctx)
        : { outcome: "boundary_review_malformed", codes: [], findings: [], failureClass: "coverage", validSurfaceRefs: [], failedSurfaceRefs: repairSurfaceRefs, derived: [] };
      if (!merge.ok) log("boundary_review_authority_failure", merge.code, { detail: merge.detail });
    }
    const explanations = "explanations" in effective ? effective.explanations : [];
    const decision = decideAfterBoundaryReview(
      attempt,
      call.kind === "transport_failed" ? { kind: "transport_failed" } : { kind: "derived", verdict: effective },
    );
    const base = {
      evidences,
      subject,
      boundaryReviewSubjectSha256: subjectSha,
      surfaceMapSha256: mapSha,
      reachableSurfaces: reachable.map((s) => s.coordinate),
      excludedCompatibilitySurfaces: excluded.map((s) => s.coordinate),
      providerInvocations,
      providerResponses,
      semanticAttempts,
      transportFailures,
      calls: providerInvocations,
      reruns,
      providerFailureCode: call.evidence.providerFailureCode ?? null,
      transportEvidence: evidences.map((e) => e.transport).filter(Boolean),
      invocationBudgetExhausted: providerInvocations >= MAX_BOUNDARY_PROVIDER_INVOCATIONS_PER_FROZEN_SUBJECT,
      explanations,
      explanationSha256: explanations.length ? explanationSha256(explanations) : null,
      outputContractFailure: effective.outcome === "boundary_review_malformed" && effective.failureClass === "output_contract",
      modelReasonRequiredCount: tally.required,
      modelReasonMissingCount: tally.missing,
      modelReasonUnexpectedCount: tally.unexpected,
      contextSegmentCount: subject.contextSegments.length,
      contextSegmentMapSha256: subject.contextSegmentMapSha256,
      openingPresent: subject.opening.trim().length > 0,
      semanticFramesSha256: subject.semanticFramesSha256,
      undecomposableBoundaryIds: subject.semanticFrames.filter((f) => f.ruleKind === "uncertain").map((f) => f.boundaryId),
      governedActionStatusCounts: truth.governedActionStatusCounts,
      prerequisiteStatusCounts: truth.prerequisiteStatusCounts,
      temporalRelationCounts: truth.temporalRelationCounts,
      // R2.38 candidate authority.
      boundaryEvidenceCandidateCount: subject.evidenceCandidates.length,
      boundaryEvidenceCandidateAliasRemovedCount: subject.candidateAliasRemovedCount,
      boundaryEvidenceCandidateProvenanceRetainedCount: subject.candidateProvenanceRetainedCount,
      governedActionRoleCollisionCount: subject.candidateRoleMetrics.governedActionRoleCollisionCount,
      governedActionPrerequisiteOperationRefusedCount: subject.candidateRoleMetrics.governedActionPrerequisiteOperationRefusedCount,
      governedActionRoleUncertainCount: subject.candidateRoleMetrics.governedActionRoleUncertainCount,
      prerequisitePolarityCollisionObservedCount: subject.candidateRoleMetrics.prerequisitePolarityCollisionObservedCount,
      // Sanitized: the surface, the id, the decision and a span digest — never the matching detail.
      candidateRoleDecisions: subject.candidateRoleDecisions.map((r) => ({
        surfaceRef: r.surfaceRef,
        candidateId: r.candidateId,
        roleEligibility: r.roleEligibility,
        refusalCode: r.refusalCode,
        spanSha256: r.candidateSpanSha256,
      })),
      evidenceCandidateMapSha256: subject.evidenceCandidateMapSha256,
      truthStateTableSha256: truthStateTableSha256(),
      governedActionCandidateSelectedCount: truth.governedActionCandidateSelectedCount,
      prerequisiteSatisfactionCandidateSelectedCount: truth.prerequisiteSatisfactionCandidateSelectedCount,
      prerequisiteFailureCandidateSelectedCount: truth.prerequisiteFailureCandidateSelectedCount,
      unknownCandidateIdCount:
        effective.outcome === "boundary_review_malformed" ? effective.findings.filter((f) => f.code === "boundary_candidate_unknown").length : 0,
      ambiguousLegacyCandidateCount: 0,
      derivedApplicabilityCount: effective.derived.length,
      derivedComplianceCount: effective.derived.length,
      modelAuthoredApplicabilityCount: truth.modelAuthoredApplicabilityCount,
      modelAuthoredComplianceCount: truth.modelAuthoredComplianceCount,
      promptSchemaFieldDriftCount: promptFieldDriftCount(),
      failedSubsetRepairSurfaceCount,
      failedSubsetRepairInvocationCount,
      preservedValidAssessmentCount: preserved.length,
    };

    if (decision.action === "repair_failed_subset") {
      // Only the refused surfaces are re-requested. Everything the first response got right is kept
      // exactly as derived and is never sent back to the provider.
      reruns++;
      repairSurfaceRefs = decision.surfaceRefs;
      preserved = effective.outcome === "boundary_review_malformed" ? effective.derived : [];
      failedSubsetRepairSurfaceCount = decision.surfaceRefs.length;
      failedSubsetRepairInvocationCount += 1;
      log("boundary_review_failed_subset_repair", effective.outcome === "boundary_review_malformed" ? effective.codes[0] : undefined, {
        boundaryReviewSubjectSha256: subjectSha,
        because: decision.because,
        repairSurfaceRefs: decision.surfaceRefs,
        preservedSurfaceCount: preserved.length,
        boundaryReviewOutcome: "boundary_output_contract_failure",
      });
      continue;
    }

    if (decision.action === "rerun_boundary_review") {
      reruns++;
      log("boundary_review_rerun", effective.outcome === "boundary_review_malformed" ? effective.codes[0] : undefined, {
        boundaryReviewSubjectSha256: subjectSha,
        because: decision.because,
        // R2.32 — name the precise class so an output-contract failure is never read as a coverage
        // or grounding failure. They have different remedies.
        boundaryReviewOutcome: base.outputContractFailure ? "boundary_output_contract_failure" : "boundary_review_malformed",
        // R2.48 — WHICH evidence role was unavailable, never collapsed into one summary code.
        prerequisiteUnavailable: effective.outcome === "boundary_review_malformed" ? (effective.prerequisiteUnavailable ?? []) : [],
        ...(effective.outcome === "boundary_review_malformed" ? (effective.prerequisiteUnavailableMetrics ?? EMPTY_PREREQ_UNAVAILABLE) : EMPTY_PREREQ_UNAVAILABLE),
        modelReasonRequiredCount: tally.required,
        modelReasonMissingCount: tally.missing,
        modelReasonUnexpectedCount: tally.unexpected,
      });
      continue;
    }

    if (decision.action === "continue") {
      log("boundary_review_pass", undefined, { boundaryReviewSubjectSha256: subjectSha, surfaceMapSha256: mapSha });
      return { ...empty("boundary_review_pass"), ...base, outcome: "boundary_review_pass", reruns, broadReviewAllowed: true };
    }

    if (decision.action === "correction_path") {
      const rejected = effective.outcome === "boundary_review_reject" ? effective : null;
      const violations = rejected?.violations ?? [];
      const causal = rejected?.causalViolations ?? [];
      const downstream = rejected?.downstreamViolations ?? [];
      // R2.30 Part 9 — CORRECTION PRECISION. Only EARLIEST CAUSAL and independently-new violations
      // become correction findings. A descendant that repeats its ancestor's mechanism and governed
      // action is kept as evidence, never as a separate instruction: the R2.29 live run produced
      // nine defects where four describe the whole problem.
      const groups = rejected?.causalGroups ?? [];
      const findings = projectCausalFindings(groups, causal, surfaceByRef);
      log("boundary_review_reject", findings[0]?.code, {
        boundaryReviewSubjectSha256: subjectSha,
        defectCodes: [...new Set(findings.map((f) => f.code))],
        violations,
        causalViolations: causal.map((v) => v.surfaceRef),
        downstreamViolations: downstream.map((v) => v.surfaceRef),
        causalAttributions: (rejected?.causalAttributions ?? []).map((a) => `${a.ancestorSurfaceRef}<-${a.manifestationSurfaceRef}`),
        causalCorrectionGroups: groups.map((g) => [g.correctionOwnerSurfaceRef, ...g.manifestationSurfaceRefs].join("+")),
      });
      return {
        ...empty("boundary_review_reject"),
        ...base,
        outcome: "boundary_review_reject",
        violations,
        causalViolations: causal,
        downstreamViolations: downstream,
        causalAttributions: rejected?.causalAttributions ?? [],
        causalGroups: groups,
        causalAttributionMetrics: rejected?.causalAttributionMetrics ?? EMPTY_CAUSAL_METRICS,
        findings,
        reruns,
      };
    }

    if (decision.action === "inconclusive") {
      const uncertainties = effective.outcome === "boundary_review_inconclusive" ? effective.uncertainties : [];
      log("boundary_review_inconclusive", uncertainties[0]?.surfaceRef, { boundaryReviewSubjectSha256: subjectSha, uncertainties });
      return { ...empty("boundary_review_inconclusive"), ...base, outcome: "boundary_review_inconclusive", uncertainties, reruns };
    }

    if (decision.action === "boundary_reviewer_terminal_failure") {
      // The terminal CLASS stays `boundary_reviewer_terminal_failure` (R2.32 Part 8 preserves the
      // existing policy); the precise SUBCODE travels with it.
      const subcode = base.outputContractFailure ? "boundary_output_contract_failure" : undefined;
      log("boundary_reviewer_terminal_failure", subcode ?? (effective.outcome === "boundary_review_malformed" ? effective.codes[0] : undefined), {
        boundaryReviewSubjectSha256: subjectSha,
        scenarioUnjudged: true,
        because: decision.because,
        boundaryReviewOutcome: subcode ?? "boundary_review_malformed",
      });
      return {
        ...empty("boundary_reviewer_terminal_failure"),
        ...base,
        outcome: "boundary_reviewer_terminal_failure",
        codes: subcode ? [subcode] : [],
        reruns,
      };
    }

    // R2.34 — A PROVIDER FAILURE IS NOT A REVIEWER FAILURE. R2.33 measured this reported as
    // `boundary_reviewer_terminal_failure`, which asserts the reviewer produced two unusable
    // responses over an identical subject. It never saw the subject. The top level is now
    // `provider_failure`; the precise class and the stage subcode both travel with it.
    const providerCode = call.evidence.providerFailureCode ?? "provider_failure_unknown";
    log("provider_failure", providerCode, {
      boundaryReviewSubjectSha256: subjectSha,
      scenarioUnjudged: true,
      boundaryReviewOutcome: "provider_failure",
      providerFailureCode: providerCode,
      responseState: call.evidence.transport?.responseState,
      httpStatus: call.evidence.transport?.httpStatus ?? undefined,
      retriability: call.evidence.transport?.retriability,
      failureLayer: call.evidence.transport?.failureLayer,
      providerInvocations,
      semanticAttempts,
    });
    return {
      ...empty("provider_failure"),
      ...base,
      outcome: "provider_failure",
      // The stage compatibility subcode is preserved beneath the corrected top level.
      codes: [decision.code],
      providerFailureCode: providerCode,
      reruns,
    };
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

/**
 * R2.32 — count what the model was ASKED for versus what it supplied, per attempt. This is how an
 * auditor distinguishes "returned empty reason correctly" (the R2.30 case, now valid) from
 * "omitted a reason the state genuinely required".
 */
/**
 * PROMPT / SCHEMA FIELD DRIFT, counted every run.
 *
 * R2.36 shipped a prompt naming two fields the schema had already deleted, and nothing noticed for a
 * whole slice. This must read ZERO. A non-zero value means the prompt is instructing the reviewer to
 * fill something that does not exist.
 */
export function promptFieldDriftCount(): number {
  const fields = Object.keys(NARROW_BOUNDARY_JSON_SCHEMA.properties.assessments.items.properties);
  const parity = checkPromptFieldParity(NARROW_BOUNDARY_SYSTEM_PROMPT, fields, PROMPT_EXPLANATORY_VOCABULARY);
  return parity.unknownTokens.length + instructiveRemovedFieldMentions(NARROW_BOUNDARY_SYSTEM_PROMPT, REMOVED_MODEL_AUTHORED_FIELDS).length;
}

/**
 * Distributions over the truth fields of the deciding attempt. These are the numbers that make the
 * R2.35 defect visible in aggregate: a reviewer answering `not_established` and rejecting anyway, or
 * one whose prerequisite evidence is overwhelmingly inherited rather than own, is now countable.
 */
export function tallyTruthFields(parsed: unknown): {
  governedActionStatusCounts: Record<string, number>;
  prerequisiteStatusCounts: Record<string, number>;
  temporalRelationCounts: Record<string, number>;
  governedActionCandidateSelectedCount: number;
  prerequisiteSatisfactionCandidateSelectedCount: number;
  prerequisiteFailureCandidateSelectedCount: number;
  /**
   * R2.38 — these MUST stay zero. The model has no applicability or compliance field, so a non-zero
   * count means something re-introduced the axis R2.37 proved was the root cause.
   */
  modelAuthoredApplicabilityCount: number;
  modelAuthoredComplianceCount: number;
} {
  const governedActionStatusCounts: Record<string, number> = {};
  const prerequisiteStatusCounts: Record<string, number> = {};
  const temporalRelationCounts: Record<string, number> = {};
  let governedActionCandidateSelectedCount = 0;
  let prerequisiteSatisfactionCandidateSelectedCount = 0;
  let prerequisiteFailureCandidateSelectedCount = 0;
  let modelAuthoredApplicabilityCount = 0;
  let modelAuthoredComplianceCount = 0;
  const rows = parsed && typeof parsed === "object" && Array.isArray((parsed as { assessments?: unknown[] }).assessments)
    ? ((parsed as { assessments: unknown[] }).assessments as Array<Record<string, unknown>>)
    : [];
  for (const r of rows) {
    const bump = (m: Record<string, number>, k: unknown) => {
      if (typeof k === "string" && k) m[k] = (m[k] ?? 0) + 1;
    };
    bump(governedActionStatusCounts, r.governedActionStatus);
    bump(prerequisiteStatusCounts, r.prerequisiteStatus);
    bump(temporalRelationCounts, r.temporalRelation);
    const chose = (v: unknown) => typeof v === "string" && v.trim() !== "" && v !== NO_CANDIDATE;
    if (chose(r.governedActionCandidateId)) governedActionCandidateSelectedCount++;
    if (chose(r.prerequisiteSatisfactionCandidateId)) prerequisiteSatisfactionCandidateSelectedCount++;
    if (chose(r.prerequisiteFailureCandidateId)) prerequisiteFailureCandidateSelectedCount++;
    if ("applicability" in r) modelAuthoredApplicabilityCount++;
    if ("compliance" in r) modelAuthoredComplianceCount++;
  }
  return {
    governedActionStatusCounts,
    prerequisiteStatusCounts,
    temporalRelationCounts,
    governedActionCandidateSelectedCount,
    prerequisiteSatisfactionCandidateSelectedCount,
    prerequisiteFailureCandidateSelectedCount,
    modelAuthoredApplicabilityCount,
    modelAuthoredComplianceCount,
  };
}

/**
 * Per-attempt reason bookkeeping, keyed on the CANONICAL TRUTH-STATE TABLE.
 *
 * R2.32 established that correct silence must never be read as an omission. R2.38 keeps that policy
 * and moves its authority: the state table now says which states require the model's own words, so
 * this counter reads the same table the prompt and the validator do.
 */
export function tallyModelReason(parsed: unknown): { required: number; missing: number; unexpected: number } {
  const rows =
    parsed && typeof parsed === "object" && Array.isArray((parsed as { assessments?: unknown[] }).assessments)
      ? ((parsed as { assessments: unknown[] }).assessments as Array<Record<string, unknown>>)
      : [];
  let required = 0;
  let missing = 0;
  let unexpected = 0;
  for (const r of rows) {
    const state = classifyTruthState(
      {
        governedActionStatus: r.governedActionStatus as never,
        prerequisiteStatus: r.prerequisiteStatus as never,
        temporalRelation: r.temporalRelation as never,
      },
      "prerequisite_before_action",
    );
    if (!state) continue;
    const prose = typeof r.reason === "string" && r.reason.trim().length > 0;
    if (state.reasonAuthority === "model_required") {
      required++;
      if (!prose) missing++;
    } else if (prose) {
      unexpected++;
    }
  }
  return { required, missing, unexpected };
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
  // R2.32 — explanation and reason-contract counters.
  serverDerivedExplanationCount: number;
  modelReasonRequiredCount: number;
  modelReasonMissingCount: number;
  /** Prose supplied where the server owns the explanation. Ignored for authority; a drift signal. */
  modelReasonUnexpectedCount: number;
  boundaryOutputContractFailureCount: number;
  // R2.34 — invocation / response / semantic / transport are four different questions.
  boundaryProviderInvocationCount: number;
  boundaryProviderResponseCount: number;
  boundarySemanticReviewAttemptCount: number;
  boundaryTransportFailureCount: number;
  /** Reserved. No automatic transport retry exists; an authorized one would increment this. */
  boundaryTransportRetryCount: number;
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
  serverDerivedExplanationCount: 0,
  modelReasonRequiredCount: 0,
  modelReasonMissingCount: 0,
  modelReasonUnexpectedCount: 0,
  boundaryOutputContractFailureCount: 0,
  boundaryProviderInvocationCount: 0,
  boundaryProviderResponseCount: 0,
  boundarySemanticReviewAttemptCount: 0,
  boundaryTransportFailureCount: 0,
  boundaryTransportRetryCount: 0,
});

/**
 * Evidence that could not be resolved to a server-issued candidate.
 *
 * R2.38 replaced the R2.29-R2.36 grounding codes: a model can no longer author an excerpt, so
 * "ungrounded" now means "named an id the server did not issue for this surface and role". The
 * counter keeps its name and its meaning — evidence that carries no authority.
 */
const UNGROUNDED_CODES = new Set([
  "boundary_candidate_unknown",
  "boundary_candidate_wrong_surface",
  "boundary_candidate_wrong_role",
  "boundary_candidate_wrong_boundary",
]);

/** Codes that fire when a claimed violation could not supply the evidence its state requires. */
const UNSUPPORTED_VIOLATION_CODES = new Set([
  "boundary_candidate_required_missing",
  "boundary_candidate_forbidden_present",
  "boundary_prerequisite_contradiction",
  "boundary_assessment_state_invalid",
]);

/** Fold one stage result into the running metrics. Pure. */
export function accumulateBoundaryMetrics(m: BoundaryReviewMetrics, r: BoundaryStageResult): BoundaryReviewMetrics {
  const malformedCodes = r.evidences.flatMap((e) => (e.verdict.outcome === "boundary_review_malformed" ? e.verdict.codes : []));
  const ungrounded = malformedCodes.filter((c) => UNGROUNDED_CODES.has(c)).length;
  const prevented = malformedCodes.filter((c) => UNSUPPORTED_VIOLATION_CODES.has(c)).length;
  // R2.38 — applicability counters read the SERVER'S derivation, not a model field. The model has
  // no applicability field, so counting one would silently read zero forever.
  const last = [...r.evidences].reverse().find((e) => e.verdict.outcome !== "boundary_review_malformed");
  const rows = (last?.verdict.derived ?? []).map((d) => ({ applicability: d.applicability }));
  return {
    boundaryReviewCallCount: m.boundaryReviewCallCount + r.calls,
    // Semantic reruns only. A transport failure never increments this — it never reached the reviewer.
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
    // A server-derived explanation is NOT a reviewer call and NOT a semantic finding.
    serverDerivedExplanationCount: m.serverDerivedExplanationCount + r.explanations.filter((e) => e.authority === "server").length,
    modelReasonRequiredCount: m.modelReasonRequiredCount + r.modelReasonRequiredCount,
    modelReasonMissingCount: m.modelReasonMissingCount + r.modelReasonMissingCount,
    modelReasonUnexpectedCount: m.modelReasonUnexpectedCount + r.modelReasonUnexpectedCount,
    boundaryOutputContractFailureCount:
      m.boundaryOutputContractFailureCount +
      r.evidences.filter((e) => e.verdict.outcome === "boundary_review_malformed" && e.verdict.failureClass === "output_contract").length,
    boundaryProviderInvocationCount: m.boundaryProviderInvocationCount + r.providerInvocations,
    boundaryProviderResponseCount: m.boundaryProviderResponseCount + r.providerResponses,
    boundarySemanticReviewAttemptCount: m.boundarySemanticReviewAttemptCount + r.semanticAttempts,
    boundaryTransportFailureCount: m.boundaryTransportFailureCount + r.transportFailures,
    boundaryTransportRetryCount: m.boundaryTransportRetryCount, // no automatic transport retry exists
  };
}

/** Any nonzero terminal / inconclusive / ungrounded count fails the stability hard gate. */
export const boundaryMetricsPass = (m: BoundaryReviewMetrics): boolean =>
  m.boundaryReviewerTerminalFailureCount === 0 &&
  m.boundaryReviewInconclusiveCount === 0 &&
  m.boundaryEvidenceUngroundedCount === 0 &&
  m.boundaryOutputContractFailureCount === 0 &&
  m.boundaryTransportFailureCount === 0;
