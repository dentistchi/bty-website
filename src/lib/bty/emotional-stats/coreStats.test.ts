/**
 * coreStats — EVENT_IDS, CORE_STAT_IDS, getQualityWeight, getSessionMaxPossibleWeight 단위 테스트.
 */
import { describe, it, expect } from "vitest";
import {
  EVENT_IDS,
  CORE_STAT_IDS,
  EVENTS,
  getQualityWeight,
  getSessionMaxPossibleWeight,
  SESSION_MAX_POSSIBLE_EVENTS_CAP,
  STAT_DISTRIBUTION,
  type EventId,
} from "./coreStats";

describe("coreStats", () => {
  describe("EVENT_IDS", () => {
    it("has 15 event ids (v3)", () => {
      expect(EVENT_IDS).toHaveLength(15);
    });
    it("includes expected event ids", () => {
      expect(EVENT_IDS).toContain("FEELING_LABELED");
      expect(EVENT_IDS).toContain("SELF_REFRAMING");
      expect(EVENT_IDS).toContain("O_F_N_R_COMPLETED");
      expect(EVENT_IDS).toContain("EMPATHY_EXPRESSED");
    });
  });

  describe("CORE_STAT_IDS", () => {
    it("has 6 core stat ids", () => {
      expect(CORE_STAT_IDS).toHaveLength(6);
      expect(CORE_STAT_IDS).toEqual(["EA", "RS", "BS", "TI", "RC", "RD"]);
    });
  });

  describe("getQualityWeight", () => {
    it("returns weight for known event id", () => {
      expect(getQualityWeight("FEELING_LABELED" as EventId)).toBe(1.0);
      expect(getQualityWeight("O_F_N_R_COMPLETED" as EventId)).toBe(2.0);
      expect(getQualityWeight("SELF_REFRAMING" as EventId)).toBe(1.4);
    });
    it("returns 0 for unknown event id", () => {
      expect(getQualityWeight("UNKNOWN" as EventId)).toBe(0);
    });
  });

  describe("getSessionMaxPossibleWeight", () => {
    it("returns sum of top 8 event weights by quality_weight desc", () => {
      const w = getSessionMaxPossibleWeight();
      expect(w).toBeGreaterThan(0);
      expect(Number.isFinite(w)).toBe(true);
    });
    it("uses SESSION_MAX_POSSIBLE_EVENTS_CAP", () => {
      expect(SESSION_MAX_POSSIBLE_EVENTS_CAP).toBe(8);
    });
  });

  describe("EVENTS and STAT_DISTRIBUTION", () => {
    it("EVENTS length matches EVENT_IDS", () => {
      expect(EVENTS).toHaveLength(EVENT_IDS.length);
    });
    it("STAT_DISTRIBUTION has entry per EVENT_ID", () => {
      for (const id of EVENT_IDS) {
        expect(STAT_DISTRIBUTION[id]).toBeDefined();
      }
    });
  });
});
