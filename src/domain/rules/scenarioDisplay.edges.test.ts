/**
 * 시나리오 표시 키 — 경계 (SPRINT 51 TASK 8 / 257 C3). 랭킹·XP 무관.
 */
import { describe, it, expect } from "vitest";
import {
  scenarioDifficultyDisplayKey,
  scenarioDurationBandDisplayKey,
  isValidArenaScenarioCodeId,
} from "./scenarioDisplay";

describe("scenarioDisplay edges (257)", () => {
  it("scenarioDurationBandDisplayKey: negative minutes clamp to 0 → short", () => {
    expect(scenarioDurationBandDisplayKey(-5)).toBe("scenario_duration_short");
  });

  it("scenarioDurationBandDisplayKey: very large minutes → long", () => {
    expect(scenarioDurationBandDisplayKey(1e6)).toBe("scenario_duration_long");
  });

  it("scenarioDifficultyDisplayKey trims and maps aliases", () => {
    expect(scenarioDifficultyDisplayKey("  low  ")).toBe("scenario_difficulty_easy");
    expect(scenarioDifficultyDisplayKey("HIGH")).toBe("scenario_difficulty_hard");
  });

  it("isValidArenaScenarioCodeId: single lowercase letter ok; uppercase start rejected", () => {
    expect(isValidArenaScenarioCodeId("a")).toBe(true);
    expect(isValidArenaScenarioCodeId("Ab")).toBe(false);
  });
});
