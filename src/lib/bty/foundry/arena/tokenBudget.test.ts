import { describe, it, expect } from "vitest";
import { BUDGET_HEADROOM, TOKEN_ESTIMATOR_ID, estimateTokens, measureProviderBudget, measureReviewBudget, sha256 } from "./tokenBudget";
import { buildMaxProviderScenario, buildMaxSemanticReview, buildMinProviderScenario, MAX_VISIBLE_CHOICES } from "@/domain/foundry/arena-draft/maxFixture";
import { validateProviderScenario } from "@/domain/foundry/arena-draft/providerDto";
import { PRACTICE_SAMPLING } from "./arenaScenarioGenerationService";

/**
 * OUTPUT-TOKEN BUDGET (Slice 3.2I-R5B1A.1-R2.23).
 *
 * 4,000 tokens was set in R2.15, before boundary grounding and a construction record on every
 * choice. These tests pin the measurement, not a hoped-for number: the fixtures are deterministic,
 * the estimator is documented, and a schema change moves the fixture digest.
 */

/** The shape the R2.23 stability runner actually generates. */
const CANARY = { primary: 2, tradeoff: 2, action: 2, boundaries: 1 };

describe("estimator", () => {
  it("20. is deterministic and identifies itself", () => {
    const a = estimateTokens('{"a":"hello world"}');
    const b = estimateTokens('{"a":"hello world"}');
    expect(a).toEqual(b);
    expect(a.estimator).toBe(TOKEN_ESTIMATOR_ID);
  });

  it("22. charges Korean far more per character than Latin — the expansion risk is modelled", () => {
    const en = estimateTokens("abcdefghij".repeat(20));
    const ko = estimateTokens("가나다라마바사아자차".repeat(20));
    expect(ko.tokens).toBeGreaterThan(en.tokens * 2.5);
    expect(ko.hangulChars).toBe(200);
    expect(en.asciiChars).toBe(200);
  });

  it("is conservative — it never estimates fewer tokens than a 4-chars-per-token model would", () => {
    const s = JSON.stringify(buildMinProviderScenario());
    expect(estimateTokens(s).tokens).toBeGreaterThan(s.length / 4);
  });
});

describe("18/19. maximum fixtures", () => {
  it("18. the maximum provider fixture is built at the real product cardinality and VALIDATES", () => {
    const max = buildMaxProviderScenario(false, "realistic");
    // R2.23A — generated Practice is EXACTLY two at every decision point.
    expect(max.primaryChoices).toHaveLength(2);
    expect(max.branches).toHaveLength(2);
    const total = max.primaryChoices.length + max.flatTradeoffChoices.length + max.flatActionDecision.choices.length
      + max.branches.reduce((n, b) => n + b.tradeoffChoices.length + b.actionDecision.choices.length, 0);
    expect(total).toBe(MAX_VISIBLE_CHOICES);
    // It must be a scenario the contract would actually accept, or it is not a measurement.
    expect(validateProviderScenario(max).ok).toBe(true);
  });

  it("18b. every choice carries a full construction, and NO attestation", () => {
    const max = buildMaxProviderScenario(false, "realistic");
    for (const c of max.primaryChoices) {
      expect(Object.values(c.construction).every((v) => (Array.isArray(v) ? true : String(v).length > 0))).toBe(true);
      expect("constraintAssessments" in c).toBe(false); // R2.23C
    }
    expect(max.boundaryGrounding).toHaveLength(3);
    expect(MAX_VISIBLE_CHOICES).toBe(14); // 2 primary + 2 flat tradeoff + 2 flat action + 2 branches x 4
  });

  it("19. the fixture digest is stable across builds and MOVES when the profile changes", () => {
    const a = sha256(JSON.stringify(buildMaxProviderScenario(false, "realistic")));
    const b = sha256(JSON.stringify(buildMaxProviderScenario(false, "realistic")));
    expect(a).toBe(b);
    expect(sha256(JSON.stringify(buildMaxProviderScenario(false, "schema")))).not.toBe(a);
    expect(sha256(JSON.stringify(buildMaxProviderScenario(true, "realistic")))).not.toBe(a);
  });

  it("24. the maximum review fixture covers every visible choice and every branch", () => {
    const r = buildMaxSemanticReview(false, "realistic");
    expect(r.phaseChoices).toHaveLength(MAX_VISIBLE_CHOICES);
    expect(r.branches).toHaveLength(2);
    expect(r.boundaryAssessments).toHaveLength(3);
    expect(r.urgency.choices).toHaveLength(2);
    expect(r.crossBranch).toBeDefined();
  });
});

describe("21/25. the configured budgets clear the measured requirement", () => {
  const gen = measureProviderBudget(PRACTICE_SAMPLING.generation.maxTokens);
  const rev = measureReviewBudget(PRACTICE_SAMPLING.review.maxTokens);

  it("THE MEASURED DEFECT — the previous 4,000-token generation budget was below its own requirement", () => {
    const canaryEn = estimateTokens(JSON.stringify(buildMaxProviderScenario(false, "realistic", CANARY))).tokens;
    const canaryKo = estimateTokens(JSON.stringify(buildMaxProviderScenario(true, "realistic", CANARY))).tokens;
    // Even the SMALL canary shape needed more than 4,000. Every Korean case was one verbose
    // response away from truncating, and the outcome would have read as `malformed_shape`.
    expect(canaryEn).toBeGreaterThan(4000);
    expect(canaryKo).toBeGreaterThan(4000);
  });

  it("21. the generation budget exceeds the canary-shape maximum with the documented headroom", () => {
    const canaryKo = estimateTokens(JSON.stringify(buildMaxProviderScenario(true, "realistic", CANARY))).tokens;
    expect(BUDGET_HEADROOM).toBe(1.25);
    expect(PRACTICE_SAMPLING.generation.maxTokens).toBeGreaterThanOrEqual(canaryKo * BUDGET_HEADROOM);
  });

  it("25. the review budget exceeds the canary-shape maximum with the same headroom", () => {
    const canaryKo = estimateTokens(JSON.stringify(buildMaxSemanticReview(true, "realistic", CANARY))).tokens;
    expect(PRACTICE_SAMPLING.review.maxTokens).toBeGreaterThanOrEqual(canaryKo * BUDGET_HEADROOM);
  });

  it("R2.23C — 37. the schema can NO LONGER exceed the budget, on either side", () => {
    // R2.23A left this true: the schema permitted a valid Practice the model could not emit.
    // Removing the generator's self-attestation and capping ACTIVE boundaries at three closed it.
    expect(gen.schemaCanExceedBudget).toBe(false);
    expect(rev.schemaCanExceedBudget).toBe(false);
    expect(gen.schemaExceedsModelCap).toBe(false);
    expect(rev.schemaExceedsModelCap).toBe(false);
  });

  it("35/36. both KO maxima clear the configured budget with at least 25% headroom", () => {
    expect(Math.ceil(gen.schemaBoundKorean.tokens * 1.25)).toBeLessThanOrEqual(PRACTICE_SAMPLING.generation.maxTokens);
    expect(Math.ceil(rev.schemaBoundKorean.tokens * 1.25)).toBeLessThanOrEqual(PRACTICE_SAMPLING.review.maxTokens);
    expect(gen.measuredHeadroom).toBeGreaterThanOrEqual(1.25);
    expect(rev.measuredHeadroom).toBeGreaterThanOrEqual(1.25);
  });

  it("38. the configured budget stays under the model output cap", () => {
    expect(PRACTICE_SAMPLING.generation.maxTokens).toBeLessThanOrEqual(gen.modelOutputCap);
    expect(PRACTICE_SAMPLING.review.maxTokens).toBeLessThanOrEqual(rev.modelOutputCap);
  });

  it("23b. the measurement records the estimator, the fixture digests and the headroom it used", () => {
    expect(gen.maximumEnglish.estimator).toBe(TOKEN_ESTIMATOR_ID);
    expect(gen.fixtureSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(gen.schemaFixtureSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(gen.fixtureSha256).not.toBe(gen.schemaFixtureSha256);
    expect(gen.headroomRatio).toBe(BUDGET_HEADROOM);
    expect(gen.minimum.tokens).toBeLessThan(gen.maximumEnglish.tokens);
  });

  it("22b. Korean is the binding constraint on both budgets, so it is what `requiredTokens` reports", () => {
    expect(gen.maximumKorean.tokens).toBeGreaterThan(gen.maximumEnglish.tokens);
    expect(gen.requiredTokens).toBe(gen.maximumKorean.tokens);
    expect(rev.requiredTokens).toBe(rev.maximumKorean.tokens);
  });

  it("a budget below the measured requirement is reported INSUFFICIENT — the gate cannot be flattered", () => {
    expect(measureProviderBudget(4000).sufficient).toBe(false);
    expect(measureReviewBudget(6000).sufficient).toBe(false);
  });
});
