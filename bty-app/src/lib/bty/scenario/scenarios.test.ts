import { describe, it, expect } from "vitest";
import { SCENARIOS } from "./scenarios";

describe("scenarios", () => {
  describe("SCENARIOS", () => {
    it("is a non-empty array", () => {
      expect(Array.isArray(SCENARIOS)).toBe(true);
      expect(SCENARIOS.length).toBeGreaterThan(0);
    });

    it("each scenario has scenarioId, title, context, choices", () => {
      for (const s of SCENARIOS) {
        expect(typeof s.scenarioId).toBe("string");
        expect(s.scenarioId.length).toBeGreaterThan(0);
        expect(typeof s.title).toBe("string");
        expect(typeof s.context).toBe("string");
        expect(Array.isArray(s.choices)).toBe(true);
        expect(s.choices.length).toBeGreaterThan(0);
      }
    });

    it("each choice has choiceId, label, intent, xpBase, difficulty, result, microInsight", () => {
      for (const s of SCENARIOS) {
        for (const c of s.choices) {
          expect(["A", "B", "C", "D"]).toContain(c.choiceId);
          expect(typeof c.label).toBe("string");
          expect(typeof c.intent).toBe("string");
          expect(Number.isFinite(c.xpBase)).toBe(true);
          expect(Number.isFinite(c.difficulty)).toBe(true);
          expect(typeof c.result).toBe("string");
          expect(typeof c.microInsight).toBe("string");
          expect(c.hiddenDelta).toBeDefined();
          expect(typeof c.hiddenDelta).toBe("object");
        }
      }
    });

    it("scenarioIds are unique", () => {
      const ids = SCENARIOS.map((s) => s.scenarioId);
      const set = new Set(ids);
      expect(set.size).toBe(ids.length);
    });

    it("first scenario has Korean fields (titleKo, contextKo) for locale support", () => {
      const first = SCENARIOS[0];
      expect(first.titleKo).toBeDefined();
      expect(first.contextKo).toBeDefined();
      expect(typeof first.titleKo).toBe("string");
      expect(typeof first.contextKo).toBe("string");
      const firstChoice = first.choices[0];
      expect(firstChoice.labelKo).toBeDefined();
      expect(firstChoice.resultKo).toBeDefined();
      expect(firstChoice.microInsightKo).toBeDefined();
    });
  });
});
