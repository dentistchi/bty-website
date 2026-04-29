/**
 * Foundry domain re-export hub — 경계 테스트.
 * index.test.ts와 중복 없이 미커버 경계만 (STAGES/STAGE_NAMES, getNextStage null 경계, validateIntegritySubmit trim).
 */
import { describe, it, expect } from "vitest";
import * as foundry from "./index";

describe("domain/foundry re-export hub (edges)", () => {
  describe("STAGES / STAGE_NAMES boundary", () => {
    it("STAGES has length 4 and STAGE_NAMES has keys 1..4", () => {
      expect(foundry.STAGES).toHaveLength(4);
      expect(foundry.STAGES[0]).toBe(1);
      expect(foundry.STAGES[3]).toBe(4);
      expect(foundry.STAGE_NAMES[1]).toBeDefined();
      expect(foundry.STAGE_NAMES[4]).toBeDefined();
    });
  });

  describe("DOJO_50_AREAS boundary", () => {
    it("DOJO_50_AREAS has length 5 and first/last area ids", () => {
      expect(foundry.DOJO_50_AREAS).toHaveLength(5);
      expect(foundry.DOJO_50_AREAS[0]).toBe("perspective_taking");
      expect(foundry.DOJO_50_AREAS[4]).toBe("teamwork");
    });
  });

  describe("getNextStage", () => {
    it("stage 1 with repeat_1_without_delegation returns 2", () => {
      expect(foundry.getNextStage(1, "repeat_1_without_delegation")).toBe(2);
    });
    it("stage 1 with stage_4_completion returns null", () => {
      expect(foundry.getNextStage(1, "stage_4_completion")).toBe(null);
    });
    it("stage 4 with repeat_1_without_delegation returns null", () => {
      expect(foundry.getNextStage(4, "repeat_1_without_delegation")).toBe(null);
    });
  });

  describe("leadership-engine re-export constants (boundary)", () => {
    it("LRI_READINESS_THRESHOLD and CERTIFIED_AIR_14D_MIN are re-exported with expected values", () => {
      expect(foundry.LRI_READINESS_THRESHOLD).toBe(0.8);
      expect(foundry.CERTIFIED_AIR_14D_MIN).toBe(0.8);
    });
    it("FORCED_RESET_STAGE3_COUNT_THRESHOLD and FORCED_RESET_DELAY_HOURS are re-exported", () => {
      expect(foundry.FORCED_RESET_STAGE3_COUNT_THRESHOLD).toBe(2);
      expect(foundry.FORCED_RESET_DELAY_HOURS).toBe(48);
    });
  });

  describe("validateIntegritySubmit edges", () => {
    it("whitespace-only text returns missing_input", () => {
      expect(foundry.validateIntegritySubmit({ text: "   ", choiceId: undefined })).toEqual({
        ok: false,
        error: "missing_input",
      });
      expect(foundry.validateIntegritySubmit({ text: "\t\n", choiceId: null })).toEqual({
        ok: false,
        error: "missing_input",
      });
    });

    it("choiceId only (no text) returns ok", () => {
      expect(foundry.validateIntegritySubmit({ choiceId: "choice-1" })).toEqual({ ok: true });
    });

    it("text only (no choiceId) returns ok", () => {
      expect(foundry.validateIntegritySubmit({ text: "hello" })).toEqual({ ok: true });
    });

    it("empty object returns missing_input", () => {
      expect(foundry.validateIntegritySubmit({})).toEqual({
        ok: false,
        error: "missing_input",
      });
    });

    it("text and choiceId both set returns ok", () => {
      expect(foundry.validateIntegritySubmit({ text: "reflection", choiceId: "c1" })).toEqual({
        ok: true,
      });
    });
  });
});
