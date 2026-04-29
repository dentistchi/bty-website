/**
 * unlock (emotional-stats) — checkAdvancedUnlock, getUnlockedAdvancedStats 단위 테스트.
 */
import { describe, it, expect } from "vitest";
import { checkAdvancedUnlock, getUnlockedAdvancedStats, type UserCoreValues, type EventCounts } from "./unlock";

describe("emotional-stats/unlock", () => {
  describe("checkAdvancedUnlock", () => {
    it("PRM: requires TI >= 50 and PATTERN_LINKED >= 5", () => {
      expect(checkAdvancedUnlock("PRM", { TI: 50 }, { PATTERN_LINKED: 5 })).toBe(true);
      expect(checkAdvancedUnlock("PRM", { TI: 49 }, { PATTERN_LINKED: 5 })).toBe(false);
      expect(checkAdvancedUnlock("PRM", { TI: 50 }, { PATTERN_LINKED: 4 })).toBe(false);
    });

    it("SAG: requires BS >= 40, RC >= 40, CLEAR_REQUEST >= 3", () => {
      expect(checkAdvancedUnlock("SAG", { BS: 40, RC: 40 }, { CLEAR_REQUEST: 3 })).toBe(true);
      expect(checkAdvancedUnlock("SAG", { BS: 39, RC: 40 }, { CLEAR_REQUEST: 3 })).toBe(false);
      expect(checkAdvancedUnlock("SAG", { BS: 40, RC: 40 }, { CLEAR_REQUEST: 2 })).toBe(false);
    });

    it("CNS: only event counts (no core minimums)", () => {
      expect(checkAdvancedUnlock("CNS", {}, { REPAIR_ATTEMPT: 5, POST_CONFLICT_RETURN: 3 })).toBe(true);
      expect(checkAdvancedUnlock("CNS", {}, { REPAIR_ATTEMPT: 4, POST_CONFLICT_RETURN: 3 })).toBe(false);
      expect(checkAdvancedUnlock("CNS", {}, { REPAIR_ATTEMPT: 5, POST_CONFLICT_RETURN: 2 })).toBe(false);
    });

    it("CD: requires EA >= 70, SELF_REFRAMING >= 5", () => {
      expect(checkAdvancedUnlock("CD", { EA: 70 }, { SELF_REFRAMING: 5 })).toBe(true);
      expect(checkAdvancedUnlock("CD", { EA: 69 }, { SELF_REFRAMING: 5 })).toBe(false);
    });
  });

  describe("getUnlockedAdvancedStats", () => {
    it("returns empty when no conditions met", () => {
      const core: UserCoreValues = {};
      const events: EventCounts = {};
      expect(getUnlockedAdvancedStats(core, events)).toEqual([]);
    });

    it("returns only unlocked stat ids", () => {
      const core: UserCoreValues = { TI: 50 };
      const events: EventCounts = { PATTERN_LINKED: 5 };
      const result = getUnlockedAdvancedStats(core, events);
      expect(result).toContain("PRM");
      expect(result.length).toBeGreaterThanOrEqual(1);
    });

    it("CNS can unlock with events only", () => {
      const core: UserCoreValues = {};
      const events: EventCounts = { REPAIR_ATTEMPT: 5, POST_CONFLICT_RETURN: 3 };
      const result = getUnlockedAdvancedStats(core, events);
      expect(result).toContain("CNS");
    });
  });
});
