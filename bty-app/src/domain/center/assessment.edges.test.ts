/**
 * Center assessment 도메인 경계 테스트.
 * assessment.test.ts와 중복 없이 미커버 경계만.
 */
import { describe, it, expect } from "vitest";
import {
  validateAssessmentAnswers,
  type AssessmentSubmission,
  type AssessmentHistory,
} from "./assessment";

describe("validateAssessmentAnswers (edges)", () => {
  it("null as answers returns answers_empty", () => {
    const r = validateAssessmentAnswers(null as unknown as Record<number, number>, 1);
    expect(r.ok).toBe(false);
    expect(r.error).toBe("answers_empty");
  });

  it("undefined as answers returns answers_empty", () => {
    const r = validateAssessmentAnswers(undefined as unknown as Record<number, number>, 1);
    expect(r.ok).toBe(false);
    expect(r.error).toBe("answers_empty");
  });

  it("non-object (e.g. number) as answers returns answers_empty", () => {
    const r = validateAssessmentAnswers(42 as unknown as Record<number, number>, 1);
    expect(r.ok).toBe(false);
    expect(r.error).toBe("answers_empty");
  });

  it("questionCount 0 with empty object returns answers_empty", () => {
    const r = validateAssessmentAnswers({}, 0);
    expect(r.ok).toBe(false);
    expect(r.error).toBe("answers_empty");
  });

  it("questionCount 0 with one answer returns answers_count_mismatch", () => {
    const r = validateAssessmentAnswers({ 1: 3 }, 0);
    expect(r.ok).toBe(false);
    expect(r.error).toContain("answers_count_mismatch");
  });

  it("non-integer answer value returns answer_out_of_range", () => {
    const r = validateAssessmentAnswers({ 1: 2.5 }, 1);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/answer_out_of_range/);
  });

  it("answer value 0 (below valid 1–5) returns answer_out_of_range", () => {
    const r = validateAssessmentAnswers({ 1: 0 }, 1);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/answer_out_of_range/);
  });

  it("answer value 6 (above valid 1–5) returns answer_out_of_range", () => {
    const r = validateAssessmentAnswers({ 1: 6 }, 1);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/answer_out_of_range/);
  });

  it("NaN as answer value returns answer_out_of_range", () => {
    const r = validateAssessmentAnswers({ 1: NaN }, 1);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/answer_out_of_range/);
  });

  it("questionCount 1 with one valid answer accepts", () => {
    const r = validateAssessmentAnswers({ 1: 3 }, 1);
    expect(r.ok).toBe(true);
  });

  it("questionCount 1 with two answers returns count mismatch", () => {
    const r = validateAssessmentAnswers({ 1: 3, 2: 4 }, 1);
    expect(r.ok).toBe(false);
    expect(r.error).toContain("answers_count_mismatch");
  });

  it("numeric keys 1..50 as object keys are accepted", () => {
    const answers: Record<number, number> = {};
    for (let i = 1; i <= 50; i++) answers[i] = 3;
    const r = validateAssessmentAnswers(answers, 50);
    expect(r.ok).toBe(true);
  });

  it("questionCount 2 with boundary values 1 and 5 accepts", () => {
    const r = validateAssessmentAnswers({ 1: 1, 2: 5 }, 2);
    expect(r.ok).toBe(true);
  });

  it("answers with string keys (e.g. '1') accepted when value valid", () => {
    const r = validateAssessmentAnswers({ "1": 3 } as unknown as Record<number, number>, 1);
    expect(r.ok).toBe(true);
  });

  it("questionCount 50 with 51 keys returns answers_count_mismatch", () => {
    const answers: Record<number, number> = {};
    for (let i = 1; i <= 51; i++) answers[i] = 3;
    const r = validateAssessmentAnswers(answers, 50);
    expect(r.ok).toBe(false);
    expect(r.error).toContain("answers_count_mismatch");
  });

  it("questionCount negative yields answers_count_mismatch", () => {
    const r = validateAssessmentAnswers({ 1: 3 }, -1);
    expect(r.ok).toBe(false);
    expect(r.error).toContain("answers_count_mismatch");
  });

  it("questionCount NaN yields answers_count_mismatch", () => {
    const r = validateAssessmentAnswers({ 1: 3 }, NaN);
    expect(r.ok).toBe(false);
    expect(r.error).toContain("answers_count_mismatch");
  });

  it("questionCount Infinity with one key yields answers_count_mismatch", () => {
    const r = validateAssessmentAnswers({ 1: 3 }, Infinity);
    expect(r.ok).toBe(false);
    expect(r.error).toContain("answers_count_mismatch");
  });
});

describe("AssessmentSubmission / AssessmentHistory (edges)", () => {
  it("AssessmentSubmission allows empty scores and single recommendedTrack", () => {
    const s: AssessmentSubmission = {
      userId: "u1",
      answersById: {},
      scores: {},
      pattern: "pattern",
      recommendedTrack: "Track",
    };
    expect(s.recommendedTrack).toBe("Track");
  });

  it("AssessmentHistory allows empty scores", () => {
    const h: AssessmentHistory = {
      id: "h1",
      scores: {},
      pattern: "p",
      track: "t",
      createdAt: "2026-03-10T00:00:00Z",
    };
    expect(h.id).toBe("h1");
    expect(h.scores).toEqual({});
  });
});
