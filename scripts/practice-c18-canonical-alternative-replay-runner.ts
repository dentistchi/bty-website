#!/usr/bin/env npx tsx
/**
 * CANONICAL-ALTERNATIVE REPLAY RUNNER BUILDER (Slice 3.2I-R5B1A.1-R2.54).
 *
 * Generates the runner WHOLE from tracked source and binds it to every digest that could change what
 * the boundary reviewer is asked or how its answer is projected — now including the R2.54 canonical
 * dependency-group shape authority, the apply seam that refuses before it merges, and the artifact /6
 * observability an auditor reads a refusal out of. PREPARED in R2.54, deliberately NOT EXECUTED.
 *
 *   npx tsx scripts/practice-c18-canonical-alternative-replay-runner.ts --out /tmp/r256_c18_classifier_replay_canary.sh
 *   npx tsx scripts/practice-c18-canonical-alternative-replay-runner.ts --binding-json
 *
 * WHY R2.52's CANARY IS NOT ENOUGH
 *
 * It proved the second call was a PATCH and not a whole-row re-ask, and that was true — the live run
 * that followed took the patch route exactly as bound. It still produced no verdict. The patch was
 * complete, unduplicated, untargeted-free and mutation-free, chose a CANONICALLY VALID state, crossed
 * the merge boundary, and was refused there by the canonical row validator with
 * `boundary_reason_required_missing`. Every counter the canary checked was clean.
 *
 * This canary therefore adds two legs the previous one could not have:
 *   - a CANONICAL leg: the plan-derived patch matches one complete alternative, all fourteen
 *     operations, and the merge boundary IS crossed;
 *   - a CAPTURED-R2.52 leg: the exact live selection that reached merge is refused BEFORE it, with
 *     the precise reason code, and artifact /6 says so in as many words.
 */
import { writeFileSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { buildContractManifest, manifestDigest } from "@/lib/bty/foundry/arena/contractManifest";
import { subjectDigests } from "@/domain/foundry/arena-draft/reviewSubject";
import { boundaryProvenanceSha256 } from "@/domain/foundry/arena-draft/boundaryProvenance";
import {
  NARROW_BOUNDARY_JSON_SCHEMA,
  GOVERNED_ACTION_STATUSES,
  PREREQUISITE_STATUSES,
  TEMPORAL_RELATIONS,
  REMOVED_MODEL_AUTHORED_FIELDS,
  SUBSET_REPAIR_CODES,
} from "@/domain/foundry/arena-draft/narrowBoundaryReview";
import { parityTableSha256 } from "@/domain/foundry/arena-draft/boundaryReasonParity";
import { explanationAuthoritySha256 } from "@/domain/foundry/arena-draft/boundaryExplanation";
import {
  BOUNDARY_REPORTABLE_OUTCOMES,
  MAX_BOUNDARY_PROVIDER_INVOCATIONS_PER_FROZEN_SUBJECT,
  MAX_BOUNDARY_SEMANTIC_RESPONSES_PER_FROZEN_SUBJECT,
  NARROW_REPLAY_ARTIFACT_VERSION,
  renderAllowedOutcomes,
} from "@/domain/foundry/arena-draft/boundaryOutcomes";
import { PROVIDER_FAILURE_CODES, transportEvidenceSha256 } from "@/domain/foundry/arena-draft/boundaryTransportEvidence";
import { NARROW_TIMEOUT_OWNER } from "@/lib/bty/foundry/arena/narrowBoundaryReviewer";
import {
  BRANCH_AWARE_REACHABLE_SURFACE_COUNT,
  compatibilitySurfaces,
  enumerateBoundarySurfaces,
  lineageSha256,
  reviewableSurfaces,
  surfaceMapSha256,
} from "@/domain/foundry/arena-draft/boundarySurfaces";
import {
  NARROW_BOUNDARY_SAMPLING,
  NARROW_BOUNDARY_SYSTEM_PROMPT,
  buildNarrowBoundaryContract,
  buildNarrowBoundarySubject,
  narrowBoundarySubjectSha256,
} from "@/lib/bty/foundry/arena/narrowBoundaryContract";
import type { ArenaScenarioDraft } from "@/domain/foundry/arena-draft/types";
import { semanticFrameContractSha256 } from "@/domain/foundry/arena-draft/boundarySemanticFrame";
import { candidateContractSha256, evidenceCandidateMapSha256 } from "@/domain/foundry/arena-draft/boundaryEvidenceCandidates";
import { candidateRoleContractSha256 } from "@/domain/foundry/arena-draft/boundaryCandidateRole";
import { EVIDENCE_POLARITY, POLARITY_REFUSAL_CODES, evidencePolarityContractSha256 } from "@/domain/foundry/arena-draft/boundaryEvidencePolarity";
import {
  ATTRIBUTION_AUTHORITY,
  ATTRIBUTION_REFUSAL_CODES,
  causalAttributionContractSha256,
} from "@/domain/foundry/arena-draft/generatedResultAttribution";
import {
  GOVERNING_RULE_KINDS,
  PREREQUISITE_UNAVAILABLE_CODES,
  TRUTH_STATES,
  classifyTruthState,
  renderCandidateRequirements,
  truthStateAmbiguities,
  truthStateCoverage,
} from "@/domain/foundry/arena-draft/boundaryTruthStates";
import { RULE_KINDS, buildSemanticFrame } from "@/domain/foundry/arena-draft/boundarySemanticFrame";
import { deriveGroupAlternatives, groupAlternativesSha256 } from "@/domain/foundry/arena-draft/boundaryGroupAlternatives";
import { PROHIBITION_BOUNDARY, PROHIBITION_BREACH_FACTS } from "@/domain/foundry/arena-draft/prohibitionBoundaryFixture";
import {
  FIELD_REPAIR_CODES,
  FIELD_REPAIR_JSON_SCHEMA,
  FIELD_REPAIR_SCHEMA_NAME,
  FIELD_REPAIR_OBSERVABILITY_VERSION,
  FIELD_REPAIR_VALUE_AUTHORITIES,
  FIELD_REPAIR_VALUE_MAX,
  REPAIRABLE_BOUNDARY_FIELDS,
  IDENTITY_FIELDS,
  fieldRepairContractSha256,
  governedActionClosure,
  prerequisiteClosure,
} from "@/domain/foundry/arena-draft/boundaryFieldRepair";
// R2.54 — the canonical dependency-group shape authority and the captured evidence it answers.
import {
  GROUP_ALTERNATIVES_VERSION,
  GROUP_SHAPE_CODES,
  REASON_AUTHORITY_MODES,
  REASON_CONSTRAINTS,
  groupAlternativeContractSha256,
} from "@/domain/foundry/arena-draft/boundaryGroupAlternatives";
import {
  R252_CAPTURED_PATCH,
  R252_LIVE_ARTIFACT_FILE,
  R252_LIVE_ARTIFACT_SHA256,
  R252_MEASURED,
  R252_SELECTED_STATE_ID,
} from "@/domain/foundry/arena-draft/r252LiveDtoFixture";
import { MODEL_REASON_MIN_CHARS } from "@/domain/foundry/arena-draft/boundaryReasonParity";
import { FIELD_REPAIR_SYSTEM_PROMPT } from "@/lib/bty/foundry/arena/narrowBoundaryContract";
import { BOUNDARY_STAGE_ROUTING_CONTRACT, REPAIR_MODES } from "@/lib/bty/foundry/arena/boundaryReviewStage";
import { NARROW_REPLAY_ARTIFACT_VERSION } from "@/domain/foundry/arena-draft/boundaryOutcomes";
import { DERIVED_APPLICABILITY, DERIVED_COMPLIANCE, truthStateTableSha256 } from "@/domain/foundry/arena-draft/boundaryTruthStates";
import { promptFieldDriftCount } from "@/lib/bty/foundry/arena/boundaryReviewStage";
import { buildC18Subject, SOURCE_ARTIFACT, SOURCE_ARTIFACT_SHA256, CASE_ID } from "./practice-c18-boundary-replay";

const REPO = "/Users/hanbit/Dev/btytrainingcenter/bty-app";
const BRANCH = "inner-main";
const BOUNDARY_ID = "c1_verify";
const BOUNDARY_TEXT = "Two identifiers must be verified before treatment";

const d = (v: unknown) => createHash("sha256").update(typeof v === "string" ? v : JSON.stringify(v)).digest("hex");
const shq = (v: string): string => `'${v.replace(/'/g, `'\\''`)}'`;

function arg(name: string, fallback?: string): string {
  const i = process.argv.indexOf(`--${name}`);
  const v = i >= 0 ? process.argv[i + 1] : undefined;
  if (v === undefined) {
    if (fallback !== undefined) return fallback;
    throw new Error(`missing --${name}`);
  }
  return v;
}

const head = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const manifest = manifestDigest(buildContractManifest(head, process.env.LLM_MODEL ?? "gpt-4o-mini"));
const broad = buildC18Subject(process.cwd(), join(process.cwd(), ".eval-artifacts"));
const digests = subjectDigests(broad.subject);
const provenance = broad.subject.boundaryProvenance!;
const surfaces = enumerateBoundarySurfaces(broad.subject.scenario as ArenaScenarioDraft, {});
const reachable = reviewableSurfaces(surfaces);
const excluded = compatibilitySurfaces(surfaces);
const narrowSubject = buildNarrowBoundarySubject({
  scenarioSha256: broad.subject.scenarioSha256,
  reviewSubjectSha256: digests.reviewSubjectSha256,
  boundaryProvenance: provenance,
  boundaryProvenanceSha256: boundaryProvenanceSha256(provenance),
  boundaries: broad.subject.confirmedBoundaries,
  surfaces,
  draft: broad.subject.scenario as ArenaScenarioDraft,
  language: broad.subject.language,
  generationAttemptId: broad.subject.generationAttemptId,
  caseId: CASE_ID,
});

const runtime = [
  "src/lib/bty/foundry/arena/boundaryReviewStage.ts",
  "src/lib/bty/foundry/arena/narrowBoundaryContract.ts",
  "src/lib/bty/foundry/arena/narrowBoundaryReviewer.ts",
  "src/lib/bty/foundry/arena/replayArtifact.ts",
  "src/lib/bty/foundry/arena/historicalBoundaryReconstruction.ts",
  "src/domain/foundry/arena-draft/narrowBoundaryReview.ts",
  "src/domain/foundry/arena-draft/boundarySurfaces.ts",
  "src/domain/foundry/arena-draft/boundaryProvenance.ts",
  "src/domain/foundry/arena-draft/boundaryContextSegments.ts",
  "src/domain/foundry/arena-draft/boundarySemanticFrame.ts",
  "src/domain/foundry/arena-draft/boundaryEvidenceCandidates.ts",
  "src/domain/foundry/arena-draft/boundaryTruthStates.ts",
  "src/domain/foundry/arena-draft/boundaryTruthContractTypes.ts",
  "src/domain/foundry/arena-draft/promptFieldParity.ts",
  "src/domain/foundry/arena-draft/boundaryCandidateRole.ts",
  "src/domain/foundry/arena-draft/boundaryEvidencePolarity.ts",
  "src/domain/foundry/arena-draft/generatedResultAttribution.ts",
  "src/domain/foundry/arena-draft/r246LiveDtoFixture.ts",
  "src/domain/foundry/arena-draft/r248LiveDtoFixture.ts",
  "src/domain/foundry/arena-draft/boundaryFieldRepair.ts",
  "src/domain/foundry/arena-draft/boundaryGroupAlternatives.ts",
  "src/domain/foundry/arena-draft/groupAlternativeSelection.fixture.ts",
  "src/domain/foundry/arena-draft/r252LiveDtoFixture.ts",
  "src/domain/foundry/arena-draft/boundaryOutcomes.ts",
  "src/domain/foundry/arena-draft/correctionPacket.ts",
  "src/domain/foundry/arena-draft/gatePrecedence.ts",
  "src/lib/bty/foundry/arena/narrowBoundaryReviewer.ts",
  "scripts/practice-c18-narrow-boundary-replay.ts",
  "scripts/practice-c18-boundary-replay.ts",
].map((f) => readFileSync(join(process.cwd(), f), "utf8")).join("\n");

const binding = {
  head,
  manifestSha256: manifest,
  sourceArtifact: SOURCE_ARTIFACT,
  sourceArtifactSha256: SOURCE_ARTIFACT_SHA256,
  reconstructionSourceSha256: provenance.reconstructionSources.map((s) => s.sha256),
  reconstructedSubjectSha256: digests.reviewSubjectSha256,
  boundaryProvenanceSha256: boundaryProvenanceSha256(provenance),
  scenarioSha256: digests.scenarioSha256,
  boundaryReviewSubjectSha256: narrowBoundarySubjectSha256(narrowSubject),
  boundaryReviewContractSha256: buildNarrowBoundaryContract().sha256,
  boundaryPromptSha256: d(NARROW_BOUNDARY_SYSTEM_PROMPT),
  boundarySchemaSha256: d(NARROW_BOUNDARY_JSON_SCHEMA),
  boundarySamplingSha256: d(NARROW_BOUNDARY_SAMPLING),
  surfaceMapSha256: surfaceMapSha256(surfaces),
  lineageSha256: lineageSha256(surfaces),
  reachableSurfaceCount: reachable.length,
  reachableSurfaceCoordinates: reachable.map((s) => s.coordinate),
  excludedCompatibilitySurfaces: excluded.map((s) => `${s.coordinate}->${s.compatibilitySource}`),
  // R2.38 — applicability, compliance and the mechanism are DERIVED. The contract records the
  // derivation vocabulary; the model has no field for any of them.
  applicabilityContractSha256: d({ applicability: DERIVED_APPLICABILITY, compliance: DERIVED_COMPLIANCE, modelAuthored: false }),
  violationMechanismContractSha256: d({ derivedFrom: ["ruleKind", "surfaceKind", "lineagePosition", "truthState"], modelAuthored: false }),
  correctionPacketContractSha256: d({ correctionFrom: "causal_violations_only", downstreamIsEvidenceOnly: true, notApplicableNeverCorrects: true }),
  worldStateAuthoritySha256: d({ escalationFallback: false, missingIsAuthorityFailure: true }),
  // R2.32 — the reason parity table, the explanation renderer and the outcome enumeration are all
  // part of what the reviewer is asked and how the answer is read.
  reasonParityTableSha256: parityTableSha256(),
  serverExplanationSha256: explanationAuthoritySha256(),
  outcomeEnumSha256: d([...BOUNDARY_REPORTABLE_OUTCOMES]),
  // R2.34 — what an artifact can PROVE about a failed call is part of the contract.
  transportEvidenceSha256: transportEvidenceSha256(),
  failureClassifierSha256: d([...PROVIDER_FAILURE_CODES]),
  timeoutOwnerSha256: d({ owner: NARROW_TIMEOUT_OWNER, timeoutMs: NARROW_BOUNDARY_SAMPLING.timeoutMs, signalWired: true }),
  callBudgetSha256: d({
    maxProviderInvocations: MAX_BOUNDARY_PROVIDER_INVOCATIONS_PER_FROZEN_SUBJECT,
    maxSemanticResponses: MAX_BOUNDARY_SEMANTIC_RESPONSES_PER_FROZEN_SUBJECT,
    automaticTransportRetry: false,
  }),
  artifactVersionSha256: d(NARROW_REPLAY_ARTIFACT_VERSION),
  // R2.36 — the CONTEXT the reviewer sees, the DECOMPOSITION of the rule, and what counts as
  // prerequisite truth. A replay run under a different context map is answering a different
  // question, and R2.35 measured exactly what that costs.
  contextSegmentMapSha256: narrowSubject.contextSegmentMapSha256,
  contextSegmentCount: narrowSubject.contextSegments.length,
  openingPresent: narrowSubject.opening.trim().length > 0,
  semanticFramesSha256: narrowSubject.semanticFramesSha256,
  semanticFrameContractSha256: semanticFrameContractSha256(),
  prerequisiteTruthContractSha256: d({
    governedActionStatuses: GOVERNED_ACTION_STATUSES,
    prerequisiteStatuses: PREREQUISITE_STATUSES,
    temporalRelations: TEMPORAL_RELATIONS,
    notEstablishedIsNeverViolation: true,
    satisfiedCannotViolate: true,
    failureMustConcernPrerequisite: true,
  }),
  // R2.38 — the MENU the reviewer is offered and the TABLE its answers are read under.
  evidenceCandidateMapSha256: evidenceCandidateMapSha256(narrowSubject.evidenceCandidates),
  evidenceCandidateCount: narrowSubject.evidenceCandidates.length,
  evidenceCandidateContractSha256: candidateContractSha256(),
  candidateAliasRemovedCount: narrowSubject.candidateAliasRemovedCount,
  candidateProvenanceRetainedCount: narrowSubject.candidateProvenanceRetainedCount,
  truthStateTableSha256: truthStateTableSha256(),
  removedModelAuthoredFieldsSha256: d(REMOVED_MODEL_AUTHORED_FIELDS),
  subsetRepairContractSha256: d({
    codes: SUBSET_REPAIR_CODES,
    repairableFailureClass: "output_contract",
    preservedRowsImmutable: true,
    maxRepairInvocations: 1,
  }),
  promptSchemaFieldDriftCount: promptFieldDriftCount(),
  // R2.40 — the role classifier and the pool-aware requirement rules.
  candidateRoleContractSha256: candidateRoleContractSha256(),
  governedActionRoleRefusedCount: narrowSubject.candidateRoleMetrics.governedActionPrerequisiteOperationRefusedCount,
  governedActionRoleUncertainCount: narrowSubject.candidateRoleMetrics.governedActionRoleUncertainCount,
  // R2.42 — the instruction the reviewer is actually given, and the projection authority.
  promptParityContractSha256: d({
    decisionTableKeyedOnPoolCardinality: true,
    sentinelOnlyWhenPoolEmpty: true,
    absentWithNonEmptyPoolSelects: true,
    contradictoryAbsentImpliesNoneRemoved: true,
  }),
  repairSubsetProjectionSha256: d({
    projectsFrozenSubject: true,
    canonicalOrderPreserved: true,
    unknownRefThrows: true,
    duplicateRefThrows: true,
    subjectDigestUnchanged: true,
    separateRepairSubsetDigest: true,
  }),
  // R2.44 — a prerequisite span must point the right way, not merely mention the prerequisite.
  evidencePolarityContractSha256: evidencePolarityContractSha256(),
  prerequisitePoolPolaritySha256: d({
    polarities: EVIDENCE_POLARITY,
    refusalCodes: POLARITY_REFUSAL_CODES,
    satisfactionOnlyRefusedFromFailure: true,
    failureOnlyRefusedFromSatisfaction: true,
    mixedKeepsFailureLosesSatisfaction: true,
    uncertainObservedNotEnforced: true,
    appliesToInheritedParentState: true,
  }),
  // R2.46 — correction ownership derived from the generation schema's own lineage edge.
  // R2.52 — EXECUTABLE-PATH bindings. R2.51 measured every R2.50 content digest matching while the
  // legacy whole-row repair actually ran; these move if the wiring is undone.
  stageRoutingContractSha256: d(BOUNDARY_STAGE_ROUTING_CONTRACT),
  repairDependencyRequired: BOUNDARY_STAGE_ROUTING_CONTRACT.repairDependencyRequired,
  activeStageHasWholeRowFallback: BOUNDARY_STAGE_ROUTING_CONTRACT.activeStageHasWholeRowFallback,
  secondCallSchemaName: BOUNDARY_STAGE_ROUTING_CONTRACT.secondCallSchemaName,
  fullRowReviewCap: BOUNDARY_STAGE_ROUTING_CONTRACT.fullRowReviewCallsPerSubject,
  patchRepairCap: BOUNDARY_STAGE_ROUTING_CONTRACT.fieldRepairCallsPerSubject,
  legacyWholeRowRepairCap: BOUNDARY_STAGE_ROUTING_CONTRACT.legacyWholeRowRepairCallsPerSubject,
  writtenReplayArtifactVersion: NARROW_REPLAY_ARTIFACT_VERSION,
  repairModes: REPAIR_MODES,
  // R2.50 — the ONE permitted repair is a PATCH against a server-owned plan.
  fieldRepairContractSha256: fieldRepairContractSha256(),
  fieldRepairSchemaSha256: d(FIELD_REPAIR_JSON_SCHEMA),
  fieldRepairSchemaName: FIELD_REPAIR_SCHEMA_NAME,
  fieldRepairPromptSha256: d(FIELD_REPAIR_SYSTEM_PROMPT),
  fieldRepairCodes: FIELD_REPAIR_CODES,
  fieldRepairPlanContractSha256: d({
    repairableFields: REPAIRABLE_BOUNDARY_FIELDS,
    identityFieldsNeverRepairable: IDENTITY_FIELDS,
    prerequisiteClosure: prerequisiteClosure(),
    governedActionClosure: governedActionClosure(),
    closureDerivedFromTruthStateTable: true,
    baseIsParsedAttemptOneRow: true,
    frozenFieldsAbsentFromExchange: true,
    frozenSemanticFieldImmutableEvenAgainstHumanOracle: true,
  }),
  fieldRepairMergeAuthoritySha256: d({
    order: ["verify_base_row_digest", "apply_accepted_operations", "copy_untargeted_fields", "revalidate_with_canonical_validator"],
    repairLayerNeverConstructsVerdict: true,
    partialMatrixNeverProducesVerdict: true,
    forbiddenCandidateNeverNormalized: true,
    extraOperationsRefusedNotDiscarded: true,
    fieldRepairFrozenMutationCount: 0,
  }),
  repairCallCap: 1,
  // ---------------------------------------------------------------------------------------------
  // R2.54 — the CANONICAL DEPENDENCY-GROUP SHAPE authority, the apply seam, and artifact /6.
  //
  // R2.52's canary bound the ROUTE. It could not bind what the route ACCEPTS: a patch that satisfied
  // every per-field list, crossed the merge and was refused there. These bindings move if the group
  // stops being the unit of acceptance, if `reason` leaves the closure, if a scalar list regains
  // authority over it, or if a refused patch can reach the merge again.
  // ---------------------------------------------------------------------------------------------
  groupAlternativeAuthoritySha256: groupAlternativeContractSha256(),
  groupAlternativesVersion: GROUP_ALTERNATIVES_VERSION,
  groupShapeCodes: GROUP_SHAPE_CODES,
  reasonConstraints: REASON_CONSTRAINTS,
  reasonAuthorityModes: REASON_AUTHORITY_MODES,
  fieldRepairValueAuthorities: FIELD_REPAIR_VALUE_AUTHORITIES,
  fieldRepairValueMax: FIELD_REPAIR_VALUE_MAX,
  reasonIsRepairable: REPAIRABLE_BOUNDARY_FIELDS.includes("reason"),
  prerequisiteClosureIncludesReason: prerequisiteClosure().includes("reason"),
  prerequisiteClosureSize: prerequisiteClosure().length,
  canonicalAlternativeContractSha256: d({
    version: GROUP_ALTERNATIVES_VERSION,
    shapeCodes: GROUP_SHAPE_CODES,
    reasonConstraints: REASON_CONSTRAINTS,
    reasonAuthorityModes: REASON_AUTHORITY_MODES,
    valueAuthorities: FIELD_REPAIR_VALUE_AUTHORITIES,
    multiFieldGroupRequiresCanonicalAlternative: true,
    scalarMembershipInsufficientForMultiFieldGroups: true,
    reasonIsAGroupMemberNotAScalarDomain: true,
    reasonAuthorityComesFromMatchedAlternative: true,
    governedActionFieldsStayOutsideThePrerequisiteGroup: true,
    incompleteGroupIsCompletenessNotShape: true,
    alternativesBoundIntoPlanDigest: true,
    alternativesDerivedFromTruthStateTable: true,
    alternativesRoundTripThroughClassifier: true,
    serverMayValidateNeverChoose: true,
    reasonContractUnchanged: { minChars: MODEL_REASON_MIN_CHARS, genericPhrasesRefused: true },
    operationValueMaxIsTheReasonCap: FIELD_REPAIR_VALUE_MAX,
  }),
  fieldRepairApplySeamSha256: d({
    seam: "applyFieldRepair",
    order: ["validate", "refuse_or_merge"],
    refusedPatchNeverReachesMerge: true,
    mergeAttemptRecorded: true,
    stageUsesTheSeam: BOUNDARY_STAGE_ROUTING_CONTRACT.secondCallApplySeam,
  }),
  fieldRepairObservabilityVersion: FIELD_REPAIR_OBSERVABILITY_VERSION,
  fieldRepairObservabilitySha256: d({
    version: FIELD_REPAIR_OBSERVABILITY_VERSION,
    reportsOperationPlanCount: true,
    reportsDependencyGroupIdentityAndFields: true,
    reportsAlternativesCountAndDigest: true,
    reportsSelectedGroupValues: true,
    reportsMatchedAlternativeIdentity: true,
    reportsRefusalCodes: true,
    reportsMergeAttempted: true,
    reportsReasonAuthorityMode: true,
    withholdsModelReasonProse: true,
    reasonReportedAsShapeOnly: true,
    artifactVersion: NARROW_REPLAY_ARTIFACT_VERSION,
  }),
  // The captured R2.52 evidence this canary answers, bound so it cannot be quietly re-authored.
  capturedR252ArtifactFile: R252_LIVE_ARTIFACT_FILE,
  capturedR252ArtifactSha256: R252_LIVE_ARTIFACT_SHA256,
  capturedR252PatchSha256: d(R252_CAPTURED_PATCH),
  capturedR252OperationsSent: R252_MEASURED.operationsSent,
  capturedR252ReachedMergeBoundary: R252_MEASURED.reachedMergeBoundary,
  capturedR252MergedRowRefusalCode: R252_MEASURED.mergedRowRefusalCode,
  capturedR252SelectedStateId: R252_SELECTED_STATE_ID,
  /**
   * DEFERRED, AND SAID SO. `classifyTruthState` can return `prohibited_action_present` at a
   * prerequisite boundary. R2.54 neither introduced nor resolved that; the characterization test
   * records the current behaviour and a live replay stays blocked on the separate forensic.
   */
  /**
   * R2.56 — the classifier forensic is CLOSED. `prohibited_action_present` is scoped to prohibition
   * rules in row data, rule kind is a filter dimension, and the dead tiebreak is gone. These
   * bindings move if any of that is undone.
   */
  classifierForensicDeferred: false,
  ruleKindIsAFilterDimension: true,
  deadRuleKindTiebreakRemoved: true,
  ruleKinds: RULE_KINDS,
  governingRuleKinds: GOVERNING_RULE_KINDS,
  truthStateRuleKindScopeSha256: d(TRUTH_STATES.map((s2) => ({ id: s2.id, appliesToRuleKinds: s2.appliesToRuleKinds }))),
  /** MUST be zero — the table defines a function over (ruleKind x facts). */
  truthStateAmbiguityCount: truthStateAmbiguities(RULE_KINDS, GOVERNED_ACTION_STATUSES, PREREQUISITE_STATUSES, TEMPORAL_RELATIONS).length,
  truthStateCoverageSha256: d(truthStateCoverage(GOVERNED_ACTION_STATUSES, PREREQUISITE_STATUSES, TEMPORAL_RELATIONS)),
  /** The c18 prerequisite frame must NOT reach the prohibition state. */
  c18ClassifiesProhibitionTriple: null as string | null,
  c18AlternativeStateIds: (() => {
    const alts = deriveGroupAlternatives({
      boundaryId: BOUNDARY_ID,
      surfaceRef: "branch[0].resulting_world_state",
      governedActionStatus: "present",
      groupFields: ["prerequisiteStatus", "temporalRelation", "prerequisiteSatisfactionCandidateId", "prerequisiteFailureCandidateId", "reason"],
      ruleKind: buildSemanticFrame({ id: BOUNDARY_ID, statement: BOUNDARY_TEXT }).ruleKind,
      candidates: narrowSubject.evidenceCandidates,
    });
    return alts.map((a) => a.stateId);
  })(),
  c18AlternativesSha256: (() => {
    const alts = deriveGroupAlternatives({
      boundaryId: BOUNDARY_ID,
      surfaceRef: "branch[0].resulting_world_state",
      governedActionStatus: "present",
      groupFields: ["prerequisiteStatus", "temporalRelation", "prerequisiteSatisfactionCandidateId", "prerequisiteFailureCandidateId", "reason"],
      ruleKind: buildSemanticFrame({ id: BOUNDARY_ID, statement: BOUNDARY_TEXT }).ruleKind,
      candidates: narrowSubject.evidenceCandidates,
    });
    return groupAlternativesSha256(alts);
  })(),
  /** And the genuine prohibition frame must still reach it. */
  prohibitionFixtureRuleKind: buildSemanticFrame(PROHIBITION_BOUNDARY).ruleKind,
  prohibitionFixtureFacts: PROHIBITION_BREACH_FACTS,
  classifyTruthStateModifiedByThisSlice: true,
  // R2.48 — the two evidence axes, stated once and bound here.
  prerequisiteCandidateAuthoritySha256: d({
    governedActionAxis: "pool_cardinality",
    prerequisiteAxis: "truth_state",
    forbiddenMeansNoneRegardlessOfPool: true,
    requiredWithEmptyPoolIsUnsupported: true,
    emptyPoolNeverLicensesEvidenceFreeFinding: true,
    unavailableCodes: PREREQUISITE_UNAVAILABLE_CODES,
    roleDistinguishingCodes: true,
    governedActionEmptyPoolContractUnchanged: true,
  }),
  prerequisiteUnavailableCodes: PREREQUISITE_UNAVAILABLE_CODES,
  truthStateCandidateRequirementsSha256: d(
    TRUTH_STATES.map((t) => ({
      id: t.id,
      governedActionCandidate: t.governedActionCandidate,
      satisfactionCandidate: t.satisfactionCandidate,
      failureCandidate: t.failureCandidate,
      renderedClause: renderCandidateRequirements(t),
    })),
  ),
  causalAttributionContractSha256: causalAttributionContractSha256(),
  causalAttributionAuthority: ATTRIBUTION_AUTHORITY,
  causalAttributionRefusalCodes: ATTRIBUTION_REFUSAL_CODES,
  directRowImmutabilityContractSha256: d({
    ancestorDirectAssessmentMutationCount: 0,
    ancestorGovernedActionStatusPreserved: true,
    ancestorGovernedActionCandidateIdPreserved: true,
    ancestorApplicabilityPreserved: true,
    childCandidateIdsPreserved: true,
    childViolationMechanismPreserved: true,
    candidatePoolsUnchanged: true,
    crossSurfaceCandidateCitationStillRefused: "boundary_candidate_wrong_surface",
  }),
  packetDedupContractSha256: d({
    groupedBy: "explicit_causal_group_identity",
    dedupBasisIsMechanismEquality: false,
    manifestationEmitsNoSeparateInstruction: true,
    independentlySelectableReopeningRemainsOwnOwner: true,
    packetItemsPerCausalGroup: 1,
    ownerAndManifestationShareOneItemAtTwoCoordinates: true,
  }),
  // Hard caps this replay may not exceed.
  providerInvocationCap: MAX_BOUNDARY_PROVIDER_INVOCATIONS_PER_FROZEN_SUBJECT,
  semanticResponseCap: MAX_BOUNDARY_SEMANTIC_RESPONSES_PER_FROZEN_SUBJECT,
  automaticTransportRetries: 0,
  generationCalls: 0,
  broadReviewCalls: 0,
  databaseCalls: 0,
  deploymentActions: 0,
  poolAwareRequirementContractSha256: d({
    requiredOnlyWhenPoolNonEmpty: true,
    presentStatusRequiresNonEmptyPool: true,
    emptyPoolAcceptsSentinel: true,
  }),
  activeBoundaryIds: provenance.activeBoundaryIds,
  boundaryText: provenance.confirmedBoundaries.map((b) => b.statement),
  artifactSchemaVersion: NARROW_REPLAY_ARTIFACT_VERSION,
  replayRuntimeSha256: d(runtime),
};

const CHECKS: Array<[string, string]> = [
  ["contract manifest", "manifestSha256"],
  // R2.44 + R2.46 — the authorities this canary exists to exercise.
  ["prerequisite evidence polarity", "evidencePolarityContractSha256"],
  ["prerequisite pool polarity", "prerequisitePoolPolaritySha256"],
  ["stage routing contract", "stageRoutingContractSha256"],
  ["repair dependency required", "repairDependencyRequired"],
  ["no whole-row fallback", "activeStageHasWholeRowFallback"],
  ["second-call schema name", "secondCallSchemaName"],
  ["full-row review cap", "fullRowReviewCap"],
  ["patch repair cap", "patchRepairCap"],
  ["legacy whole-row repair cap", "legacyWholeRowRepairCap"],
  ["written replay artifact version", "writtenReplayArtifactVersion"],
  ["repair modes", "repairModes"],
  ["field repair authority", "fieldRepairContractSha256"],
  ["field repair schema", "fieldRepairSchemaSha256"],
  ["field repair schema name", "fieldRepairSchemaName"],
  ["field repair prompt", "fieldRepairPromptSha256"],
  ["field repair codes", "fieldRepairCodes"],
  ["field repair plan contract", "fieldRepairPlanContractSha256"],
  ["field repair merge authority", "fieldRepairMergeAuthoritySha256"],
  ["repair call cap", "repairCallCap"],
  // R2.54 — the authorities this canary exists to bind.
  ["group alternative authority", "groupAlternativeAuthoritySha256"],
  ["group alternatives version", "groupAlternativesVersion"],
  ["group shape codes", "groupShapeCodes"],
  ["reason constraints", "reasonConstraints"],
  ["reason authority modes", "reasonAuthorityModes"],
  ["field repair value authorities", "fieldRepairValueAuthorities"],
  ["field repair value max", "fieldRepairValueMax"],
  ["reason is repairable", "reasonIsRepairable"],
  ["prerequisite closure includes reason", "prerequisiteClosureIncludesReason"],
  ["prerequisite closure size", "prerequisiteClosureSize"],
  ["canonical alternative contract", "canonicalAlternativeContractSha256"],
  ["field repair apply seam", "fieldRepairApplySeamSha256"],
  ["field repair observability version", "fieldRepairObservabilityVersion"],
  ["field repair observability", "fieldRepairObservabilitySha256"],
  ["captured R2.52 artifact", "capturedR252ArtifactSha256"],
  ["captured R2.52 patch", "capturedR252PatchSha256"],
  ["captured R2.52 operations sent", "capturedR252OperationsSent"],
  ["captured R2.52 reached merge", "capturedR252ReachedMergeBoundary"],
  ["captured R2.52 merged-row refusal", "capturedR252MergedRowRefusalCode"],
  ["captured R2.52 selected state", "capturedR252SelectedStateId"],
  ["classifier forensic deferred", "classifierForensicDeferred"],
  ["classifier changed by R2.56", "classifyTruthStateModifiedByThisSlice"],
  ["rule kind is a filter dimension", "ruleKindIsAFilterDimension"],
  ["dead tiebreak removed", "deadRuleKindTiebreakRemoved"],
  ["rule kinds", "ruleKinds"],
  ["governing rule kinds", "governingRuleKinds"],
  ["truth-state rule-kind scope", "truthStateRuleKindScopeSha256"],
  ["truth-state ambiguity count", "truthStateAmbiguityCount"],
  ["truth-state coverage", "truthStateCoverageSha256"],
  ["c18 classifies the prohibition triple", "c18ClassifiesProhibitionTriple"],
  ["c18 alternative state ids", "c18AlternativeStateIds"],
  ["c18 alternatives digest", "c18AlternativesSha256"],
  ["prohibition fixture rule kind", "prohibitionFixtureRuleKind"],
  ["prerequisite candidate authority", "prerequisiteCandidateAuthoritySha256"],
  ["prerequisite unavailable codes", "prerequisiteUnavailableCodes"],
  ["truth-state candidate requirements", "truthStateCandidateRequirementsSha256"],
  ["causal attribution", "causalAttributionContractSha256"],
  ["causal attribution authority", "causalAttributionAuthority"],
  ["causal attribution refusals", "causalAttributionRefusalCodes"],
  ["direct-row immutability", "directRowImmutabilityContractSha256"],
  ["packet dedup", "packetDedupContractSha256"],
  ["provider invocation cap", "providerInvocationCap"],
  ["semantic response cap", "semanticResponseCap"],
  ["automatic transport retries", "automaticTransportRetries"],
  ["generation calls", "generationCalls"],
  ["broad review calls", "broadReviewCalls"],
  ["database calls", "databaseCalls"],
  ["deployment actions", "deploymentActions"],
  ["source artifact", "sourceArtifactSha256"],
  ["reconstruction sources", "reconstructionSourceSha256"],
  ["reconstructed subject", "reconstructedSubjectSha256"],
  ["boundary provenance", "boundaryProvenanceSha256"],
  ["frozen scenario", "scenarioSha256"],
  ["boundary-review subject", "boundaryReviewSubjectSha256"],
  ["boundary-review contract", "boundaryReviewContractSha256"],
  ["boundary prompt", "boundaryPromptSha256"],
  ["boundary schema", "boundarySchemaSha256"],
  ["boundary sampling", "boundarySamplingSha256"],
  ["surface map", "surfaceMapSha256"],
  ["causal lineage", "lineageSha256"],
  ["reachable surface count", "reachableSurfaceCount"],
  ["reachable surface coordinates", "reachableSurfaceCoordinates"],
  ["excluded compatibility surfaces", "excludedCompatibilitySurfaces"],
  ["applicability contract", "applicabilityContractSha256"],
  ["violation-mechanism contract", "violationMechanismContractSha256"],
  ["correction-packet contract", "correctionPacketContractSha256"],
  ["world-state authority", "worldStateAuthoritySha256"],
  ["reason parity table", "reasonParityTableSha256"],
  ["server explanation authority", "serverExplanationSha256"],
  ["outcome enumeration", "outcomeEnumSha256"],
  ["transport evidence contract", "transportEvidenceSha256"],
  ["provider failure classifier", "failureClassifierSha256"],
  ["timeout owner", "timeoutOwnerSha256"],
  ["provider call budget", "callBudgetSha256"],
  ["artifact version", "artifactVersionSha256"],
  ["context segment map", "contextSegmentMapSha256"],
  ["context segment count", "contextSegmentCount"],
  ["scenario opening present", "openingPresent"],
  ["semantic frames", "semanticFramesSha256"],
  ["semantic frame contract", "semanticFrameContractSha256"],
  ["prerequisite truth contract", "prerequisiteTruthContractSha256"],
  ["evidence candidate map", "evidenceCandidateMapSha256"],
  ["evidence candidate count", "evidenceCandidateCount"],
  ["evidence candidate contract", "evidenceCandidateContractSha256"],
  ["candidate role classifier", "candidateRoleContractSha256"],
  ["governed-action role refusals", "governedActionRoleRefusedCount"],
  ["governed-action role uncertain", "governedActionRoleUncertainCount"],
  ["pool-aware requirement contract", "poolAwareRequirementContractSha256"],
  ["prompt parity contract", "promptParityContractSha256"],
  ["repair subset projection contract", "repairSubsetProjectionSha256"],
  ["repair merge authority", "subsetRepairContractSha256"],
  ["candidate aliases removed", "candidateAliasRemovedCount"],
  ["candidate provenance retained", "candidateProvenanceRetainedCount"],
  ["canonical truth-state table", "truthStateTableSha256"],
  ["removed model-authored fields", "removedModelAuthoredFieldsSha256"],
  ["failed-subset repair contract", "subsetRepairContractSha256"],
  ["prompt/schema field drift", "promptSchemaFieldDriftCount"],
  ["active boundary ids", "activeBoundaryIds"],
  ["boundary text", "boundaryText"],
  ["replay runtime", "replayRuntimeSha256"],
];

const ALLOWED_OUTCOME_LINES = renderAllowedOutcomes()
  .map((line) => `printf '  ${line}\\n'`)
  .join("\n");

const checkLines = CHECKS.map(([label, path]) =>
  `check ${shq(label)} ${shq(path)} ${shq(JSON.stringify((binding as Record<string, unknown>)[path]))}`,
).join("\n");

const script = `#!/usr/bin/env bash
# =============================================================================
# BTY Practice — R2.56 CLASSIFIER / CANONICAL-ALTERNATIVE REPLAY CANARY
# Slice 3.2I-PRACTICE-R5B1A.1-R2.56
#
# ONE reconstructed c18 subject x at most TWO provider calls:
# one full-row review + at most ONE field-level PATCH repair.
# ZERO generation calls. ZERO broad review. ZERO database. ZERO deployment.
# ZERO automatic transport retries.
#
# WHY THIS CANARY IS DIFFERENT
#
#   The R2.52 canary bound the ROUTE and was right about it: the live run took
#   the patch path exactly as bound, with legacy calls 0. It still produced no
#   verdict. The patch was complete, unduplicated, untargeted-free and
#   mutation-free; it chose a CANONICALLY VALID state; it crossed the merge
#   boundary; and the canonical row validator refused the merged row with
#   boundary_reason_required_missing. Every counter that canary checked was
#   clean, because none of them was about what the route ACCEPTS.
#
#   This canary proves ACCEPTANCE, without a credential:
#     - a CANONICAL leg answers the plan from ONE complete canonical
#       alternative: 14 operations across 10 dependency groups, the group
#       matched by identity, merge attempted and accepted, 12 surfaces,
#       zero frozen mutations, artifact /6 written;
#     - a CAPTURED-R2.52 leg replays the EXACT live selection that reached
#       merge — not_established / not_applicable / none / none with the frozen
#       empty reason — and proves it is now refused at the repair-group
#       boundary with field_repair_group_reason_required_missing, mergeAttempted
#       false, and NO field_repair_merged_row_invalid anywhere;
#     - STATIC checks prove the group is the unit of acceptance, that the
#       reason field has no scalar value list, and that the stage reaches the merge only
#       through the refusing seam.
#
#   A leg that merely routes to the patch is NOT sufficient and is no longer
#   the only leg.
#
# FROZEN SEMANTICS — READ BEFORE INTERPRETING THE RESULT
#
#   A contract-valid attempt-1 field is frozen even when a human oracle would
#   choose differently. If attempt 1 answers branch[1].action[1] 'absent', the
#   repaired matrix legitimately yields ONE violation, not two. That is a
#   complete semantic measurement, NOT a repair failure.
#
# STILL OPEN, DELIBERATELY
#   The three APPLICABILITY false positives remain unaddressed by any rule. A
#   green run here is NOT a product-quality pass.
#
#   CLASSIFIER FORENSIC CLOSED (R2.56). prohibited_action_present is scoped to
#   prohibition rules in ROW DATA, rule kind is a filter dimension, and the dead
#   tiebreak is gone. The c18 prerequisite frame now refuses that triple as
#   boundary_assessment_state_invalid and fabricates no violation; a genuine
#   prohibition frame still reaches the state. Both are asserted below.
#
#   A GREEN RUN HERE IS STILL NOT A LIVE-REPLAY AUTHORIZATION. It measures the
#   local path without a credential; authorizing one controlled live replay
#   remains a Founder decision this script does not make.
#
# =============================================================================
set -Eeuo pipefail

REPO=${shq(REPO)}
BRANCH=${shq(BRANCH)}
EXPECT_HEAD=${shq(head)}
EXPECTED_SUBJECTS=1
EXPECTED_SURFACES=${BRANCH_AWARE_REACHABLE_SURFACE_COUNT}
EXPECTED_EXCLUDED=${excluded.length}
EXPECTED_GENERATION_CALLS=0
EXPECTED_BROAD_REVIEW_CALLS=0
OUT_DIR='.eval-artifacts'

RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)"
CHECK_ONLY=0
[ "\${1:-}" = '--credential-boundary-check' ] && CHECK_ONLY=1

die() { printf '\\n%s\\n' "$*" >&2; exit 1; }
mismatch() { printf '\\nCONTRACT MISMATCH · RUNNER STALE\\n  %s\\n    expected: %s\\n    actual:   %s\\n' "$1" "$2" "$3" >&2; exit 3; }
step() { printf '  [%s] %s\\n' "$1" "$2"; }

printf '\\nR2.34 BOUNDARY TRANSPORT DIAGNOSTIC — PREFLIGHT\\n\\n'

[ -d "$REPO/.git" ] || die "CONTRACT MISMATCH · RUNNER STALE
  repository not found at $REPO"
cd "$REPO"
step 1 "repository $REPO"

ACTUAL_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
[ "$ACTUAL_BRANCH" = "$BRANCH" ] || mismatch 'branch' "$BRANCH" "$ACTUAL_BRANCH"
ACTUAL_HEAD="$(git rev-parse HEAD)"
[ "$ACTUAL_HEAD" = "$EXPECT_HEAD" ] || mismatch 'source HEAD' "$EXPECT_HEAD" "$ACTUAL_HEAD"
step 2 "HEAD $ACTUAL_HEAD on $BRANCH"

DIRTY="$(git status --porcelain | grep -v '^??' || true)"
[ -z "$DIRTY" ] || { printf '\\nCONTRACT MISMATCH · RUNNER STALE\\n  tracked tree is dirty:\\n%s\\n' "$DIRTY" >&2; exit 3; }
step 3 "tracked tree clean"

BINDING_JSON="$(npx --yes tsx scripts/practice-c18-canonical-alternative-replay-runner.ts --binding-json)" \\
  || die "CONTRACT MISMATCH · RUNNER STALE
  the boundary replay binding could not be regenerated from source"
step 4 "binding regenerated from tracked source"

check() {
  local label="$1" path="$2" expected="$3" actual
  actual="$(printf '%s' "$BINDING_JSON" | python3 -c '
import sys, json
d = json.load(sys.stdin)
for part in sys.argv[1].split("."):
    d = d[part]
sys.stdout.write(json.dumps(d, sort_keys=True, separators=(",", ":")))
' "$path")" || mismatch "$label" "$expected" '<unreadable>'
  [ "$actual" = "$expected" ] || mismatch "$label" "$expected" "$actual"
}

${checkLines}
step 5 "all ${CHECKS.length} bound contracts match, including the exact boundary text, all $EXPECTED_SURFACES reachable coordinates and the $EXPECTED_EXCLUDED excluded projections"

# ---- 6. the replay program cannot call generation ---------------------------
for f in src/lib/bty/foundry/arena/boundaryReviewStage.ts \\
         src/lib/bty/foundry/arena/narrowBoundaryReviewer.ts \\
         src/lib/bty/foundry/arena/narrowBoundaryContract.ts \\
         scripts/practice-c18-narrow-boundary-replay.ts; do
  if grep -qE 'generateArenaScenarioDraft|generateWithLlm|buildTemplateScenarioDraft' "$f"; then
    mismatch 'replay scope' 'no generation import' "$f imports generation"
  fi
done
step 6 "zero generation entry points in the boundary replay path"

# ---- 7. the replay program cannot call the BROAD reviewer -------------------
for f in src/lib/bty/foundry/arena/boundaryReviewStage.ts \\
         src/lib/bty/foundry/arena/narrowBoundaryReviewer.ts \\
         scripts/practice-c18-narrow-boundary-replay.ts; do
  if grep -qE 'reviewFrozenSubject|reviewConstraintCompliance|SEMANTIC_REVIEW_JSON_SCHEMA' "$f"; then
    mismatch 'replay scope' 'no broad-review import' "$f imports the broad reviewer"
  fi
done
step 7 "zero broad semantic-review entry points in the boundary replay path"

step 8 "scope: one reconstructed subject, boundary reviewer only"
step 9 "preflight complete"

printf '\\nPREFLIGHT CONTRACT PASS · CREDENTIAL NOT REQUESTED\\n'

printf '\\nRUNTIME WIRING PROOF (no credential, no network)\\n'
MOCK_DIR="$(mktemp -d)"
wiring_cleanup() { rm -rf "$MOCK_DIR"; }
trap wiring_cleanup EXIT INT TERM
wiring_failed() {
  printf '\\n%s\\n' "$*" >&2
  printf '\\nRUNTIME WIRING FAILED · LIVE REPLAY BLOCKED\\n' >&2
  exit 7
}

BTY_C18_NARROW_MOCK=1 npx --yes tsx scripts/practice-c18-narrow-boundary-replay.ts \\
  --replay-run-id "mock-$RUN_ID" --artifact-dir "$MOCK_DIR" --mock-outcome 'reject' \\
  || wiring_failed 'the narrow boundary replay program failed on the mock transport'

MOCK_ARTIFACTS="$(find "$MOCK_DIR" -maxdepth 1 -name 'practice-review.boundaryreplay.mock.*.json' | wc -l | tr -d ' ')"
[ "$MOCK_ARTIFACTS" = "$EXPECTED_SUBJECTS" ] \\
  || wiring_failed "expected $EXPECTED_SUBJECTS mock boundary replay artifact, found $MOCK_ARTIFACTS"
printf '\\nBOUNDARY REPLAY MOCK PASS · %s/%s SUBJECT\\n' "$MOCK_ARTIFACTS" "$EXPECTED_SUBJECTS"
printf 'LIVE PROVIDER NOT CALLED\\n'

# ---------------------------------------------------------------------------
# R2.54 LEG 1 — CANONICAL ALTERNATIVE
#
# The plan-derived patch answers each dependency group from ONE complete
# canonical alternative. This is the R2.52 leg's successor: same entrypoint,
# same dependency construction, one more operation, and — the part R2.52 could
# not assert — an accepted GROUP SHAPE and a crossed merge boundary.
# ---------------------------------------------------------------------------
printf '\nCANONICAL-ALTERNATIVE REPAIR PROOF (no credential, no network)\n'
ROUTE_DIR="$(mktemp -d)"
route_cleanup() { rm -rf "$ROUTE_DIR"; }
trap route_cleanup EXIT INT TERM

BTY_C18_NARROW_MOCK=1 npx --yes tsx scripts/practice-c18-narrow-boundary-replay.ts \
  --replay-run-id "route-$RUN_ID" --artifact-dir "$ROUTE_DIR" --mock-outcome 'incomplete-field-repair' \
  || wiring_failed 'the canonical-alternative mock leg failed to run'

ROUTE_ARTIFACT="$(find "$ROUTE_DIR" -maxdepth 1 -name 'practice-review.boundaryreplay.mock.*.json' | head -1)"
[ -n "$ROUTE_ARTIFACT" ] || wiring_failed 'the canonical-alternative leg wrote no artifact'

route_check() {
  got="$(python3 -c '
import json,sys
b=json.load(open(sys.argv[1]))
print(json.dumps(eval(sys.argv[2],{"b":b}),sort_keys=True))
' "$ROUTE_ARTIFACT" "$2")"
  [ "$got" = "$3" ] || wiring_failed "$1: expected $3, got $got"
  printf '  [route] %-46s %s\n' "$1" "$got"
}

route_check 'repair mode'                      'b["repairMode"]'                                   '"field_patch"'
route_check 'full-row review calls'            'b["fullRowReviewCallCount"]'                       '1'
route_check 'patch repair calls'               'b["fieldRepairCallCount"]'                         '1'
route_check 'legacy whole-row repair calls'    'b["legacyWholeRowRepairCallCount"]'                '0'
route_check 'repair plan present'              'b["repairPlanSha256"] is not None'                 'true'
route_check 'base row digests present'         'len(b["baseRowSha256"])>0'                         'true'
route_check 'patch response is repairs[]'      'list(b["boundaryReviewEvidence"][1]["parsed"].keys())' '["repairs"]'
route_check 'no assessments in patch response' '"assessments" in b["boundaryReviewEvidence"][1]["parsed"]' 'false'
route_check 'frozen mutations'                 'b["fieldRepairMetrics"]["fieldRepairFrozenMutationCount"]' '0'
route_check 'merged rows invalid'              'b["fieldRepairMetrics"]["fieldRepairMergedRowInvalidCount"]' '0'
route_check 'operation count'                  'b["fieldRepairMetrics"]["fieldRepairOperationCount"]' '14'
route_check 'dependency groups'                'b["fieldRepairMetrics"]["fieldRepairDependencyGroupCount"]' '10'
route_check 'complete matrix'                  'len(b["surfaces"])'                                '12'
route_check 'written artifact version'         'b["artifactVersion"]'                              '"${NARROW_REPLAY_ARTIFACT_VERSION}"'

# --- artifact /6: the group decision, and the merge boundary -----------------
route_check 'observability present'            'b["fieldRepairObservability"] is not None'         'true'
route_check 'observability version'            'b["fieldRepairObservability"]["version"]'          '"${FIELD_REPAIR_OBSERVABILITY_VERSION}"'
route_check 'observed plan count'              'b["fieldRepairObservability"]["operationPlanCount"]' '14'
route_check 'observed supplied count'          'b["fieldRepairObservability"]["suppliedOperationCount"]' '14'
route_check 'observed dependency groups'       'b["fieldRepairObservability"]["dependencyGroupCount"]' '10'
route_check 'observed multi-field groups'      'len(b["fieldRepairObservability"]["groups"])'      '1'
route_check 'group field count'                'len(b["fieldRepairObservability"]["groups"][0]["fields"])' '5'
route_check 'group has alternatives'           'b["fieldRepairObservability"]["groups"][0]["alternativesCount"]' '6'
route_check 'prohibition state absent'         '"prohibited_action_present" in str(b)' 'false'
route_check 'alternatives digest length'       'len(b["fieldRepairObservability"]["groups"][0]["alternativesSha256"])' '64'
route_check 'group matched'                    'b["fieldRepairObservability"]["groups"][0]["matched"]' 'true'
route_check 'matched alternative named'        'b["fieldRepairObservability"]["groups"][0]["matchedAlternativeId"] is not None' 'true'
route_check 'accepted'                         'b["fieldRepairObservability"]["accepted"]'         'true'
route_check 'refusal codes'                    'b["fieldRepairObservability"]["refusalCodes"]'     '[]'
route_check 'MERGE BOUNDARY CROSSED'           'b["fieldRepairObservability"]["mergeAttempted"]'   'true'
route_check 'merge accepted'                   'b["fieldRepairObservability"]["mergeAccepted"]'    'true'
route_check 'reason prose withheld'            'b["fieldRepairObservability"]["redaction"]["modelReasonProseWithheld"]' 'true'

grep -q 'boundary_review_failed_subset_repair' "$ROUTE_ARTIFACT" \
  && wiring_failed 'the legacy failed-subset repair event appeared in a field-patch run'

printf '\nCANONICAL-ALTERNATIVE PROOF PASS - ONE COMPLETE SHAPE MATCHED - MERGE CROSSED\n'

# ---------------------------------------------------------------------------
# R2.54 LEG 2 — THE CAPTURED R2.52 SELECTION
#
# The exact tuple the live model sent, replayed through the same program. Under
# R2.52 it crossed the merge and the run lost its verdict to
# boundary_reason_required_missing. It must now stop at the repair-group
# boundary, and the artifact must say WHICH rule it broke.
# ---------------------------------------------------------------------------
printf '\nCAPTURED R2.52 SELECTION — REFUSAL PROOF (no credential, no network)\n'
CAPTURED_DIR="$(mktemp -d)"
captured_cleanup() { rm -rf "$CAPTURED_DIR"; }

BTY_C18_NARROW_MOCK=1 npx --yes tsx scripts/practice-c18-narrow-boundary-replay.ts \
  --replay-run-id "captured-$RUN_ID" --artifact-dir "$CAPTURED_DIR" \
  --mock-outcome 'incomplete-field-repair-captured-r252' \
  || true   # this leg is EXPECTED to end without a verdict; the artifact is the evidence

CAPTURED_ARTIFACT="$(find "$CAPTURED_DIR" -maxdepth 1 -name 'practice-review.boundaryreplay.mock.*.json' | head -1)"
[ -n "$CAPTURED_ARTIFACT" ] || { captured_cleanup; wiring_failed 'the captured-R2.52 leg wrote no artifact'; }

captured_check() {
  got="$(python3 -c '
import json,sys
b=json.load(open(sys.argv[1]))
print(json.dumps(eval(sys.argv[2],{"b":b}),sort_keys=True))
' "$CAPTURED_ARTIFACT" "$2")"
  [ "$got" = "$3" ] || { captured_cleanup; wiring_failed "$1: expected $3, got $got"; }
  printf '  [captured] %-43s %s\n' "$1" "$got"
}

captured_check 'still routes to the patch'     'b["repairMode"]'                                   '"field_patch"'
captured_check 'patch was COMPLETE'            'b["fieldRepairObservability"]["suppliedOperationCount"]' '14'
captured_check 'refused'                       'b["fieldRepairObservability"]["accepted"]'         'false'
captured_check 'refusal code'                  '"field_repair_group_reason_required_missing" in b["fieldRepairObservability"]["refusalCodes"]' 'true'
captured_check 'no completeness code'          '"field_repair_operation_missing" in b["fieldRepairObservability"]["refusalCodes"]' 'false'
captured_check 'MERGE BOUNDARY NOT CROSSED'    'b["fieldRepairObservability"]["mergeAttempted"]'   'false'
captured_check 'no merged-row refusal'         '"field_repair_merged_row_invalid" in b["fieldRepairCodes"]' 'false'
captured_check 'group did not match'           'b["fieldRepairObservability"]["groups"][0]["matched"]' 'false'
captured_check 'group refusal named'           'b["fieldRepairObservability"]["groups"][0]["refusalCode"]' '"field_repair_group_reason_required_missing"'
captured_check 'reason authority reported'     'b["fieldRepairObservability"]["groups"][0]["reasonAuthority"]' '"model_required"'
captured_check 'selected status recorded'      'b["fieldRepairObservability"]["groups"][0]["selected"]["prerequisiteStatus"]' '"not_established"'
captured_check 'reason reported as SHAPE'      'b["fieldRepairObservability"]["groups"][0]["selected"]["reason"]' '"<empty>"'

captured_cleanup
printf '\nCAPTURED R2.52 REFUSAL PROOF PASS - STOPPED BEFORE MERGE - REASON NAMED\n'

# ---------------------------------------------------------------------------
# R2.56 LEG 3 — RULE-KIND SCOPE
#
# Run in-process against the tracked table, so this measures the same code the
# replay legs above just exercised. Two halves, and both must hold: the state
# must STOP being reachable where it never belonged, and it must KEEP working
# where it does.
# ---------------------------------------------------------------------------
printf '\nRULE-KIND SCOPE PROOF (no credential, no network)\n'
RULEKIND_JSON="$(npx --yes tsx scripts/practice-c18-canonical-alternative-replay-runner.ts --rulekind-json)" \
  || wiring_failed 'the rule-kind scope probe failed to run'

rulekind_check() {
  got="$(printf '%s' "$RULEKIND_JSON" | python3 -c '
import json,sys
print(json.dumps(json.load(sys.stdin)[sys.argv[1]],sort_keys=True))
' "$2")"
  [ "$got" = "$3" ] || wiring_failed "$1: expected $3, got $got"
  printf '  [rulekind] %-43s %s\n' "$1" "$got"
}

rulekind_check 'c18 frame is a prerequisite rule'  'c18RuleKind'         '"prerequisite_before_action"'
rulekind_check 'fixture frame is a prohibition'    'prohibitionRuleKind' '"prohibition"'
rulekind_check 'c18 REFUSES the prohibition triple' 'c18Triple'          'null'
rulekind_check 'prohibition still reaches it'      'prohibitionTriple'   '"prohibited_action_present"'
rulekind_check 'table defines a function'          'ambiguities'         '0'
rulekind_check 'not_established preserved'         'notEstablished'      '"governed_action_prerequisite_not_established"'
rulekind_check 'satisfied preserved'               'satisfied'           '"governed_action_prerequisite_satisfied"'

printf '\nRULE-KIND SCOPE PROOF PASS - SCOPED, NOT BLUNT\n'

# --- STATIC: no layer re-introduces a hard-coded rule kind -------------------
if grep -qF 'classifyTruthState(d.facts, "prerequisite_before_action")' src/domain/foundry/arena-draft/narrowBoundaryReview.ts; then
  wiring_failed 'verdict derivation classifies under a hard-coded rule kind again'
fi
if grep -qF '"prerequisite_before_action",' src/lib/bty/foundry/arena/boundaryReviewStage.ts; then
  wiring_failed 'the model-reason tally classifies under a hard-coded rule kind again'
fi
grep -qF 'appliesToRuleKinds' src/domain/foundry/arena-draft/boundaryTruthStates.ts \
  || wiring_failed 'the canonical rows no longer declare a rule-kind scope'
if grep -qF 'ruleKind === "prohibition" ? prohibition' src/domain/foundry/arena-draft/boundaryTruthStates.ts; then
  wiring_failed 'the dead post-match rule-kind tiebreak is back'
fi
printf 'STATIC RULE-KIND PROOF PASS - scope is row data - no hard-coded kind in a semantic decision\n'

# --- STATIC: the group is the unit of acceptance ----------------------------
grep -q 'export function applyFieldRepair' src/domain/foundry/arena-draft/boundaryFieldRepair.ts \
  || wiring_failed 'the refusing apply seam does not exist'
grep -q 'applyFieldRepair(patch.raw, baseRows, plan, ctxAll, digests)' src/lib/bty/foundry/arena/boundaryReviewStage.ts \
  || wiring_failed 'the stage does not reach the merge through the refusing seam'
if grep -q 'mergeFieldRepair(baseRows, v, plan, ctxAll)' src/lib/bty/foundry/arena/boundaryReviewStage.ts; then
  wiring_failed 'the stage still calls the merge directly, bypassing the refusal'
fi
# -F: the pattern contains brackets and this repository's grep is not required to
# be a POSIX BRE implementation. R2.54's own canary must not fail on its matcher.
grep -qF 'if (field === "reason") return [];' src/domain/foundry/arena-draft/boundaryFieldRepair.ts \
  || wiring_failed 'reason has regained a scalar value list'
grep -q 'matchGroupAlternative' src/domain/foundry/arena-draft/boundaryFieldRepair.ts \
  || wiring_failed 'the group matcher has no live importer'
grep -q 'dependencyGroups' src/lib/bty/foundry/arena/narrowBoundaryContract.ts \
  || wiring_failed 'the patch request no longer carries canonical alternatives'
if grep -q 'const PREFERRED' scripts/practice-c18-narrow-boundary-replay.ts; then
  wiring_failed 'the hard-coded PREFERRED selection map is back in the mock'
fi
printf 'STATIC ACCEPTANCE PROOF PASS - group matched by shape - reason has no scalar list - merge behind the seam\n'

# --- STATIC: the R2.52 routing proofs, retained unchanged -------------------
grep -q 'repair: (subject: NarrowBoundarySubject, plan: FieldRepairPlan, attempt: number)' src/lib/bty/foundry/arena/boundaryReviewStage.ts \
  || wiring_failed 'the stage repair dependency is not required'
grep -q 'repair: deps.repair' scripts/practice-c18-narrow-boundary-replay.ts \
  || wiring_failed 'the replay entrypoint does not supply repair'
grep -q 'reviewFieldRepair' scripts/practice-c18-narrow-boundary-replay.ts \
  || wiring_failed 'reviewFieldRepair has no active runtime importer'
grep -q 'reviewFieldRepair' src/lib/bty/foundry/arena/arenaScenarioGenerationService.ts \
  || wiring_failed 'the production generation service does not supply repair'
if grep -q 'deps.review(subject, attempt, repairSurfaceRefs)' src/lib/bty/foundry/arena/boundaryReviewStage.ts; then
  wiring_failed 'the active stage still contains a whole-row repair fallback'
fi
printf 'STATIC ROUTING PROOF PASS - required dependency - entrypoint wired - no whole-row fallback\n'

printf 'LIVE PROVIDER NOT CALLED\n'
route_cleanup
trap - EXIT INT TERM

printf '\nLOCAL MOCK MATRIX + CAPTURED REGRESSIONS + RESTORED SAFETY ASSERTIONS (no credential, no network)\n'
npx --yes vitest run \\
  src/domain/foundry/arena-draft/boundaryTransportEvidence.test.ts \\
  src/domain/foundry/arena-draft/r232TransportRegression.test.ts \\
  src/lib/bty/foundry/arena/narrowBoundaryTransport.contract.test.ts \\
  src/domain/foundry/arena-draft/r230LiveDtoRegression.test.ts \\
  src/domain/foundry/arena-draft/r236TruthRegression.test.ts \\
  src/domain/foundry/arena-draft/boundaryCandidateAuthority.test.ts \\
  src/domain/foundry/arena-draft/boundaryCandidateRole.test.ts \\
  src/domain/foundry/arena-draft/boundaryAbsentCandidateParity.test.ts \\
  src/domain/foundry/arena-draft/narrowBoundaryReview.test.ts \\
  src/domain/foundry/arena-draft/boundaryReasonParity.test.ts \\
  src/domain/foundry/arena-draft/boundaryGroupAlternatives.test.ts \\
  src/domain/foundry/arena-draft/boundaryFieldRepair.test.ts \\
  src/domain/foundry/arena-draft/r252FieldRepairRegression.test.ts \\
  src/domain/foundry/arena-draft/boundaryRuleKindScope.test.ts \\
  src/domain/foundry/arena-draft/boundaryRuleKindParity.test.ts \\
  src/domain/foundry/arena-draft/boundaryRuleKindCapturedParity.test.ts \\
  src/domain/foundry/arena-draft/prerequisiteCandidateAuthority.test.ts \\
  src/domain/foundry/arena-draft/boundaryCandidateAuthority.test.ts \\
  src/lib/bty/foundry/arena/fieldRepairRouting.contract.test.ts \\
  src/lib/bty/foundry/arena/canonicalAlternativeRunnerBinding.contract.test.ts --reporter=dot \\
  || wiring_failed 'the transport matrix, the captured regressions or the R2.54 acceptance suites failed'
printf 'ACCEPTANCE SUITES PASS · CAPTURED R2.52 EVIDENCE REPRODUCES A PRE-MERGE REFUSAL\n'
printf 'HISTORICAL R2.32 EVIDENCE CLASSIFIES AS provider_failure_unknown · INSUFFICIENT TO AUTHORIZE A RETRY\n'

if [ "$CHECK_ONLY" = '1' ]; then
  printf '\\nCREDENTIAL NOT REQUESTED\\n\\n'
  exit 0
fi

printf '\\nContract and runtime verified. ONE narrow boundary-review call will be performed.\\n'
printf 'Active boundary: [${BOUNDARY_ID}] ${BOUNDARY_TEXT}\\n'
printf 'Reachable decision surfaces: %s (including both resulting world states)\\n' "$EXPECTED_SURFACES"
printf 'Excluded compatibility projections: %s\\n' "$EXPECTED_EXCLUDED"
printf 'Applicability is judged BEFORE compliance; silence is never a violation.\\n'
printf 'NO scenario will be generated. NO scenario will be rewritten. NO broad review will run.\\n'
printf 'Exactly ONE provider invocation. NO automatic retry on failure.\\n'
printf 'Provider invocation cap: %s · semantic response cap: %s\\n' '${MAX_BOUNDARY_PROVIDER_INVOCATIONS_PER_FROZEN_SUBJECT}' '${MAX_BOUNDARY_SEMANTIC_RESPONSES_PER_FROZEN_SUBJECT}'
printf 'Provider API key (input hidden, never written to disk or history): '
read -rs LLM_API_KEY
printf '\\n'
[ -n "$LLM_API_KEY" ] || die 'no credential supplied'
export LLM_API_KEY
unset HISTFILE
cleanup() { unset LLM_API_KEY OPENAI_API_KEY || true; }
trap cleanup EXIT INT TERM

printf '\\nBOUNDARY REPLAY\\n'
set +e
npx --yes tsx scripts/practice-c18-narrow-boundary-replay.ts --replay-run-id "$RUN_ID" --artifact-dir "$OUT_DIR"
REPLAY_STATUS=$?
set -e

printf '\\n============================================================\\n'
printf 'BOUNDARY REVIEWER BEHAVIOUR MEASURED · PRODUCT QUALITY NOT MEASURED\\n'
printf 'replay status: %s\\n' "$REPLAY_STATUS"
printf 'artifacts:     %s\\n' "$OUT_DIR"
printf '============================================================\\n'
printf '\\nALLOWED OUTCOMES (rendered from the ONE canonical enumeration — R2.30 printed a\\n'
printf 'list that did not contain the outcome it actually produced):\\n'
${ALLOWED_OUTCOME_LINES}
printf '\\nThe subject was RECONSTRUCTED. This result says what the boundary reviewer\\n'
printf 'does when the confirmed rule and every decision surface are put in front of\\n'
printf 'it. It is not a product-quality verdict.\\n\\n'
`;

/**
 * R2.56 — the rule-kind scope, measured in-process against the tracked table.
 *
 * A mode on the BOUND runner rather than an inline `tsx -e` in the generated shell: the canary must
 * exercise the same module graph its bindings were computed from, and an eval string is a second
 * program that only looks like the first one.
 */
if (process.argv.includes("--rulekind-json")) {
  const c18RuleKind = buildSemanticFrame({ id: BOUNDARY_ID, statement: BOUNDARY_TEXT }).ruleKind;
  const prohibitionRuleKind = buildSemanticFrame(PROHIBITION_BOUNDARY).ruleKind;
  const at = (facts: Record<string, string>, ruleKind: string) => classifyTruthState(facts as never, ruleKind)?.id ?? null;
  process.stdout.write(
    `${JSON.stringify({
      c18RuleKind,
      prohibitionRuleKind,
      c18Triple: at(PROHIBITION_BREACH_FACTS as unknown as Record<string, string>, c18RuleKind),
      prohibitionTriple: at(PROHIBITION_BREACH_FACTS as unknown as Record<string, string>, prohibitionRuleKind),
      ambiguities: truthStateAmbiguities(RULE_KINDS, GOVERNED_ACTION_STATUSES, PREREQUISITE_STATUSES, TEMPORAL_RELATIONS).length,
      notEstablished: at({ governedActionStatus: "present", prerequisiteStatus: "not_established", temporalRelation: "not_applicable" }, c18RuleKind),
      satisfied: at({ governedActionStatus: "present", prerequisiteStatus: "satisfied", temporalRelation: "prerequisite_before_action" }, c18RuleKind),
    })}\n`,
  );
} else if (process.argv.includes("--binding-json")) {
  process.stdout.write(`${JSON.stringify(binding)}\n`);
} else {
  const out = arg("out");
  writeFileSync(out, script, { mode: 0o700 });
  process.stdout.write(
    `wrote ${out}\n` +
      `  head            ${binding.head}\n` +
      `  manifest        ${binding.manifestSha256}\n` +
      `  broad subject   ${binding.reconstructedSubjectSha256}\n` +
      `  narrow subject  ${binding.boundaryReviewSubjectSha256}\n` +
      `  surface map     ${binding.surfaceMapSha256}\n` +
      `  lineage         ${binding.lineageSha256}\n` +
      `  reachable       ${binding.reachableSurfaceCount}\n` +
      `  excluded        ${binding.excludedCompatibilitySurfaces.length}\n` +
      `  provenance      ${binding.boundaryProvenanceSha256}\n` +
      `  scenario        ${binding.scenarioSha256}\n` +
      `  boundary        ${binding.activeBoundaryIds.join(",")}\n`,
  );
}
