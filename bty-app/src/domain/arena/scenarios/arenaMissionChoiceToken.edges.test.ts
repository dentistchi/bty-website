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

    it("rejects ZWSP inside token (trim does not strip U+200B); NBSP padding still trims to valid letter", () => {
      expect(isArenaPrimaryMissionChoiceId("A\u200b")).toBe(false);
      expect(isArenaPrimaryMissionChoiceId("\u200bA")).toBe(false);
      expect(isArenaPrimaryMissionChoiceId("\u00a0A\u00a0")).toBe(true);
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

    it("rejects ZWSP inside token; NBSP padding trims to valid letter", () => {
      expect(isArenaReinforcementMissionChoiceId("X\u200b")).toBe(false);
      expect(isArenaReinforcementMissionChoiceId("\u200bY")).toBe(false);
      expect(isArenaReinforcementMissionChoiceId("\u00a0X\u00a0")).toBe(true);
    });
  });
});
