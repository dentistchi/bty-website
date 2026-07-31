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

/** Bumped whenever the artifact payload shape changes, so old evidence is never misread as new. */
export const ARTIFACT_SCHEMA_VERSION = "r2.23.1";
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
