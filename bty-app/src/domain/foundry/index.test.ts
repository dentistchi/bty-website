/**
 * Foundry domain re-export hub — 심볼 존재 검증.
 * 기존 dojo·leadership-engine 도메인이 re-export 되는지 확인.
 */
import { describe, it, expect } from "vitest";
import * as foundry from "./index";

describe("domain/foundry re-export hub", () => {
  describe("dojo/flow re-exports", () => {
    it("exports DOJO_50_AREAS", () => {
      expect(foundry.DOJO_50_AREAS).toBeDefined();
      expect(Array.isArray(foundry.DOJO_50_AREAS)).toBe(true);
      expect(foundry.DOJO_50_AREAS.length).toBe(5);
    });

    it("exports canEnterDojo", () => {
      expect(typeof foundry.canEnterDojo).toBe("function");
    });

    it("canEnterDojo returns true when authenticated, false otherwise", () => {
      expect(foundry.canEnterDojo(true)).toBe(true);
      expect(foundry.canEnterDojo(false)).toBe(false);
    });

    it("exports validateDojo50Submit", () => {
      expect(typeof foundry.validateDojo50Submit).toBe("function");
    });

    it("validateDojo50Submit returns ok for 50 valid answers, error for count or range", () => {
      const valid50: Record<number, number> = {};
      for (let q = 1; q <= 50; q++) valid50[q] = 3;
      expect(foundry.validateDojo50Submit(valid50)).toEqual({ ok: true });
      const badCount: Record<number, number> = {};
      for (let q = 1; q <= 49; q++) badCount[q] = 3;
      expect(foundry.validateDojo50Submit(badCount)).toEqual({ ok: false, error: "answers_count" });
      const badRange = { ...valid50, 1: 0 };
      expect(foundry.validateDojo50Submit(badRange)).toEqual({ ok: false, error: "invalid_range" });
    });

    it("exports computeDojo50Result", () => {
      expect(typeof foundry.computeDojo50Result).toBe("function");
    });

    it("exports validateIntegritySubmit", () => {
      expect(typeof foundry.validateIntegritySubmit).toBe("function");
    });

    it("validateIntegritySubmit returns ok when text or choiceId present (Foundry 3차)", () => {
      expect(foundry.validateIntegritySubmit({ text: "hello" })).toEqual({ ok: true });
      expect(foundry.validateIntegritySubmit({ choiceId: "choice-1" })).toEqual({ ok: true });
      expect(foundry.validateIntegritySubmit({ text: "", choiceId: "x" })).toEqual({ ok: true });
      expect(foundry.validateIntegritySubmit({})).toEqual({ ok: false, error: "missing_input" });
      expect(foundry.validateIntegritySubmit({ text: null, choiceId: null })).toEqual({ ok: false, error: "missing_input" });
    });
  });

  describe("dojo/questions re-exports", () => {
    it("exports DOJO_LIKERT_5_VALUES", () => {
      expect(foundry.DOJO_LIKERT_5_VALUES).toBeDefined();
      expect(foundry.DOJO_LIKERT_5_VALUES).toEqual([1, 2, 3, 4, 5]);
    });

    it("exports mapDojoQuestionRow", () => {
      expect(typeof foundry.mapDojoQuestionRow).toBe("function");
    });
  });

  describe("leadership-engine re-exports", () => {
    it("exports STAGES", () => {
      expect(foundry.STAGES).toBeDefined();
      expect(foundry.STAGES).toEqual([1, 2, 3, 4]);
    });

    it("exports STAGE_NAMES", () => {
      expect(foundry.STAGE_NAMES).toBeDefined();
      expect(typeof foundry.STAGE_NAMES[1]).toBe("string");
    });

    it("exports getNextStage", () => {
      expect(typeof foundry.getNextStage).toBe("function");
    });

    it("getNextStage returns next stage for valid context, null otherwise", () => {
      expect(foundry.getNextStage(1, "repeat_1_without_delegation")).toBe(2);
      expect(foundry.getNextStage(2, "repeat_2_without_corrective_activation")).toBe(3);
      expect(foundry.getNextStage(3, "air_below_threshold")).toBe(4);
      expect(foundry.getNextStage(4, "stage_4_completion")).toBe(1);
      expect(foundry.getNextStage(1, "air_below_threshold")).toBe(null);
      expect(foundry.getNextStage(4, "repeat_1_without_delegation")).toBe(null);
    });
  });
});
