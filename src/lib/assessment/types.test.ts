import { describe, it, expect } from "vitest";
import type { AssessmentResult, DimensionScores, DimensionKey } from "./types";

const DIMENSION_KEYS: DimensionKey[] = [
  "core_self_esteem",
  "self_compassion",
  "self_esteem_stability",
  "growth_mindset",
  "social_self_esteem",
];

describe("assessment/types", () => {
  it("DimensionScores has all five dimension keys", () => {
    const scores: DimensionScores = {
      core_self_esteem: 50,
      self_compassion: 50,
      self_esteem_stability: 50,
      growth_mindset: 50,
      social_self_esteem: 50,
    };
    expect(Object.keys(scores).sort()).toEqual([...DIMENSION_KEYS].sort());
  });

  it("AssessmentResult shape has required fields", () => {
    const scores: DimensionScores = {
      core_self_esteem: 50,
      self_compassion: 50,
      self_esteem_stability: 50,
      growth_mindset: 50,
      social_self_esteem: 50,
    };
    const result: AssessmentResult = {
      version: 1,
      createdAtISO: new Date().toISOString(),
      scores,
      pattern: "balanced",
      barriers: [],
      recommendedTrack: "Balanced Growth",
      summaryTitle_en: "title",
      summaryTitle_ko: "제목",
      summaryBody_en: "body",
      summaryBody_ko: "본문",
    };
    expect(result.version).toBe(1);
    expect(typeof result.createdAtISO).toBe("string");
    expect(Object.keys(result.scores)).toHaveLength(5);
    expect(["perfectionism", "approval_seeking", "fragile_stability", "low_growth_fuel", "self_criticism_loop", "balanced"]).toContain(result.pattern);
    expect(Array.isArray(result.barriers)).toBe(true);
    expect(typeof result.recommendedTrack).toBe("string");
    expect(typeof result.summaryTitle_en).toBe("string");
    expect(typeof result.summaryTitle_ko).toBe("string");
    expect(typeof result.summaryBody_en).toBe("string");
    expect(typeof result.summaryBody_ko).toBe("string");
  });
});
