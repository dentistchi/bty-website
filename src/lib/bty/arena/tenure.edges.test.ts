/**
 * Edge-case tests for tenure (Arena 10차).
 * TASK 2(weeklyQuest)와 다른 모듈. 기존 동작만 검증, 비즈니스/XP 로직 미변경.
 */
import { describe, it, expect } from "vitest";
import {
  isNewJoinerTenure,
  getNextLockedLevel,
  STAFF_LEVEL_ORDER,
  LEADER_LEVEL_ORDER,
} from "./tenure";

describe("tenure (edges)", () => {
  describe("isNewJoinerTenure boundary", () => {
    it("exactly at days boundary is false (>= days)", () => {
      const now = new Date("2026-03-31");
      const joined = "2026-03-01";
      expect(isNewJoinerTenure(joined, now, 30)).toBe(false);
    });
    it("one day before boundary is true", () => {
      const now = new Date("2026-03-30");
      const joined = "2026-03-01";
      expect(isNewJoinerTenure(joined, now, 30)).toBe(true);
    });
  });

  describe("STAFF_LEVEL_ORDER / LEADER_LEVEL_ORDER", () => {
    it("STAFF has length 3, LEADER has length 4", () => {
      expect(STAFF_LEVEL_ORDER).toHaveLength(3);
      expect(LEADER_LEVEL_ORDER).toHaveLength(4);
    });
    it("staff S1 next locked is S2", () => {
      expect(getNextLockedLevel("staff", "S1")).toBe("S2");
    });
    it("staff S2 next locked is S3", () => {
      expect(getNextLockedLevel("staff", "S2")).toBe("S3");
    });
    it("leader L3 next locked is L4", () => {
      expect(getNextLockedLevel("leader", "L3")).toBe("L4");
    });
    it("leader L4 next locked is null (top)", () => {
      expect(getNextLockedLevel("leader", "L4")).toBeNull();
    });
  });
});
