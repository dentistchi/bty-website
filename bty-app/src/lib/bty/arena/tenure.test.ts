/**
 * tenure — isNewJoinerTenure, getBasisDate, getTenureMonths, getMaxUnlockedLevelTenure, getNextLockedLevel 단위 테스트.
 */
import { describe, it, expect } from "vitest";
import {
  isNewJoinerTenure,
  getBasisDate,
  getTenureMonths,
  getMaxUnlockedLevelTenure,
  getNextLockedLevel,
  STAFF_LEVEL_ORDER,
  LEADER_LEVEL_ORDER,
  type UserTenureProfile,
  type TenurePolicyConfig,
} from "./tenure";

const minimalConfig: TenurePolicyConfig = {
  newJoinerRule: { enabled: false, days: 30, forcedTrack: "staff" },
  minTenureMonthsByLevel: { S1: 0, S2: 3, S3: 6, L1: 0, L2: 6, L3: 12, L4: 24 },
  tenureBasisByLevel: { S1: "joinedAt", S2: "joinedAt", S3: "joinedAt", L1: "joinedAt", L2: "joinedAt", L3: "joinedAt", L4: "leaderStartedAt" },
  leaderFallbackBasis: "joinedAt",
};

describe("tenure", () => {
  describe("isNewJoinerTenure", () => {
    it("returns true when joined within days", () => {
      const now = new Date("2026-03-10");
      const joined = "2026-03-01";
      expect(isNewJoinerTenure(joined, now, 30)).toBe(true);
    });

    it("returns false when joined more than days ago", () => {
      const now = new Date("2026-03-10");
      const joined = "2026-01-01";
      expect(isNewJoinerTenure(joined, now, 30)).toBe(false);
    });
  });

  describe("getBasisDate", () => {
    it("returns joinedAt when basis is joinedAt", () => {
      const user: UserTenureProfile = { joinedAt: "2025-01-15" };
      const d = getBasisDate(user, "joinedAt", "joinedAt");
      expect(d.toISOString().slice(0, 10)).toBe("2025-01-15");
    });

    it("returns leaderStartedAt when basis is leaderStartedAt and set", () => {
      const user: UserTenureProfile = { joinedAt: "2025-01-01", leaderStartedAt: "2025-06-01" };
      const d = getBasisDate(user, "leaderStartedAt", "joinedAt");
      expect(d.toISOString().slice(0, 10)).toBe("2025-06-01");
    });

    it("falls back to joinedAt when leaderStartedAt is null", () => {
      const user: UserTenureProfile = { joinedAt: "2025-01-15", leaderStartedAt: null };
      const d = getBasisDate(user, "leaderStartedAt", "joinedAt");
      expect(d.toISOString().slice(0, 10)).toBe("2025-01-15");
    });
  });

  describe("getTenureMonths", () => {
    it("returns 0 when now equals start", () => {
      const user: UserTenureProfile = { joinedAt: "2026-03-01" };
      const now = new Date("2026-03-01");
      expect(getTenureMonths(user, "joinedAt", minimalConfig, now)).toBe(0);
    });

    it("returns positive months when now is after start", () => {
      const user: UserTenureProfile = { joinedAt: "2025-01-01" };
      const now = new Date("2025-07-01");
      expect(getTenureMonths(user, "joinedAt", minimalConfig, now)).toBeGreaterThanOrEqual(5);
    });
  });

  describe("STAFF_LEVEL_ORDER and LEADER_LEVEL_ORDER", () => {
    it("STAFF_LEVEL_ORDER is S1 S2 S3", () => {
      expect(STAFF_LEVEL_ORDER).toEqual(["S1", "S2", "S3"]);
    });
    it("LEADER_LEVEL_ORDER includes L4", () => {
      expect(LEADER_LEVEL_ORDER).toContain("L4");
      expect(LEADER_LEVEL_ORDER).toEqual(["L1", "L2", "L3", "L4"]);
    });
  });

  describe("getMaxUnlockedLevelTenure", () => {
    it("returns S1 for staff with 0 tenure when S1 requires 0 months", () => {
      const user: UserTenureProfile = { joinedAt: "2026-03-01" };
      const now = new Date("2026-03-01");
      expect(getMaxUnlockedLevelTenure("staff", user, minimalConfig, now)).toBe("S1");
    });

    it("returns L1 for leader with 0 tenure when L1 requires 0 months", () => {
      const user: UserTenureProfile = { joinedAt: "2026-03-01" };
      const now = new Date("2026-03-01");
      expect(getMaxUnlockedLevelTenure("leader", user, minimalConfig, now)).toBe("L1");
    });
  });

  describe("getNextLockedLevel", () => {
    it("returns S2 when maxUnlocked is S1 (staff)", () => {
      expect(getNextLockedLevel("staff", "S1")).toBe("S2");
    });
    it("returns S3 when maxUnlocked is S2", () => {
      expect(getNextLockedLevel("staff", "S2")).toBe("S3");
    });
    it("returns null when maxUnlocked is S3 (staff top)", () => {
      expect(getNextLockedLevel("staff", "S3")).toBeNull();
    });
    it("returns L2 when maxUnlocked is L1 (leader)", () => {
      expect(getNextLockedLevel("leader", "L1")).toBe("L2");
    });
    it("returns null when maxUnlocked is not in track order (e.g. L1 for staff)", () => {
      expect(getNextLockedLevel("staff", "L1")).toBeNull();
    });
  });
});
