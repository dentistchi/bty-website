import { describe, it, expect } from "vitest";
import {
  scenarioDifficultyDisplayKey,
  scenarioDurationBandDisplayKey,
  isValidArenaScenarioCodeId,
} from "./scenarioDisplay";

describe("scenarioDisplay", () => {
  describe("isValidArenaScenarioCodeId (251)", () => {
    it("accepts snake_case arena-style ids", () => {
      expect(isValidArenaScenarioCodeId("patient_refuses_treatment_001")).toBe(true);
      expect(isValidArenaScenarioCodeId("s1")).toBe(true);
      expect(isValidArenaScenarioCodeId("integrity_001")).toBe(true);
    });
    it("rejects empty, spaces, path-like, uppercase start, too long", () => {
      expect(isValidArenaScenarioCodeId("")).toBe(false);
      expect(isValidArenaScenarioCodeId("  ")).toBe(false);
      expect(isValidArenaScenarioCodeId("../x")).toBe(false);
      expect(isValidArenaScenarioCodeId("1abc")).toBe(false);
      expect(isValidArenaScenarioCodeId("Bad_id")).toBe(false);
      expect(isValidArenaScenarioCodeId("a" + "x".repeat(200))).toBe(false);
    });
  });
  it("scenarioDifficultyDisplayKey", () => {
    expect(scenarioDifficultyDisplayKey("Easy")).toBe("scenario_difficulty_easy");
    expect(scenarioDifficultyDisplayKey("ADVANCED")).toBe("scenario_difficulty_hard");
    expect(scenarioDifficultyDisplayKey(null)).toBe("scenario_difficulty_medium");
  });

  it("scenarioDurationBandDisplayKey", () => {
    expect(scenarioDurationBandDisplayKey(3)).toBe("scenario_duration_short");
    expect(scenarioDurationBandDisplayKey(10)).toBe("scenario_duration_medium");
    expect(scenarioDurationBandDisplayKey(45)).toBe("scenario_duration_long");
  });
});
