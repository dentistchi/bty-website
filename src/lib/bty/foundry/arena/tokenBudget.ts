/**
 * OUTPUT-TOKEN BUDGET MEASUREMENT (Slice 3.2I-R5B1A.1-R2.23).
 *
 * The generation budget has been 4,000 tokens since R2.15, when the provider schema was much
 * smaller. R2.21 added a boundary-grounding record per confirmed rule; R2.22 added a construction
 * record to EVERY choice, and grew the reviewer response from a primary-only verdict to one entry
 * per visible choice plus branch progression and a cross-branch comparison.
 *
 * A ceiling below a schema's worst case does not degrade gracefully — R2.15 measured that: the body
 * truncates mid-object and the failure is misreported. So both budgets are measured against the
 * actual maximum-cardinality fixture rather than assumed.
 *
 * NO TOKENIZER IS INSTALLED in this repository (verified: no tiktoken / gpt-tokenizer / js-tiktoken
 * dependency). Adding one for a build-time measurement is not worth a production dependency, so the
 * estimator is a deliberately CONSERVATIVE character model, documented and tested:
 *
 *   ASCII/Latin  ~3 chars per token  (real cl100k averages ~4 for prose and ~3 for dense JSON)
 *   Hangul       ~1 token per char   (cl100k typically 1-1.5 for Korean; syllables often split)
 *   Structural   every JSON delimiter counted, since punctuation tokenizes poorly
 *
 * The model over-estimates on purpose. A budget sized from an over-estimate is safe; one sized from
 * an under-estimate truncates in production. If a tokenizer is ever added, `estimateTokens` is the
 * single seam to replace, and the tests pin the properties an exact count must still satisfy.
 *
 * Deterministic: no clock, no randomness, no network.
 */

import { createHash } from "node:crypto";
import { buildMaxProviderScenario, buildMaxSemanticReview, buildMinProviderScenario } from "@/domain/foundry/arena-draft/maxFixture";

export const TOKEN_ESTIMATOR_ID = "bty-conservative-char-model-v1";

/** Characters per token for Latin text in dense JSON. Lower than prose — deliberately pessimistic. */
const ASCII_CHARS_PER_TOKEN = 3;
/** Hangul syllables per token. cl100k usually needs more than one token per syllable. */
const HANGUL_TOKENS_PER_CHAR = 1;

export type TokenEstimate = {
  bytes: number;
  chars: number;
  asciiChars: number;
  hangulChars: number;
  otherChars: number;
  tokens: number;
  estimator: string;
};

/** Conservative output-token estimate for a serialized JSON payload. */
export function estimateTokens(serialized: string): TokenEstimate {
  let ascii = 0;
  let hangul = 0;
  let other = 0;
  for (const ch of serialized) {
    const cp = ch.codePointAt(0)!;
    if (cp >= 0xac00 && cp <= 0xd7a3) hangul++;
    else if (cp < 128) ascii++;
    else other++;
  }
  // `other` (CJK, emoji, accented Latin) is treated at the Hangul rate — the pessimistic side.
  const tokens = Math.ceil(ascii / ASCII_CHARS_PER_TOKEN) + Math.ceil((hangul + other) * HANGUL_TOKENS_PER_CHAR);
  return {
    bytes: Buffer.byteLength(serialized, "utf8"),
    chars: [...serialized].length,
    asciiChars: ascii,
    hangulChars: hangul,
    otherChars: other,
    tokens,
    estimator: TOKEN_ESTIMATOR_ID,
  };
}

export const sha256 = (s: string): string => createHash("sha256").update(s).digest("hex");

export type BudgetMeasurement = {
  label: string;
  /** Digest of the REALISTIC English maximum — the fixture the budget is sized from. */
  fixtureSha256: string;
  /** Digest of the schema-theoretical maximum, tracked so a schema change is visible. */
  schemaFixtureSha256: string;
  minimum: TokenEstimate;
  maximumEnglish: TokenEstimate;
  maximumKorean: TokenEstimate;
  /**
   * The schema's outer bound. Reported, NOT budgeted for: it exceeds the output cap of the
   * configured model class, so the mitigation is truncation detection, not a larger ceiling.
   */
  schemaBoundEnglish: TokenEstimate;
  schemaBoundKorean: TokenEstimate;
  /** The number the budget must clear: the worse of the two REALISTIC maxima. */
  requiredTokens: number;
  headroomRatio: number;
  recommendedBudget: number;
  configuredBudget: number;
  sufficient: boolean;
  /** True when the schema permits a response the configured budget cannot hold. */
  schemaCanExceedBudget: boolean;
};

/** Round a budget up to a readable step so the configured value is never an odd measured number. */
const roundBudget = (n: number): number => Math.ceil(n / 500) * 500;

/** Safety headroom over the measured maximum. Absorbs estimator error and model verbosity. */
export const BUDGET_HEADROOM = 1.25;

function measure(
  label: string,
  min: string,
  maxEn: string,
  maxKo: string,
  schemaEn: string,
  schemaKo: string,
  configured: number,
): BudgetMeasurement {
  const minimum = estimateTokens(min);
  const maximumEnglish = estimateTokens(maxEn);
  const maximumKorean = estimateTokens(maxKo);
  const schemaBoundEnglish = estimateTokens(schemaEn);
  const schemaBoundKorean = estimateTokens(schemaKo);
  const requiredTokens = Math.max(maximumEnglish.tokens, maximumKorean.tokens);
  const recommendedBudget = roundBudget(requiredTokens * BUDGET_HEADROOM);
  return {
    label,
    fixtureSha256: sha256(maxEn),
    schemaFixtureSha256: sha256(schemaEn),
    minimum,
    maximumEnglish,
    maximumKorean,
    schemaBoundEnglish,
    schemaBoundKorean,
    requiredTokens,
    headroomRatio: BUDGET_HEADROOM,
    recommendedBudget,
    configuredBudget: configured,
    sufficient: configured >= recommendedBudget,
    schemaCanExceedBudget: Math.max(schemaBoundEnglish.tokens, schemaBoundKorean.tokens) > configured,
  };
}

/** Measure the provider generation budget against the current strict schema. */
export function measureProviderBudget(configured: number): BudgetMeasurement {
  return measure(
    "provider_generation",
    JSON.stringify(buildMinProviderScenario()),
    JSON.stringify(buildMaxProviderScenario(false, "realistic")),
    JSON.stringify(buildMaxProviderScenario(true, "realistic")),
    JSON.stringify(buildMaxProviderScenario(false, "schema")),
    JSON.stringify(buildMaxProviderScenario(true, "schema")),
    configured,
  );
}

/** Measure the semantic-review budget against the current strict review schema. */
export function measureReviewBudget(configured: number): BudgetMeasurement {
  // A minimal review still covers every visible choice of a minimal scenario; the max fixture is
  // what sizes the budget, so the lower bound is reported for context only.
  return measure(
    "semantic_review",
    JSON.stringify({ minimal: true }),
    JSON.stringify(buildMaxSemanticReview(false, "realistic")),
    JSON.stringify(buildMaxSemanticReview(true, "realistic")),
    JSON.stringify(buildMaxSemanticReview(false, "schema")),
    JSON.stringify(buildMaxSemanticReview(true, "schema")),
    configured,
  );
}
