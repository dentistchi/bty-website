import { describe, it, expect } from "vitest";
import { scoreAssessment } from "./index";
import { QUESTIONS } from "./questions";
import type { AssessmentAnswers } from "./types";

describe("assessment/index", () => {
  it("scoreAssessment returns AssessmentResult with all required fields", () => {
    const answers: AssessmentAnswers = {};
    for (const q of QUESTIONS) answers[q.id] = 3;
    const result = scoreAssessment(QUESTIONS, answers);

    expect(result.version).toBe(1);
    expect(typeof result.createdAtISO).toBe("string");
    expect(result.scores).toBeDefined();
    expect(result.scores.core_self_esteem).toBeDefined();
    expect(result.scores.self_compassion).toBeDefined();
    expect(result.scores.self_esteem_stability).toBeDefined();
    expect(result.scores.growth_mindset).toBeDefined();
    expect(result.scores.social_self_esteem).toBeDefined();
    expect(typeof result.pattern).toBe("string");
    expect(Array.isArray(result.barriers)).toBe(true);
    expect(typeof result.recommendedTrack).toBe("string");
    expect(typeof result.summaryTitle_en).toBe("string");
    expect(typeof result.summaryTitle_ko).toBe("string");
    expect(typeof result.summaryBody_en).toBe("string");
    expect(typeof result.summaryBody_ko).toBe("string");
  });

  it("scoreAssessment with neutral answers returns balanced pattern", () => {
    const answers: AssessmentAnswers = {};
    for (const q of QUESTIONS) answers[q.id] = 3;
    const result = scoreAssessment(QUESTIONS, answers);
    expect(["balanced", "perfectionism", "approval_seeking", "fragile_stability", "low_growth_fuel", "self_criticism_loop"]).toContain(result.pattern);
  });
});
