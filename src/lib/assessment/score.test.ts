import { describe, it, expect } from "vitest";
import {
  reverseScore,
  to0to100,
  scoreAnswers,
  detectPattern,
  type Question,
  type Scores,
} from "./score";

describe("assessment/score", () => {
  it("reverseScore maps 1..5 to 5..1", () => {
    expect(reverseScore(1)).toBe(5);
    expect(reverseScore(2)).toBe(4);
    expect(reverseScore(3)).toBe(3);
    expect(reverseScore(4)).toBe(2);
    expect(reverseScore(5)).toBe(1);
  });

  it("to0to100 maps sum 10->0, 50->100", () => {
    expect(to0to100(10)).toBe(0);
    expect(to0to100(50)).toBe(100);
    expect(to0to100(30)).toBe(50);
  });

  it("scoreAnswers aggregates by dimension and applies reverse where needed", () => {
    const questions: Question[] = [
      { id: 1, dimension: "core", text: "Q1", reverse: false },
      { id: 2, dimension: "core", text: "Q2", reverse: true },
      { id: 3, dimension: "compassion", text: "Q3", reverse: false },
    ];
    const answers = { 1: 5, 2: 1, 3: 3 }; // core: 5 + reverse(1)=5 => 10; compassion: 3
    const out = scoreAnswers(questions, answers);
    expect(out.core).toBe(to0to100(10)); // 10 -> 0
    expect(out.compassion).toBe(to0to100(3));
    expect(out.stability).toBe(to0to100(0));
    expect(out.growth).toBe(to0to100(0));
    expect(out.social).toBe(to0to100(0));
  });

  it("scoreAnswers throws on out-of-range answer", () => {
    const questions: Question[] = [{ id: 1, dimension: "core", text: "Q1", reverse: false }];
    expect(() => scoreAnswers(questions, { 1: 0 })).toThrow(/Q1=0/);
    expect(() => scoreAnswers(questions, { 1: 6 })).toThrow(/Q1=6/);
  });

  it("detectPattern returns balanced when all dimensions >= 70", () => {
    const scores: Scores = { core: 80, compassion: 75, stability: 70, growth: 72, social: 71 };
    const r = detectPattern(scores);
    expect(r.pattern).toBe("balanced");
    expect(r.track).toBe("Core Confidence");
  });

  it("detectPattern returns perfectionism when core high and compassion low", () => {
    const scores: Scores = { core: 75, compassion: 40, stability: 60, growth: 60, social: 60 };
    const r = detectPattern(scores);
    expect(r.pattern).toBe("perfectionism");
    expect(r.track).toBe("Self-Compassion First");
  });

  it("detectPattern returns fragile_self_esteem when stability low", () => {
    const scores: Scores = { core: 60, compassion: 60, stability: 40, growth: 60, social: 60 };
    const r = detectPattern(scores);
    expect(r.pattern).toBe("fragile_self_esteem");
    expect(r.track).toBe("Stability First");
  });
});
