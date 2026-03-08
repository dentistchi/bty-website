/**
 * beginnerTypes — computeBeginnerMaturityScore, getMaturityFeedback, MATURITY_BANDS, BEGINNER_SCORING 단위 테스트.
 */
import { describe, it, expect } from "vitest";
import {
  computeBeginnerMaturityScore,
  getMaturityFeedback,
  MATURITY_BANDS,
  BEGINNER_SCORING,
  type BeginnerRunResponses,
} from "./beginnerTypes";

describe("beginnerTypes", () => {
  describe("MATURITY_BANDS", () => {
    it("defines reactive, aware, intentional bands with min/max", () => {
      expect(MATURITY_BANDS.reactive.min).toBe(0);
      expect(MATURITY_BANDS.reactive.max).toBe(8);
      expect(MATURITY_BANDS.aware.min).toBe(9);
      expect(MATURITY_BANDS.aware.max).toBe(14);
      expect(MATURITY_BANDS.intentional.min).toBe(15);
      expect(MATURITY_BANDS.intentional.max).toBe(20);
    });
  });

  describe("BEGINNER_SCORING", () => {
    it("risk returns [0, 3] for length 2 and [0, 1, 3] for length 3", () => {
      expect(BEGINNER_SCORING.risk(2)).toEqual([0, 3]);
      expect(BEGINNER_SCORING.risk(3)).toEqual([0, 1, 3]);
    });
  });

  describe("computeBeginnerMaturityScore", () => {
    it("sums emotion, risk, integrity, decision, and reflection points", () => {
      const r: BeginnerRunResponses = {
        emotionIndex: 3,
        riskIndex: 1,
        integrityIndex: 1,
        decisionIndex: 2,
        reflectionText: "yes",
      };
      expect(computeBeginnerMaturityScore(r, 2)).toBe(4 + 3 + 5 + 5 + 3);
    });

    it("returns 0 for all-zero indices and no reflection", () => {
      const r: BeginnerRunResponses = {
        emotionIndex: 0,
        riskIndex: 0,
        integrityIndex: 0,
        decisionIndex: 0,
        reflectionText: null,
      };
      expect(computeBeginnerMaturityScore(r, 2)).toBe(0);
    });

    it("uses riskOptionsLength 3 for risk scoring", () => {
      const r: BeginnerRunResponses = {
        emotionIndex: 0,
        riskIndex: 2,
        integrityIndex: 0,
        decisionIndex: 0,
        reflectionText: null,
      };
      expect(computeBeginnerMaturityScore(r, 3)).toBe(3);
    });
  });

  describe("getMaturityFeedback", () => {
    it("returns reactive band for score < 9", () => {
      const f = getMaturityFeedback(5);
      expect(f.band).toBe("reactive");
      expect(f.label).toBe("Reactive");
    });

    it("returns aware band for score 9–14", () => {
      const f = getMaturityFeedback(12);
      expect(f.band).toBe("aware");
      expect(f.label).toBe("Aware");
    });

    it("returns intentional band for score >= 15", () => {
      const f = getMaturityFeedback(18);
      expect(f.band).toBe("intentional");
      expect(f.label).toBe("Intentional");
    });

    it("returns KO labels when locale is ko", () => {
      const f = getMaturityFeedback(5, "ko");
      expect(f.label).toBe("반응형");
    });
  });
});
