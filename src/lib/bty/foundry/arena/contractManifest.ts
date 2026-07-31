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
import { MODEL_OUTPUT_CAP, measureProviderBudget, measureReviewBudget } from "./tokenBudget";

/**
 * R2.23A — the GENERATED cardinality contract, digested into the manifest. A change here changes
 * what a generated Practice IS, so no prior artifact may be attributed to the new contract.
 */
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
export const ARTIFACT_SCHEMA_VERSION = "r2.23a.1";
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
    fieldBounds: GENERATED_FIELD_BOUNDS,
    modelOutputCap: MODEL_OUTPUT_CAP,
    schemaCanExceedBudget:
      measureProviderBudget(PRACTICE_SAMPLING.generation.maxTokens).schemaCanExceedBudget ||
      measureReviewBudget(PRACTICE_SAMPLING.review.maxTokens).schemaCanExceedBudget,
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
      generatedFieldBounds: digest(GENERATED_FIELD_BOUNDS),
      tokenBudget: digest({
        modelOutputCap: MODEL_OUTPUT_CAP,
        generation: budgetFingerprint(measureProviderBudget(PRACTICE_SAMPLING.generation.maxTokens)),
        review: budgetFingerprint(measureReviewBudget(PRACTICE_SAMPLING.review.maxTokens)),
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
