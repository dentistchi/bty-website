import { describe, it, expect } from "vitest";
import {
  getNextStage,
  STAGE_1,
  STAGE_2,
  STAGE_3,
  STAGE_4,
  type StageTransitionContext,
} from "./stages";

describe("getNextStage", () => {
  it("Stage 1 + repeat_1_without_delegation → 2", () => {
    expect(getNextStage(STAGE_1, "repeat_1_without_delegation")).toBe(STAGE_2);
  });

  it("Stage 1 + other contexts → null", () => {
    const others: StageTransitionContext[] = [
      "repeat_2_without_corrective_activation",
      "air_below_threshold",
      "stage_4_completion",
    ];
    for (const ctx of others) {
      expect(getNextStage(STAGE_1, ctx)).toBeNull();
    }
  });

  it("Stage 2 + repeat_2_without_corrective_activation → 3", () => {
    expect(getNextStage(STAGE_2, "repeat_2_without_corrective_activation")).toBe(STAGE_3);
  });

  it("Stage 2 + other contexts → null", () => {
    const others: StageTransitionContext[] = [
      "repeat_1_without_delegation",
      "air_below_threshold",
      "stage_4_completion",
    ];
    for (const ctx of others) {
      expect(getNextStage(STAGE_2, ctx)).toBeNull();
    }
  });

  it("Stage 3 + air_below_threshold → 4", () => {
    expect(getNextStage(STAGE_3, "air_below_threshold")).toBe(STAGE_4);
  });

  it("Stage 3 + other contexts → null", () => {
    const others: StageTransitionContext[] = [
      "repeat_1_without_delegation",
      "repeat_2_without_corrective_activation",
      "stage_4_completion",
    ];
    for (const ctx of others) {
      expect(getNextStage(STAGE_3, ctx)).toBeNull();
    }
  });

  it("Stage 4 + stage_4_completion → 1", () => {
    expect(getNextStage(STAGE_4, "stage_4_completion")).toBe(STAGE_1);
  });

  it("Stage 4 + other contexts → null", () => {
    const others: StageTransitionContext[] = [
      "repeat_1_without_delegation",
      "repeat_2_without_corrective_activation",
      "air_below_threshold",
    ];
    for (const ctx of others) {
      expect(getNextStage(STAGE_4, ctx)).toBeNull();
    }
  });
});
