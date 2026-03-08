/**
 * scenario/engine — getContextForUser, getScenarioById 단위 테스트.
 */
import { describe, it, expect } from "vitest";
import { getContextForUser, getScenarioById } from "./engine";

describe("scenario/engine", () => {
  describe("getContextForUser", () => {
    it("returns trimmed context when no meta phrase", () => {
      const ctx = "A patient refuses treatment. You feel concern.";
      expect(getContextForUser(ctx)).toBe(ctx);
    });

    it("strips text after 'The hidden risk'", () => {
      const ctx = "Stress at work. The hidden risk is blaming others.";
      expect(getContextForUser(ctx)).toBe("Stress at work.");
    });

    it("strips text after 'The integrity trigger'", () => {
      const ctx = "A conflict. The integrity trigger: stay calm or react.";
      expect(getContextForUser(ctx)).toBe("A conflict.");
    });

    it("filters out sentences containing meta phrases", () => {
      const ctx = "First sentence. Growth opportunity is learning. Second sentence.";
      const out = getContextForUser(ctx);
      expect(out).not.toContain("Growth opportunity");
      expect(out).toContain("First sentence");
      expect(out).toContain("Second sentence");
    });

    it("returns empty string as-is when only meta content", () => {
      const ctx = "  ";
      expect(getContextForUser(ctx)).toBe("");
    });
  });

  describe("getScenarioById", () => {
    it("returns scenario when id exists", () => {
      const s = getScenarioById("patient_refuses_treatment_001");
      expect(s).toBeDefined();
      expect(s?.scenarioId).toBe("patient_refuses_treatment_001");
      expect(s?.title).toBeDefined();
      expect(s?.choices?.length).toBeGreaterThan(0);
    });

    it("returns undefined for unknown id", () => {
      expect(getScenarioById("nonexistent_999")).toBeUndefined();
    });
  });
});
