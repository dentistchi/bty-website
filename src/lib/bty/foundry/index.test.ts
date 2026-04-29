/**
 * Foundry service re-export hub — 심볼 존재 검증.
 * mentor·scenario·leadership-engine service가 re-export 되는지 확인.
 */
import { describe, it, expect } from "vitest";
import * as foundry from "./index";

describe("lib/bty/foundry re-export hub", () => {
  describe("scenario re-exports", () => {
    it("exports getScenarioById", () => {
      expect(typeof foundry.getScenarioById).toBe("function");
    });

    it("getScenarioById returns scenario when id exists", () => {
      const s = foundry.getScenarioById("patient_refuses_treatment_001");
      expect(s).toBeDefined();
      expect(s?.scenarioId).toBe("patient_refuses_treatment_001");
    });

    it("getRandomScenario returns a scenario with scenarioId (Foundry 4차)", () => {
      const s = foundry.getRandomScenario();
      expect(s).toBeDefined();
      expect(typeof s.scenarioId).toBe("string");
      expect(s.scenarioId.length).toBeGreaterThan(0);
    });

    it("exports getRandomScenario", () => {
      expect(typeof foundry.getRandomScenario).toBe("function");
    });

    it("exports computeResult", () => {
      expect(typeof foundry.computeResult).toBe("function");
    });

    it("exports SCENARIOS array", () => {
      expect(Array.isArray(foundry.SCENARIOS)).toBe(true);
      expect(foundry.SCENARIOS.length).toBeGreaterThan(0);
    });

    it("exports BEGINNER_SCENARIOS array", () => {
      expect(Array.isArray(foundry.BEGINNER_SCENARIOS)).toBe(true);
    });

    it("exports computeBeginnerMaturityScore", () => {
      expect(typeof foundry.computeBeginnerMaturityScore).toBe("function");
    });

    it("exports MATURITY_BANDS", () => {
      expect(foundry.MATURITY_BANDS).toBeDefined();
    });
  });

  describe("mentor re-exports", () => {
    it("exports DR_CHI_PHILOSOPHY", () => {
      expect(typeof foundry.DR_CHI_PHILOSOPHY).toBe("string");
      expect(foundry.DR_CHI_PHILOSOPHY.length).toBeGreaterThan(0);
    });

    it("exports routeByWeightedRules", () => {
      expect(typeof foundry.routeByWeightedRules).toBe("function");
    });

    it("exports buildMentorMessagesDual", () => {
      expect(typeof foundry.buildMentorMessagesDual).toBe("function");
    });

    it("exports inferLang", () => {
      expect(typeof foundry.inferLang).toBe("function");
    });
  });

  describe("leadership-engine service re-exports", () => {
    it("exports getLeadershipEngineState", () => {
      expect(typeof foundry.getLeadershipEngineState).toBe("function");
    });

    it("exports getCertifiedStatus", () => {
      expect(typeof foundry.getCertifiedStatus).toBe("function");
    });

    it("exports compute_team_tii", () => {
      expect(typeof foundry.compute_team_tii).toBe("function");
    });

    it("exports getTeamIds", () => {
      expect(typeof foundry.getTeamIds).toBe("function");
    });
  });

  describe("dojo submit service re-exports", () => {
    it("exports submitDojo50", () => {
      expect(typeof foundry.submitDojo50).toBe("function");
    });
  });

  describe("integrity submit service re-exports", () => {
    it("exports submitIntegrity", () => {
      expect(typeof foundry.submitIntegrity).toBe("function");
    });
  });
});
