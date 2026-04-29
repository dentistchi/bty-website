import { describe, it, expect } from "vitest";
import { DIMENSIONS, reverseScore, scaleTo100, computeDimensionScores } from "./scoring";
import type { Question, AssessmentAnswers } from "./types";

describe("assessment/scoring", () => {
  it("DIMENSIONS has five dimension keys", () => {
    expect(DIMENSIONS).toHaveLength(5);
    expect(DIMENSIONS).toContain("core_self_esteem");
    expect(DIMENSIONS).toContain("social_self_esteem");
  });

  it("reverseScore maps 1..5 to 5..1", () => {
    expect(reverseScore(1)).toBe(5);
    expect(reverseScore(3)).toBe(3);
    expect(reverseScore(5)).toBe(1);
  });

  it("scaleTo100 maps sum 10->0, 50->100 and clamps", () => {
    expect(scaleTo100(10)).toBe(0);
    expect(scaleTo100(50)).toBe(100);
    expect(scaleTo100(30)).toBe(50);
    expect(scaleTo100(0)).toBe(0);
  });

  it("computeDimensionScores returns DimensionScores for questions and answers", () => {
    const questions: Question[] = [
      { id: "q1", text_en: "Q1", text_ko: "Q1", dimension: "core_self_esteem", reverse: false },
      { id: "q2", text_en: "Q2", text_ko: "Q2", dimension: "core_self_esteem", reverse: true },
    ];
    const answers: AssessmentAnswers = { q1: 5, q2: 1 }; // 5 + reverse(1)=5 => sum 10
    const out = computeDimensionScores(questions, answers);
    expect(out.core_self_esteem).toBeDefined();
    expect(out.self_compassion).toBeDefined();
    expect(out.self_esteem_stability).toBeDefined();
    expect(out.growth_mindset).toBeDefined();
    expect(out.social_self_esteem).toBeDefined();
    expect(typeof out.core_self_esteem).toBe("number");
  });
});
