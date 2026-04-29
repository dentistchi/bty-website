/**
 * beginnerScenarios — getBeginnerScenarioById, pickRandomBeginnerScenario 단위 테스트.
 */
import { describe, it, expect } from "vitest";
import {
  getBeginnerScenarioById,
  pickRandomBeginnerScenario,
  BEGINNER_SCENARIOS,
} from "./beginnerScenarios";

describe("beginnerScenarios", () => {
  describe("getBeginnerScenarioById", () => {
    it("returns scenario when id exists", () => {
      const id = BEGINNER_SCENARIOS[0].scenarioId;
      const s = getBeginnerScenarioById(id);
      expect(s).toBeDefined();
      expect(s?.scenarioId).toBe(id);
      expect(s?.title).toBeDefined();
      expect(s?.context).toBeDefined();
      expect(s?.emotionOptions).toHaveLength(4);
      expect(s?.riskOptions).toBeDefined();
      expect(s?.integrityOptions).toHaveLength(2);
      expect(s?.decisionOptions).toHaveLength(3);
    });

    it("returns undefined for unknown id", () => {
      expect(getBeginnerScenarioById("nonexistent_999")).toBeUndefined();
    });

    it("returns undefined for empty string", () => {
      expect(getBeginnerScenarioById("")).toBeUndefined();
    });
  });

  describe("pickRandomBeginnerScenario", () => {
    it("returns a scenario from BEGINNER_SCENARIOS", () => {
      const s = pickRandomBeginnerScenario();
      expect(s).toBeDefined();
      expect(BEGINNER_SCENARIOS.some((x) => x.scenarioId === s.scenarioId)).toBe(true);
    });

    it("when excludeId is set, returns a scenario other than excluded (when pool has items)", () => {
      const excluded = BEGINNER_SCENARIOS[0].scenarioId;
      const s = pickRandomBeginnerScenario(excluded);
      expect(s.scenarioId).not.toBe(excluded);
      expect(BEGINNER_SCENARIOS.some((x) => x.scenarioId === s.scenarioId)).toBe(true);
    });
  });
});
