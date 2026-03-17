/**
 * leadership-engine/stages — 경계 테스트.
 * stages.test.ts와 중복 없이 미커버 경계만.
 */
import { describe, it, expect } from "vitest";
import { getNextStage, stageProgressPercent, STAGE_1, STAGE_4, STAGE_NAMES } from "./stages";

describe("stages (edges)", () => {
  it("getNextStage(4, stage_4_completion) returns 1 (cycle to stage 1)", () => {
    expect(getNextStage(STAGE_4, "stage_4_completion")).toBe(STAGE_1);
  });

  it("getNextStage(2, repeat_2_without_corrective_activation) returns 3", () => {
    expect(getNextStage(2, "repeat_2_without_corrective_activation")).toBe(3);
  });

  it("STAGE_NAMES has string for stage 4", () => {
    expect(STAGE_NAMES[4]).toBeDefined();
    expect(typeof STAGE_NAMES[4]).toBe("string");
  });

  describe("stageProgressPercent", () => {
    it("returns 25, 50, 75, 100 for stages 1–4", () => {
      expect(stageProgressPercent(1)).toBe(25);
      expect(stageProgressPercent(2)).toBe(50);
      expect(stageProgressPercent(3)).toBe(75);
      expect(stageProgressPercent(4)).toBe(100);
    });

    it("returns number in 0–100 range", () => {
      expect(stageProgressPercent(1)).toBeGreaterThanOrEqual(0);
      expect(stageProgressPercent(4)).toBeLessThanOrEqual(100);
      expect(Number.isInteger(stageProgressPercent(2))).toBe(true);
    });
  });
});
