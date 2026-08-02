/**
 * GENERATION-CONTRACT MANIFEST (Slice 3.2I-R5B1A.1-R2.23).
 *
 * A live artifact is evidence for exactly one contract: one source HEAD, one prompt pair, one pair
 * of strict schemas, one corpus, one sampling configuration. R2.20 recorded the consequence of not
 * binding evidence to its contract — four artifacts destroyed by shared filenames, and a runner that
 * silently outlived the source it was written for.
 *
 * This module produces a reproducible digest over every component the generation contract consists
 * of. The digest is what a runner checks BEFORE it asks for a credential: if any component moved,
 * the runner is stale and must refuse rather than produce evidence for a contract that no longer
 * exists.
 *
 * Reproducible by construction: key-sorted canonical JSON, no timestamps, no file mtimes, no
 * environment values, no secrets. The model NAME is included (it is part of the contract); no key,
 * endpoint or account identifier ever is.
 */

import { createHash } from "node:crypto";
import { PROVIDER_SCENARIO_JSON_SCHEMA, PROVIDER_SCHEMA_NAME } from "@/domain/foundry/arena-draft/providerDto";
import { SEMANTIC_REVIEW_JSON_SCHEMA, SEMANTIC_REVIEW_SCHEMA_NAME } from "@/domain/foundry/arena-draft/semanticReview";
import { BOUNDARY_GROUNDING_JSON_SCHEMA, BOUNDARY_DEFECT_CODES } from "@/domain/foundry/arena-draft/boundaryGrounding";
import { CHOICE_CONSTRUCTION_JSON_SCHEMA, CHOICE_CONSTRUCTION_DEFECT_CODES } from "@/domain/foundry/arena-draft/choiceConstruction";
import { PHASE_CHOICE_DEFECT_CODES } from "@/domain/foundry/arena-draft/choiceReview";
import { BRANCH_PROGRESSION_DEFECT_CODES, CROSS_BRANCH_DEFECT_CODES, CROSS_BRANCH_REVIEW_JSON_SCHEMA } from "@/domain/foundry/arena-draft/branchProgression";
import { registeredCodes } from "@/domain/foundry/arena-draft/gatePrecedence";
import { MUST_REMAIN_UNCHANGED } from "@/domain/foundry/arena-draft/correctionPacket";
import { PRACTICE_SAMPLING, REVIEW_SYSTEM_PROMPT, buildGenerationSystemPrompt } from "./arenaScenarioGenerationService";
import { EVAL_CORPUS } from "./practice-generation.eval";
import {
  GENERATED_ACTION_CHOICES,
  GENERATED_PRIMARY_CHOICES,
  GENERATED_TRADEOFF_CHOICES,
  GEN_ACTION_PROMPT_MAX,
  GEN_ACTION_TEXT_MAX,
  GEN_BOUNDARY_ID_MAX,
  GEN_CHOICE_LABEL_MAX,
  GEN_COST_MAX,
  GEN_DIMENSIONS_MAX_ITEMS,
  GEN_DIMENSION_MAX,
  GEN_ESCALATION_MAX,
  GEN_EXPLANATION_MAX,
  GEN_GROUNDING_STATEMENT_MAX,
  GEN_GROUNDING_TEXT_MAX,
  GEN_INTENT_MAX,
  GEN_OPENING_MAX,
  GEN_PAIRS_MAX_ITEMS,
  GEN_PAIR_MAX,
  GEN_RATIONALE_MAX,
  GEN_REVIEW_TEXT_MAX,
  GEN_SHORT_REASON_MAX,
  GEN_TITLE_MAX,
  GEN_VALUE_MAX,
} from "@/domain/foundry/arena-draft/types";
import { MODEL_OUTPUT_CAP, measureNarrowBoundaryBudget, measureProviderBudget, measureReviewBudget } from "./tokenBudget";
import {
  NARROW_BOUNDARY_JSON_SCHEMA,
  NARROW_BOUNDARY_SCHEMA_NAME,
  NARROW_BOUNDARY_CODES,
  BOUNDARY_REVIEW_OUTCOMES,
  MAX_BOUNDARY_REVIEW_CALLS_PER_SUBJECT,
  OUTPUT_CONTRACT_CODES,
  GOVERNED_ACTION_STATUSES,
  PREREQUISITE_STATUSES,
  TEMPORAL_RELATIONS,
  REMOVED_MODEL_AUTHORED_FIELDS,
} from "@/domain/foundry/arena-draft/narrowBoundaryReview";
import {
  CANDIDATE_EXCERPT_MAX,
  CANDIDATE_ID_MAX,
  CANDIDATE_RESOLUTION_CODES,
  MAX_CANDIDATES_PER_POOL,
  candidateContractSha256,
} from "@/domain/foundry/arena-draft/boundaryEvidenceCandidates";
import {
  DERIVED_APPLICABILITY,
  DERIVED_COMPLIANCE,
  TRUTH_STATE_IDS,
  truthStateCoverage,
  truthStateTableSha256,
} from "@/domain/foundry/arena-draft/boundaryTruthStates";
import { EVIDENCE_ROLES } from "@/domain/foundry/arena-draft/boundaryTruthContractTypes";
import { SUBSET_REPAIR_CODES } from "@/domain/foundry/arena-draft/narrowBoundaryReview";
import {
  BRANCH_AWARE_REACHABLE_SURFACE_COUNT,
  FLAT_REACHABLE_SURFACE_COUNT,
  SURFACE_KINDS,
  SURFACE_MAP_VERSION,
  SURFACE_PHASES,
  SURFACE_REACHABILITY,
  SURFACE_MAP_CODES,
} from "@/domain/foundry/arena-draft/boundarySurfaces";
import { NARROW_BOUNDARY_SAMPLING, NARROW_BOUNDARY_SYSTEM_PROMPT } from "./narrowBoundaryContract";
import { parityTableSha256 } from "@/domain/foundry/arena-draft/boundaryReasonParity";
import {
  CONTEXT_SEGMENT_CODES,
  CONTEXT_SEGMENT_VERSION,
  OPENING_SEGMENT_REF,
  SEGMENT_KINDS,
} from "@/domain/foundry/arena-draft/boundaryContextSegments";
import { semanticFrameContractSha256 } from "@/domain/foundry/arena-draft/boundarySemanticFrame";
import { candidateRoleContractSha256 } from "@/domain/foundry/arena-draft/boundaryCandidateRole";
import { EVIDENCE_POLARITY, POLARITY_REFUSAL_CODES, evidencePolarityContractSha256 } from "@/domain/foundry/arena-draft/boundaryEvidencePolarity";
import { PREREQUISITE_UNAVAILABLE_CODES, TRUTH_STATES, renderCandidateRequirements } from "@/domain/foundry/arena-draft/boundaryTruthStates";
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
// R2.54 — the canonical dependency-group shape authority.
import {
  GROUP_ALTERNATIVES_VERSION,
  GROUP_SHAPE_CODES,
  REASON_AUTHORITY_MODES,
  REASON_CONSTRAINTS,
  groupAlternativeContractSha256,
} from "@/domain/foundry/arena-draft/boundaryGroupAlternatives";
import { BOUNDARY_STAGE_ROUTING_CONTRACT, REPAIR_MODES } from "./boundaryReviewStage";

/**
 * R2.54 — the ONE runner-preparation executable the boundary canary is generated by.
 *
 * Repo-relative and tracked. Named here so the manifest binds it and an executable-binding test can
 * resolve it, rather than a reader inferring which of several `scripts/practice-c18-*-runner.ts`
 * files is current.
 */
export const BOUNDARY_REPLAY_RUNNER_PATH = "scripts/practice-c18-canonical-alternative-replay-runner.ts";
import {
  ATTRIBUTION_AUTHORITY,
  ATTRIBUTION_REFUSAL_CODES,
  causalAttributionContractSha256,
} from "@/domain/foundry/arena-draft/generatedResultAttribution";
import { explanationAuthoritySha256 } from "@/domain/foundry/arena-draft/boundaryExplanation";
import {
  BOUNDARY_REPORTABLE_OUTCOMES,
  BOUNDARY_TERMINAL_SUBCODES,
  MAX_BOUNDARY_PROVIDER_INVOCATIONS_PER_FROZEN_SUBJECT,
  MAX_BOUNDARY_SEMANTIC_RESPONSES_PER_FROZEN_SUBJECT,
  NARROW_REPLAY_ARTIFACT_VERSION,
} from "@/domain/foundry/arena-draft/boundaryOutcomes";
import { PROVIDER_FAILURE_CODES, transportEvidenceSha256 } from "@/domain/foundry/arena-draft/boundaryTransportEvidence";
import { NARROW_TIMEOUT_OWNER } from "./narrowBoundaryReviewer";
import { BOUNDARY_SCOPE_CODES, MAX_ACTIVE_BOUNDARIES } from "@/domain/foundry/arena-draft/boundaryScope";
import { READINESS_STATES } from "@/domain/foundry/arena-draft/practiceReadiness";

/**
 * R2.23A — the GENERATED cardinality contract, digested into the manifest. A change here changes
 * what a generated Practice IS, so no prior artifact may be attributed to the new contract.
 */
/**
 * R2.23C — the evidence-authority contract. Restoring generator self-attestation, changing the
 * active-boundary maximum or moving retry authority back to the reviewer each change this digest,
 * so no prior artifact can be attributed to the current contract.
 */
export const EVIDENCE_AUTHORITY = {
  providerSelfAttestation: false,
  boundaryGroundingRequired: true,
  independentReviewRequired: true,
  constraintEvidenceSource: "review_derived_projection",
  projectionOnlyAfterAccept: true,
  retryAuthority: "server_deterministic",
  reviewerAuthorsRetryPrompt: false,
  maxActiveBoundaries: MAX_ACTIVE_BOUNDARIES,
  hostScopeRequiredAbove: MAX_ACTIVE_BOUNDARIES,
  automaticBoundarySelection: false,
  scopeCodes: BOUNDARY_SCOPE_CODES,
  /**
   * R2.23D — the Host scoping flow materially determines WHICH boundaries reach generation, so the
   * readiness contract is part of the generation contract.
   */
  hostScopeSelectorExists: true,
  readinessStates: READINESS_STATES,
} as const;

export const GENERATED_CARDINALITY = {
  primaryChoices: GENERATED_PRIMARY_CHOICES,
  branches: GENERATED_PRIMARY_CHOICES,
  tradeoffChoicesPerBranch: GENERATED_TRADEOFF_CHOICES,
  actionChoicesPerBranch: GENERATED_ACTION_CHOICES,
  flatTradeoffChoices: GENERATED_TRADEOFF_CHOICES,
  flatActionChoices: GENERATED_ACTION_CHOICES,
} as const;

/** R2.23A — the concise bounds that make the generation schema's permitted maximum finite. */
export const GENERATED_FIELD_BOUNDS = {
  title: GEN_TITLE_MAX,
  opening: GEN_OPENING_MAX,
  escalation: GEN_ESCALATION_MAX,
  actionPrompt: GEN_ACTION_PROMPT_MAX,
  choiceLabel: GEN_CHOICE_LABEL_MAX,
  legitimateValue: GEN_VALUE_MAX,
  acceptedCost: GEN_COST_MAX,
  competentIntent: GEN_INTENT_MAX,
  concreteAction: GEN_ACTION_TEXT_MAX,
  shortReason: GEN_SHORT_REASON_MAX,
  assessmentRationale: GEN_RATIONALE_MAX,
  boundaryId: GEN_BOUNDARY_ID_MAX,
  groundingStatement: GEN_GROUNDING_STATEMENT_MAX,
  groundingText: GEN_GROUNDING_TEXT_MAX,
  dimension: GEN_DIMENSION_MAX,
  dimensionsMaxItems: GEN_DIMENSIONS_MAX_ITEMS,
  reviewText: GEN_REVIEW_TEXT_MAX,
  explanation: GEN_EXPLANATION_MAX,
  pair: GEN_PAIR_MAX,
  pairsMaxItems: GEN_PAIRS_MAX_ITEMS,
} as const;

/** Bumped whenever the artifact payload shape changes, so old evidence is never misread as new. */
export const ARTIFACT_SCHEMA_VERSION = "r2.52.1";
export const CANONICAL_ADAPTER_VERSION = "provider-dto-positional-v1";
export const CANONICAL_VALIDATOR_VERSION = "arena-scenario-draft-v1";

/** Deterministic, key-sorted JSON. Insertion order can never change a digest. */
export function canonicalJson(value: unknown): string {
  const sort = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(sort);
    if (v && typeof v === "object") {
      return Object.fromEntries(
        Object.entries(v as Record<string, unknown>)
          .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
          .map(([k, x]) => [k, sort(x)]),
      );
    }
    return v;
  };
  return JSON.stringify(sort(value));
}

export const digest = (value: unknown): string => createHash("sha256").update(typeof value === "string" ? value : canonicalJson(value)).digest("hex");
export const short = (d: string): string => d.slice(0, 12);

/** The budget facts that belong in the contract — not the whole measurement object. */
const budgetFingerprint = (m: ReturnType<typeof measureProviderBudget>) => ({
  fixtureSha256: m.fixtureSha256,
  schemaFixtureSha256: m.schemaFixtureSha256,
  schemaBoundKorean: m.schemaBoundKorean.tokens,
  configuredBudget: m.configuredBudget,
  schemaCanExceedBudget: m.schemaCanExceedBudget,
  schemaExceedsModelCap: m.schemaExceedsModelCap,
});

export type ContractManifest = {
  artifactSchemaVersion: string;
  head: string;
  components: Record<string, string>;
  sampling: {
    generation: typeof PRACTICE_SAMPLING.generation;
    review: typeof PRACTICE_SAMPLING.review;
    retry: typeof PRACTICE_SAMPLING.retry;
    environmentOverrides: readonly string[];
  };
  model: string;
  cardinality: typeof GENERATED_CARDINALITY;
  evidenceAuthority: typeof EVIDENCE_AUTHORITY;
  fieldBounds: typeof GENERATED_FIELD_BOUNDS;
  modelOutputCap: number;
  /** Measured acceptance: false means every valid generated Practice fits the configured budget. */
  schemaCanExceedBudget: boolean;
};

/**
 * Build the manifest for the current source contract.
 *
 * `head` is supplied by the caller (git is I/O; this module stays deterministic and testable).
 * `model` is the contract's model NAME — never a key, endpoint or account.
 */
export function buildContractManifest(head: string, model: string): ContractManifest {
  return {
    artifactSchemaVersion: ARTIFACT_SCHEMA_VERSION,
    head,
    model,
    cardinality: GENERATED_CARDINALITY,
    evidenceAuthority: EVIDENCE_AUTHORITY,
    fieldBounds: GENERATED_FIELD_BOUNDS,
    modelOutputCap: MODEL_OUTPUT_CAP,
    schemaCanExceedBudget:
      measureProviderBudget(PRACTICE_SAMPLING.generation.maxTokens).schemaCanExceedBudget ||
      measureReviewBudget(PRACTICE_SAMPLING.review.maxTokens).schemaCanExceedBudget ||
      measureNarrowBoundaryBudget(NARROW_BOUNDARY_SAMPLING.maxTokens).schemaCanExceedBudget,
    components: {
      corpus: digest(EVAL_CORPUS.map((c) => ({ id: c.id, locale: c.locale, expectDecline: c.expectDecline ?? false, expectClass: c.expectClass ?? null, input: c.input }))),
      corpusIds: digest(EVAL_CORPUS.map((c) => c.id)),
      generatorSystemPromptEn: digest(buildGenerationSystemPrompt("en", [])),
      generatorSystemPromptKo: digest(buildGenerationSystemPrompt("ko", [])),
      generatorSystemPromptConstrained: digest(
        buildGenerationSystemPrompt("en", [{ id: "c1", statement: "manifest probe", provenance: "manager_entered" }]),
      ),
      providerSchema: digest(PROVIDER_SCENARIO_JSON_SCHEMA),
      providerSchemaName: digest(PROVIDER_SCHEMA_NAME),
      providerAdapter: digest(CANONICAL_ADAPTER_VERSION),
      canonicalValidator: digest(CANONICAL_VALIDATOR_VERSION),
      boundaryGroundingContract: digest({ schema: BOUNDARY_GROUNDING_JSON_SCHEMA, codes: BOUNDARY_DEFECT_CODES }),
      choiceConstructionContract: digest({ schema: CHOICE_CONSTRUCTION_JSON_SCHEMA, codes: CHOICE_CONSTRUCTION_DEFECT_CODES }),
      allPhaseReviewContract: digest(PHASE_CHOICE_DEFECT_CODES),
      branchProgressionContract: digest({ schema: CROSS_BRANCH_REVIEW_JSON_SCHEMA, same: BRANCH_PROGRESSION_DEFECT_CODES, cross: CROSS_BRANCH_DEFECT_CODES }),
      reviewSystemPrompt: digest(REVIEW_SYSTEM_PROMPT),
      reviewSchema: digest(SEMANTIC_REVIEW_JSON_SCHEMA),
      reviewSchemaName: digest(SEMANTIC_REVIEW_SCHEMA_NAME),
      rejectionPrecedence: digest(registeredCodes()),
      retryPolicy: digest({ maxAttempts: PRACTICE_SAMPLING.retry.maxAttempts, mustRemainUnchanged: MUST_REMAIN_UNCHANGED }),
      sampling: digest({ generation: PRACTICE_SAMPLING.generation, review: PRACTICE_SAMPLING.review, retry: PRACTICE_SAMPLING.retry }),
      // R2.23A — cardinality, field bounds and the measured budget are all part of the contract.
      generatedCardinality: digest(GENERATED_CARDINALITY),
      evidenceAuthority: digest(EVIDENCE_AUTHORITY),
      boundaryScopeContract: digest({ max: MAX_ACTIVE_BOUNDARIES, codes: BOUNDARY_SCOPE_CODES }),
      readinessResolver: digest(READINESS_STATES),
      generatedFieldBounds: digest(GENERATED_FIELD_BOUNDS),
      tokenBudget: digest({
        modelOutputCap: MODEL_OUTPUT_CAP,
        generation: budgetFingerprint(measureProviderBudget(PRACTICE_SAMPLING.generation.maxTokens)),
        review: budgetFingerprint(measureReviewBudget(PRACTICE_SAMPLING.review.maxTokens)),
        // R2.29 — the narrow boundary review is a PRODUCT contract component, so its budget is too.
        narrowBoundaryReview: budgetFingerprint(measureNarrowBoundaryBudget(NARROW_BOUNDARY_SAMPLING.maxTokens)),
      }),
      // R2.29 — the narrow confirmed-boundary review stage. Each component is separate so a prompt
      // change, a schema change and a verdict-authority change are individually visible.
      narrowBoundaryPrompt: digest(NARROW_BOUNDARY_SYSTEM_PROMPT),
      narrowBoundarySchema: digest(NARROW_BOUNDARY_JSON_SCHEMA),
      narrowBoundarySchemaName: digest(NARROW_BOUNDARY_SCHEMA_NAME),
      narrowBoundarySampling: digest(NARROW_BOUNDARY_SAMPLING),
      // R2.30 — the surface map is derived from LEARNER REACHABILITY, so the reachability vocabulary
      // and both cardinalities are part of the contract.
      canonicalSurfaceMap: digest({
        version: SURFACE_MAP_VERSION,
        branchAwareReachable: BRANCH_AWARE_REACHABLE_SURFACE_COUNT,
        flatReachable: FLAT_REACHABLE_SURFACE_COUNT,
        kinds: SURFACE_KINDS,
        phases: SURFACE_PHASES,
        reachability: SURFACE_REACHABILITY,
        codes: SURFACE_MAP_CODES,
      }),
      boundaryEvidenceGrounding: digest({ codes: NARROW_BOUNDARY_CODES }),
      // R2.38 — applicability and compliance are DERIVED. The model has no field for either, so the
      // contract records the derivation vocabulary rather than a model-authored enum.
      boundaryApplicabilityContract: digest({ applicability: DERIVED_APPLICABILITY, compliance: DERIVED_COMPLIANCE, modelAuthored: false }),
      boundaryViolationMechanism: digest({ derivedFrom: ["ruleKind", "surfaceKind", "lineagePosition", "truthState"], modelAuthored: false }),
      boundaryCausalLineage: digest({ version: SURFACE_MAP_VERSION, earliestCausalDerivation: "mechanism+governed_action_dedup_over_lineage" }),
      boundaryCorrectionPrecision: digest({ correctionFrom: "causal_violations_only", downstreamIsEvidenceOnly: true, notApplicableNeverCorrects: true }),
      boundaryWorldStateAuthority: digest({ escalationFallback: false, missingIsAuthorityFailure: true }),
      serverDerivedBoundaryVerdict: digest({
        applicability: DERIVED_APPLICABILITY,
        compliance: DERIVED_COMPLIANCE,
        outcomes: BOUNDARY_REVIEW_OUTCOMES,
        modelAuthoredVerdict: false,
        silenceIsNotViolation: true,
      }),
      boundaryReviewRerunPolicy: digest({ maxCallsPerSubject: MAX_BOUNDARY_REVIEW_CALLS_PER_SUBJECT, rerunIsGenerationRetry: false }),
      // R2.32 — one table decides what the prompt asks and what the validator requires; the server
      // owns the explanation; and one enumeration names every outcome a run may end on.
      boundaryReasonParityTable: parityTableSha256(),
      boundaryServerExplanationAuthority: explanationAuthoritySha256(),
      boundaryOutputContractClassification: digest({ codes: OUTPUT_CONTRACT_CODES, terminalSubcodes: BOUNDARY_TERMINAL_SUBCODES }),
      boundaryOutcomeEnumeration: digest([...BOUNDARY_REPORTABLE_OUTCOMES]),
      // R2.34 — transport observability is part of the review contract: it decides what an artifact
      // can prove about a failed call, and therefore whether a retry is authorizable at all.
      boundaryTransportEvidence: transportEvidenceSha256(),
      boundaryProviderFailureClassifier: digest([...PROVIDER_FAILURE_CODES]),
      boundaryTimeoutOwnership: digest({ owner: NARROW_TIMEOUT_OWNER, timeoutMs: NARROW_BOUNDARY_SAMPLING.timeoutMs, signalWired: true }),
      boundaryInvocationBudget: digest({
        maxProviderInvocations: MAX_BOUNDARY_PROVIDER_INVOCATIONS_PER_FROZEN_SUBJECT,
        maxSemanticResponses: MAX_BOUNDARY_SEMANTIC_RESPONSES_PER_FROZEN_SUBJECT,
        automaticTransportRetry: false,
      }),
      boundaryReplayArtifactVersion: digest(NARROW_REPLAY_ARTIFACT_VERSION),
      // R2.36 — three new authorities, each digested separately so a change to the CONTEXT the
      // reviewer sees, to how a RULE is decomposed, or to what counts as PREREQUISITE TRUTH is
      // individually visible in a diff of the manifest.
      boundaryContextSegmentation: digest({
        version: CONTEXT_SEGMENT_VERSION,
        kinds: SEGMENT_KINDS,
        openingSegmentRef: OPENING_SEGMENT_REF,
        codes: CONTEXT_SEGMENT_CODES,
        openingAlwaysSent: true,
      }),
      boundarySemanticFrameContract: semanticFrameContractSha256(),
      boundaryPrerequisiteTruth: digest({
        governedActionStatuses: GOVERNED_ACTION_STATUSES,
        prerequisiteStatuses: PREREQUISITE_STATUSES,
        temporalRelations: TEMPORAL_RELATIONS,
        modelAuthorsApplicability: false,
        modelAuthorsCompliance: false,
        // The rules a violation must clear, stated as data so a silent relaxation moves the digest.
        notEstablishedIsNeverViolation: true,
        satisfiedCannotViolate: true,
        failureMustConcernPrerequisite: true,
        governedActionMustBeOwnSurface: true,
        inheritedStateRequiresOwnGovernedAction: true,
      }),
      // R2.38 — the server owns every evidence span and every id. There is no path from a
      // model-authored string to semantic authority, so locality is a property of the MENU.
      boundaryEvidenceCandidateAuthority: digest({
        roles: EVIDENCE_ROLES,
        excerptMax: CANDIDATE_EXCERPT_MAX,
        idMax: CANDIDATE_ID_MAX,
        maxPerPool: MAX_CANDIDATES_PER_POOL,
        resolutionCodes: CANDIDATE_RESOLUTION_CODES,
        modelAuthorsExcerpts: false,
        modelAuthorsSegmentMetadata: false,
        candidateIdsAreSurfaceScoped: true,
      }),
      boundaryCandidateExtractionContract: candidateContractSha256(),
      // R2.40 — governed-action eligibility is decided against the boundary's OWN two clauses.
      // R2.39 measured the alternative: an unconditional `true` offered the safe verification choice
      // as a governed action and the correction packet told a Manager to delete it.
      boundaryCandidateRoleAuthority: candidateRoleContractSha256(),
      // R2.44 — candidate identity and locality are not enough. A prerequisite span must also point
      // the right way. R2.43 measured one span serving as governed action, satisfaction AND failure
      // at once, producing five false findings on a branch that kept the boundary.
      boundaryEvidencePolarityAuthority: evidencePolarityContractSha256(),
      boundaryPrerequisitePoolPolarity: digest({
        polarities: EVIDENCE_POLARITY,
        refusalCodes: POLARITY_REFUSAL_CODES,
        satisfactionOnlyRefusedFromFailure: true,
        failureOnlyRefusedFromSatisfaction: true,
        mixedKeepsFailureLosesSatisfaction: true,
        uncertainObservedNotEnforced: true,
        appliesToInheritedParentState: true,
        termsFrom: "semanticFrame.prerequisiteClause",
      }),
      // R2.46 — a violation proved on a generated world state is, by the generation schema, the
      // consequence of the one choice that produced it. That assigns CORRECTION OWNERSHIP only:
      // primary[1] keeps `absent`, keeps candidate 2-a1, keeps `not_applicable`, and never borrows
      // its child's candidate id. R2.45 measured why no text rule can do this job.
      // R2.48 — the two evidence axes stated once. The governed-action candidate is chosen by POOL
      // CARDINALITY; the prerequisite candidates are chosen by the TRUTH STATE. R2.47 measured a live
      // reviewer applying the first rule to the second role because the prompt generalized it, and a
      // required-but-empty pool silently licensing an evidence-free violation.
      // R2.50 — the ONE permitted repair is a PATCH against a server-owned plan. R2.49 measured a
      // whole-row re-ask re-opening a field the model had already answered correctly, and losing the
      // run's verdict to the "improvement".
      // R2.52 — EXECUTABLE-PATH bindings. Content digests proved nothing about reachability: R2.51
      // measured every R2.50 binding matching while the legacy whole-row repair actually ran.
      boundaryStageRoutingContract: digest(BOUNDARY_STAGE_ROUTING_CONTRACT),
      boundaryReplayEntrypointWiring: digest({
        depsDeclareRepair: true,
        entrypointSuppliesRepair: true,
        liveRepairImplementation: "reviewFieldRepair",
        mockRepairImplementation: "mockFieldRepair",
        forcedIncompleteMockOutcome: "incomplete-field-repair",
        completeFirstPassMockIsInsufficient: true,
      }),
      boundaryProductionCallerWiring: digest({
        generationServiceSuppliesRepair: true,
        generationServicePassesSurfaceRefs: true,
        testStubsThrowIfInvoked: true,
        defaultRepairImplementationThatCallsFullRowReviewer: false,
      }),
      boundaryWrittenReplayArtifactVersion: digest(NARROW_REPLAY_ARTIFACT_VERSION),
      boundaryRepairModeContract: digest({
        modes: REPAIR_MODES,
        zeroMetricsNeverImplyRepairRan: true,
        artifactRecordsRepairMode: true,
        artifactRecordsCallCounts: ["fullRowReviewCallCount", "fieldRepairCallCount", "legacyWholeRowRepairCallCount"],
      }),
      /**
       * R2.54 — a multi-field dependency group is accepted only by matching ONE complete canonical
       * alternative, and the merge boundary is observable. R2.53 measured a patch that satisfied
       * every per-field list, crossed the merge, and was refused by the canonical row validator with
       * `boundary_reason_required_missing` — a semantic verdict standing in for a contract refusal.
       */
      boundaryGroupAlternativeAuthority: groupAlternativeContractSha256(),
      boundaryGroupAlternativeContract: digest({
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
        operationValueMaxIsTheReasonCap: FIELD_REPAIR_VALUE_MAX,
      }),
      /**
       * R2.54 — the RUNNER-PREPARATION EXECUTABLE this contract's canary is generated by.
       *
       * A path, bound. R2.51 measured content digests all matching while the code they described was
       * unreachable; the counterpart failure for a runner is a canary generated by a script nobody
       * runs, or a manifest naming a script that no longer exists. The executable-binding test
       * resolves this path, invokes its preparation mode, and reads artifact /6 back through it.
       */
      boundaryReplayRunnerBinding: digest({
        runner: BOUNDARY_REPLAY_RUNNER_PATH,
        mode: "runner_preparation",
        generatesCanaryFromTrackedSource: true,
        bindsToOneHead: true,
        refusesDirtyTrackedTree: true,
        credentialRequestedOnlyAfterEveryProof: true,
        artifactObservabilityReachable: FIELD_REPAIR_OBSERVABILITY_VERSION,
        liveReplayNotAuthorizedByAGreenCanary: true,
      }),
      boundaryFieldRepairApplySeam: digest({
        seam: "applyFieldRepair",
        order: ["validate", "refuse_or_merge"],
        refusedPatchNeverReachesMerge: true,
        mergeAttemptRecorded: true,
        observabilityVersion: FIELD_REPAIR_OBSERVABILITY_VERSION,
        observabilityWithholdsModelReasonProse: true,
        observabilityReportsReasonAsShapeOnly: true,
        artifactVersion: NARROW_REPLAY_ARTIFACT_VERSION,
      }),
      boundaryFieldRepairAuthority: fieldRepairContractSha256(),
      boundaryFieldRepairSchema: digest(FIELD_REPAIR_JSON_SCHEMA),
      boundaryFieldRepairPlanContract: digest({
        schemaName: FIELD_REPAIR_SCHEMA_NAME,
        codes: FIELD_REPAIR_CODES,
        repairableFields: REPAIRABLE_BOUNDARY_FIELDS,
        identityFieldsNeverRepairable: IDENTITY_FIELDS,
        prerequisiteClosure: prerequisiteClosure(),
        governedActionClosure: governedActionClosure(),
        closureDerivedFromTruthStateTable: true,
        baseIsParsedAttemptOneRow: true,
        frozenFieldsAbsentFromExchange: true,
        frozenSemanticFieldImmutableEvenAgainstHumanOracle: true,
      }),
      boundaryFieldRepairMergeAuthority: digest({
        order: ["verify_base_row_digest", "apply_accepted_operations", "copy_untargeted_fields", "revalidate_with_canonical_validator"],
        repairLayerNeverConstructsVerdict: true,
        partialMatrixNeverProducesVerdict: true,
        forbiddenCandidateNeverNormalized: true,
        extraOperationsRefusedNotDiscarded: true,
        fieldRepairFrozenMutationCount: 0,
      }),
      prerequisiteCandidateAuthority: digest({
        governedActionAxis: "pool_cardinality",
        prerequisiteAxis: "truth_state",
        forbiddenMeansNoneRegardlessOfPool: true,
        requiredWithEmptyPoolIsUnsupported: true,
        emptyPoolNeverLicensesEvidenceFreeFinding: true,
        unavailableCodes: PREREQUISITE_UNAVAILABLE_CODES,
        roleDistinguishingCodes: true,
        governedActionEmptyPoolContractUnchanged: true,
      }),
      // The prompt's per-state clauses are GENERATED from these requirements, so prompt and
      // validator cannot drift into two authorities again.
      truthStateCandidateRequirements: digest(
        TRUTH_STATES.map((t) => ({
          id: t.id,
          governedActionCandidate: t.governedActionCandidate,
          satisfactionCandidate: t.satisfactionCandidate,
          failureCandidate: t.failureCandidate,
          renderedClause: renderCandidateRequirements(t),
        })),
      ),
      generatedResultAncestorAttribution: causalAttributionContractSha256(),
      generatedResultAttributionEdge: digest({
        authority: ATTRIBUTION_AUTHORITY,
        refusalCodes: ATTRIBUTION_REFUSAL_CODES,
        edgeFrom: "generationSchema.branches[primaryChoiceId].resultingWorldState",
        requiresSingleDirectParent: true,
        requiresLearnerDecisionParent: true,
        requiresIndependentlySelectableParent: true,
        requiresParentInFrozenSurfaceMap: true,
        requiresCandidateValidChildViolation: true,
        requiresBranchIndexMatchesPrimaryIndex: true,
        twoHopDescendantRefused: true,
        textOverlapConsulted: false,
        modelAuthoredAttributionField: false,
      }),
      boundaryDirectRowImmutability: digest({
        ancestorDirectAssessmentMutationCount: 0,
        ancestorGovernedActionStatusPreserved: true,
        ancestorGovernedActionCandidateIdPreserved: true,
        ancestorApplicabilityPreserved: true,
        childCandidateIdsPreserved: true,
        childViolationMechanismPreserved: true,
        candidatePoolsUnchanged: true,
        crossSurfaceCandidateCitationStillRefused: "boundary_candidate_wrong_surface",
      }),
      boundaryCausalCorrectionOwnership: digest({
        groupedBy: "explicit_causal_group_identity",
        dedupBasisIsMechanismEquality: false,
        ownerIsAncestorWhenAttributed: true,
        manifestationRetainsDirectFinding: true,
        manifestationEmitsNoSeparateInstruction: true,
        independentlySelectableReopeningRemainsOwnOwner: true,
        packetItemsPerCausalGroup: 1,
        ownerAndManifestationShareOneItemAtTwoCoordinates: true,
      }),
      boundaryGovernedActionPoolConstruction: digest({
        roleGate: "boundaryCandidateRole",
        refusesPrerequisiteOperationOnly: true,
        unrelatedSpansRemainEligible: true,
        roleCollisionRecordedNotRefused: true,
        polarityEnforced: false,
      }),
      boundaryPoolAwareCandidateRequirements: digest({
        requiredOnlyWhenPoolNonEmpty: true,
        presentStatusRequiresNonEmptyPool: true,
        emptyPoolAcceptsSentinel: true,
        codes: ["boundary_governed_action_candidate_unavailable", "boundary_candidate_role_uncertain"],
      }),
      boundaryTruthStateTable: truthStateTableSha256(),
      boundaryTruthStateCoverage: digest({
        states: TRUTH_STATE_IDS,
        ...truthStateCoverage(GOVERNED_ACTION_STATUSES, PREREQUISITE_STATUSES, TEMPORAL_RELATIONS),
      }),
      boundaryRemovedModelAuthoredFields: digest(REMOVED_MODEL_AUTHORED_FIELDS),
      boundarySubsetRepairAuthority: digest({
        codes: SUBSET_REPAIR_CODES,
        repairableFailureClass: "output_contract",
        preservedRowsImmutable: true,
        maxRepairInvocations: 1,
        partialMatrixNeverAVerdict: true,
      }),
      boundaryCorrectionPacketAuthority: digest({
        findingsFromCausalViolationsOnly: true,
        everyExcerptServerResolved: true,
        candidateIdsRecorded: true,
        partialMatrixExcluded: true,
      }),
    },
    sampling: {
      generation: PRACTICE_SAMPLING.generation,
      review: PRACTICE_SAMPLING.review,
      retry: PRACTICE_SAMPLING.retry,
      environmentOverrides: PRACTICE_SAMPLING.environmentOverrides,
    },
  };
}

/** The single digest a runner binds to. */
export const manifestDigest = (m: ContractManifest): string => digest(m);

/** Digest of one named canary case, so a corpus edit to a bound case is detectable on its own. */
export function caseDigest(ids: string[]): string {
  const selected = EVAL_CORPUS.filter((c) => ids.includes(c.id)).sort((a, b) => (a.id < b.id ? -1 : 1));
  return digest(selected.map((c) => ({ id: c.id, locale: c.locale, input: c.input })));
}
