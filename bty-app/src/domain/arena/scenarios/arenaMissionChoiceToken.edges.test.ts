import { describe, it, expect } from "vitest";
import {
  isArenaPrimaryMissionChoiceId,
  isArenaReinforcementMissionChoiceId,
} from "./arenaMissionChoiceToken";

describe("arenaMissionChoiceToken (edges)", () => {
  describe("isArenaPrimaryMissionChoiceId", () => {
    it("accepts A, B, C with optional surrounding whitespace", () => {
      expect(isArenaPrimaryMissionChoiceId("A")).toBe(true);
      expect(isArenaPrimaryMissionChoiceId(" B ")).toBe(true);
      expect(isArenaPrimaryMissionChoiceId("C")).toBe(true);
    });

    it("rejects lowercase, other letters, empty", () => {
      expect(isArenaPrimaryMissionChoiceId("a")).toBe(false);
      expect(isArenaPrimaryMissionChoiceId("D")).toBe(false);
      expect(isArenaPrimaryMissionChoiceId("")).toBe(false);
      expect(isArenaPrimaryMissionChoiceId("   ")).toBe(false);
    });

    it("rejects non-strings", () => {
      expect(isArenaPrimaryMissionChoiceId(null)).toBe(false);
      expect(isArenaPrimaryMissionChoiceId(1)).toBe(false);
    });
  });

  describe("isArenaReinforcementMissionChoiceId", () => {
    it("accepts X, Y (trimmed)", () => {
      expect(isArenaReinforcementMissionChoiceId("X")).toBe(true);
      expect(isArenaReinforcementMissionChoiceId(" Y")).toBe(true);
    });

    it("rejects lowercase and Z", () => {
      expect(isArenaReinforcementMissionChoiceId("x")).toBe(false);
      expect(isArenaReinforcementMissionChoiceId("Z")).toBe(false);
    });
  });
});
