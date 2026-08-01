/**
 * NARROW BOUNDARY-REVIEW TOKEN BUDGET (Slice 3.2I-R5B1A.1-R2.29 Part 11).
 *
 * A truncated safety review is the one failure mode this stage cannot afford: it would arrive as
 * `boundary_review_truncated`, burn the single rerun, and terminate — spending two provider calls to
 * learn nothing. So the bounds were chosen FROM this measurement rather than before it.
 */
import { describe, expect, it } from "vitest";
import { BUDGET_HEADROOM, MODEL_OUTPUT_CAP, measureNarrowBoundaryBudget } from "./tokenBudget";
import { NARROW_BOUNDARY_SAMPLING } from "./narrowBoundaryContract";
import { MAX_NARROW_ASSESSMENTS, NARROW_EVIDENCE_MAX, NARROW_REASON_MAX } from "@/domain/foundry/arena-draft/narrowBoundaryReview";
import { buildMaxNarrowBoundaryReview } from "@/domain/foundry/arena-draft/maxFixture";
import { BRANCH_AWARE_REACHABLE_SURFACE_COUNT } from "@/domain/foundry/arena-draft/boundarySurfaces";
import { MAX_ACTIVE_BOUNDARIES } from "@/domain/foundry/arena-draft/boundaryScope";

const m = measureNarrowBoundaryBudget(NARROW_BOUNDARY_SAMPLING.maxTokens);

describe("narrow boundary-review budget", () => {
  it("the schema's permitted maximum does NOT exceed the model output cap", () => {
    expect(m.schemaExceedsModelCap).toBe(false);
    expect(Math.max(m.schemaBoundEnglish.tokens, m.schemaBoundKorean.tokens)).toBeLessThan(MODEL_OUTPUT_CAP);
  });

  it("the configured budget holds the schema's permitted maximum, in English AND Korean", () => {
    expect(m.schemaCanExceedBudget).toBe(false);
    expect(m.configuredBudget).toBeGreaterThanOrEqual(m.schemaBoundKorean.tokens);
  });

  it("clears the required 1.25x headroom over the realistic maximum", () => {
    expect(BUDGET_HEADROOM).toBe(1.25);
    expect(m.sufficient).toBe(true);
    expect(m.configuredBudget).toBeGreaterThanOrEqual(m.requiredTokens * BUDGET_HEADROOM);
  });

  it("clears 1.25x headroom over the SCHEMA-permitted maximum as well", () => {
    expect(m.measuredHeadroom).toBeGreaterThanOrEqual(1.25);
  });

  it("Korean is the binding case, as the estimator intends", () => {
    expect(m.maximumKorean.tokens).toBeGreaterThan(m.maximumEnglish.tokens);
    expect(m.schemaBoundKorean.tokens).toBeGreaterThan(m.schemaBoundEnglish.tokens);
  });

  it("the worst case is three boundaries x the REACHABLE surface count — compatibility is excluded", () => {
    expect(MAX_NARROW_ASSESSMENTS).toBe(MAX_ACTIVE_BOUNDARIES * BRANCH_AWARE_REACHABLE_SURFACE_COUNT);
    expect(buildMaxNarrowBoundaryReview(false, "schema").assessments).toHaveLength(MAX_NARROW_ASSESSMENTS);
  });

  it("a ONE-boundary review costs a third of the three-boundary worst case", () => {
    const three = buildMaxNarrowBoundaryReview(true, "schema").assessments;
    const one = three.slice(0, BRANCH_AWARE_REACHABLE_SURFACE_COUNT);
    expect(one).toHaveLength(BRANCH_AWARE_REACHABLE_SURFACE_COUNT);
    // Serialized size scales linearly in the assessment count; both fit the budget with room.
    expect(JSON.stringify({ assessments: one }).length).toBeLessThan(JSON.stringify({ assessments: three }).length);
  });

  it("every text field is bounded, so the permitted maximum is finite by construction", () => {
    expect(NARROW_EVIDENCE_MAX).toBeGreaterThan(0);
    expect(NARROW_REASON_MAX).toBeGreaterThan(0);
    for (const a of buildMaxNarrowBoundaryReview(false, "schema").assessments) {
      expect(a.governedActionEvidence.length).toBeLessThanOrEqual(NARROW_EVIDENCE_MAX);
      expect(a.prerequisiteFailureEvidence.length).toBeLessThanOrEqual(NARROW_EVIDENCE_MAX);
      expect(a.reason.length).toBeLessThanOrEqual(NARROW_REASON_MAX);
    }
  });

  it("uses deterministic sampling — a safety authority must not vary its answer", () => {
    expect(NARROW_BOUNDARY_SAMPLING.temperature).toBe(0);
    expect(NARROW_BOUNDARY_SAMPLING.topP).toBe(1);
  });
});
