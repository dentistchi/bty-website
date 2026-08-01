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
  GENERIC_EVIDENCE_PHRASES,
  MIN_EVIDENCE_CHARS,
  APPLICABILITY_RESULTS,
  COMPLIANCE_RESULTS,
  VIOLATION_MECHANISMS,
} from "@/domain/foundry/arena-draft/narrowBoundaryReview";
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
export const ARTIFACT_SCHEMA_VERSION = "r2.34.1";
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
      boundaryEvidenceGrounding: digest({
        genericPhrases: GENERIC_EVIDENCE_PHRASES,
        minEvidenceChars: MIN_EVIDENCE_CHARS,
        codes: NARROW_BOUNDARY_CODES,
      }),
      // R2.30 — applicability is asked BEFORE compliance, and a violation must name a mechanism.
      boundaryApplicabilityContract: digest({ applicability: APPLICABILITY_RESULTS, compliance: COMPLIANCE_RESULTS }),
      boundaryViolationMechanism: digest(VIOLATION_MECHANISMS),
      boundaryCausalLineage: digest({ version: SURFACE_MAP_VERSION, earliestCausalDerivation: "mechanism+governed_action_dedup_over_lineage" }),
      boundaryCorrectionPrecision: digest({ correctionFrom: "causal_violations_only", downstreamIsEvidenceOnly: true, notApplicableNeverCorrects: true }),
      boundaryWorldStateAuthority: digest({ escalationFallback: false, missingIsAuthorityFailure: true }),
      serverDerivedBoundaryVerdict: digest({
        applicability: APPLICABILITY_RESULTS,
        compliance: COMPLIANCE_RESULTS,
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
