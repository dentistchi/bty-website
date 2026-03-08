/**
 * Unit tests for Dr. Chi character config (PHASE_4, DR_CHI_VOICE_TRAINING).
 * Tests exported constants only; no business/XP logic.
 */
import { describe, it, expect } from "vitest";
import { DR_CHI_PHILOSOPHY, DR_CHI_FEW_SHOT_EXAMPLES } from "./drChiCharacter";

describe("drChiCharacter", () => {
  describe("DR_CHI_PHILOSOPHY", () => {
    it("is a non-empty string", () => {
      expect(typeof DR_CHI_PHILOSOPHY).toBe("string");
      expect(DR_CHI_PHILOSOPHY.length).toBeGreaterThan(0);
    });

    it("contains Dr. Chi identity and voice guidance", () => {
      expect(DR_CHI_PHILOSOPHY).toContain("Dr. Chi");
      expect(DR_CHI_PHILOSOPHY.length).toBeGreaterThan(50);
    });
  });

  describe("DR_CHI_FEW_SHOT_EXAMPLES", () => {
    it("is an array with between 1 and 8 items", () => {
      expect(Array.isArray(DR_CHI_FEW_SHOT_EXAMPLES)).toBe(true);
      expect(DR_CHI_FEW_SHOT_EXAMPLES.length).toBeGreaterThanOrEqual(1);
      expect(DR_CHI_FEW_SHOT_EXAMPLES.length).toBeLessThanOrEqual(8);
    });

    it("each item has user and assistant string fields", () => {
      for (const ex of DR_CHI_FEW_SHOT_EXAMPLES) {
        expect(ex).toHaveProperty("user");
        expect(ex).toHaveProperty("assistant");
        expect(typeof ex.user).toBe("string");
        expect(typeof ex.assistant).toBe("string");
        expect(ex.user.length).toBeGreaterThan(0);
        expect(ex.assistant.length).toBeGreaterThan(0);
      }
    });

    it("assistant replies are non-trivial (multiple words or question)", () => {
      for (const ex of DR_CHI_FEW_SHOT_EXAMPLES) {
        const trimmed = ex.assistant.trim();
        const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
        const hasQuestion = /\?/.test(trimmed);
        expect(wordCount >= 2 || hasQuestion).toBe(true);
      }
    });
  });
});
