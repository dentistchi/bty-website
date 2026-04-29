/**
 * Center assessment 도메인 단위 테스트.
 * validateAssessmentAnswers, AssessmentSubmission, AssessmentHistory shape 검증.
 */
import { describe, it, expect } from "vitest";
import {
  validateAssessmentAnswers,
  type AssessmentSubmission,
  type AssessmentHistory,
} from "./assessment";

function makeAnswers(count: number, value = 3): Record<number, number> {
  const out: Record<number, number> = {};
  for (let i = 1; i <= count; i++) out[i] = value;
  return out;
}

describe("center/assessment", () => {
  describe("validateAssessmentAnswers", () => {
    it("accepts valid 50-answer set", () => {
      const r = validateAssessmentAnswers(makeAnswers(50), 50);
      expect(r.ok).toBe(true);
      expect(r.error).toBeUndefined();
    });

    it("accepts valid 10-answer set", () => {
      const r = validateAssessmentAnswers(makeAnswers(10), 10);
      expect(r.ok).toBe(true);
    });

    it("rejects empty object", () => {
      const r = validateAssessmentAnswers({}, 50);
      expect(r.ok).toBe(false);
      expect(r.error).toBe("answers_empty");
    });

    it("rejects null/undefined input", () => {
      const r = validateAssessmentAnswers(null as unknown as Record<number, number>, 50);
      expect(r.ok).toBe(false);
      expect(r.error).toBe("answers_empty");
    });

    it("rejects count mismatch (too few)", () => {
      const r = validateAssessmentAnswers(makeAnswers(49), 50);
      expect(r.ok).toBe(false);
      expect(r.error).toContain("answers_count_mismatch");
    });

    it("rejects count mismatch (too many)", () => {
      const r = validateAssessmentAnswers(makeAnswers(51), 50);
      expect(r.ok).toBe(false);
      expect(r.error).toContain("answers_count_mismatch");
    });

    it("rejects answer value 0 (below range)", () => {
      const a = makeAnswers(50);
      a[1] = 0;
      const r = validateAssessmentAnswers(a, 50);
      expect(r.ok).toBe(false);
      expect(r.error).toContain("answer_out_of_range");
    });

    it("rejects answer value 6 (above range)", () => {
      const a = makeAnswers(50);
      a[25] = 6;
      const r = validateAssessmentAnswers(a, 50);
      expect(r.ok).toBe(false);
      expect(r.error).toContain("answer_out_of_range");
    });

    it("rejects non-integer answer", () => {
      const a = makeAnswers(50);
      a[10] = 2.5;
      const r = validateAssessmentAnswers(a, 50);
      expect(r.ok).toBe(false);
      expect(r.error).toContain("answer_out_of_range");
    });

    it("accepts boundary values 1 and 5", () => {
      const a = makeAnswers(50);
      a[1] = 1;
      a[50] = 5;
      const r = validateAssessmentAnswers(a, 50);
      expect(r.ok).toBe(true);
    });

    it("rejects string value in answers", () => {
      const a = makeAnswers(50);
      (a as Record<number, unknown>)[10] = "3";
      const r = validateAssessmentAnswers(a as Record<number, number>, 50);
      expect(r.ok).toBe(false);
      expect(r.error).toContain("answer_out_of_range");
    });
  });

  describe("AssessmentSubmission type", () => {
    it("has required fields", () => {
      const s: AssessmentSubmission = {
        userId: "u1",
        answersById: { 1: 3, 2: 4 },
        scores: { core: 50, compassion: 60 },
        pattern: "balanced",
        recommendedTrack: "Core Confidence",
      };
      expect(s.userId).toBe("u1");
      expect(s.pattern).toBe("balanced");
      expect(s.recommendedTrack).toBe("Core Confidence");
    });
  });

  describe("AssessmentHistory type", () => {
    it("has id, scores, pattern, track, createdAt", () => {
      const h: AssessmentHistory = {
        id: "a1",
        scores: { core: 80 },
        pattern: "perfectionism",
        track: "Self-Compassion First",
        createdAt: "2026-03-09T00:00:00Z",
      };
      expect(h.id).toBe("a1");
      expect(h.pattern).toBe("perfectionism");
      expect(h.createdAt).toBe("2026-03-09T00:00:00Z");
    });
  });
});
