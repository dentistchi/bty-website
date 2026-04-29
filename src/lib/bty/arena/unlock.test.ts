/**
 * unlock — buildTenurePolicyConfig, getUnlockedContentWindow 단위 테스트.
 */
import { describe, it, expect } from "vitest";
import { buildTenurePolicyConfig, getUnlockedContentWindow } from "./unlock";
import type { ArenaProgramConfig, LevelWithTenure } from "./program";

function level(levelId: string, min_tenure_months: number, tenure_basis?: "joinedAt" | "leaderStartedAt"): LevelWithTenure {
  return {
    level: levelId,
    title: levelId,
    structure: [],
    min_tenure_months,
    ...(tenure_basis && { tenure_basis }),
    items: [],
  };
}

const minimalProgram: ArenaProgramConfig = {
  program: "test",
  version: "1",
  new_joiner_rule: { description: "New joiner", staff_training_days: 30 },
  tracks: [
    {
      track: "staff",
      title: "Staff",
      job_functions: [],
      levels: [
        level("S1", 0),
        level("S2", 3),
        level("S3", 12),
      ],
    },
    {
      track: "leader",
      title: "Leader",
      job_functions: [],
      levels: [
        level("L1", 24, "leaderStartedAt"),
        level("L2", 60, "leaderStartedAt"),
        level("L3", 120, "leaderStartedAt"),
        level("L4", 9999, "leaderStartedAt"),
      ],
    },
  ],
};

describe("unlock", () => {
  describe("buildTenurePolicyConfig", () => {
    it("returns default minTenureMonthsByLevel and tenureBasis when program has no overrides", () => {
      const cfg = buildTenurePolicyConfig(minimalProgram);
      expect(cfg.newJoinerRule.enabled).toBe(true);
      expect(cfg.newJoinerRule.days).toBe(30);
      expect(cfg.newJoinerRule.forcedTrack).toBe("staff");
      expect(cfg.minTenureMonthsByLevel.S1).toBe(0);
      expect(cfg.minTenureMonthsByLevel.S2).toBe(3);
      expect(cfg.minTenureMonthsByLevel.S3).toBe(12);
      expect(cfg.minTenureMonthsByLevel.L1).toBe(24);
      expect(cfg.minTenureMonthsByLevel.L4).toBe(9999);
      expect(cfg.tenureBasisByLevel.S1).toBe("joinedAt");
      expect(cfg.tenureBasisByLevel.L1).toBe("leaderStartedAt");
      expect(cfg.leaderFallbackBasis).toBe("joinedAt");
    });

    it("uses new_joiner_rule.staff_training_days when provided", () => {
      const program: ArenaProgramConfig = {
        ...minimalProgram,
        new_joiner_rule: { description: "X", staff_training_days: 14 },
      };
      const cfg = buildTenurePolicyConfig(program);
      expect(cfg.newJoinerRule.days).toBe(14);
    });
  });

  describe("getUnlockedContentWindow", () => {
    it("returns S1 and preview S2 for staff with 0 tenure", () => {
      const user = { joinedAt: "2026-03-01" };
      const now = new Date("2026-03-01");
      const result = getUnlockedContentWindow({
        track: "staff",
        user,
        program: minimalProgram,
        now,
      });
      expect(result.maxUnlockedLevel).toBe("S1");
      expect(result.previewLevel).toBe("S2");
    });

    it("returns L4 and null preview when leader and l4Granted is true", () => {
      const user = { joinedAt: "2020-01-01" };
      const result = getUnlockedContentWindow({
        track: "leader",
        user,
        program: minimalProgram,
        l4Granted: true,
      });
      expect(result.maxUnlockedLevel).toBe("L4");
      expect(result.previewLevel).toBeNull();
    });

    it("applies jobFunction cap doctor to S3", () => {
      const user = { joinedAt: "2020-01-01", leaderStartedAt: "2020-01-01" };
      const now = new Date("2030-01-01");
      const result = getUnlockedContentWindow({
        track: "leader",
        user,
        program: minimalProgram,
        now,
        jobFunction: "doctor",
      });
      expect(result.maxUnlockedLevel).toBe("S3");
      expect(result.previewLevel).toBeNull();
    });

    it("applies jobFunction cap senior_doctor to L1", () => {
      const user = { joinedAt: "2020-01-01", leaderStartedAt: "2020-01-01" };
      const now = new Date("2030-01-01");
      const result = getUnlockedContentWindow({
        track: "leader",
        user,
        program: minimalProgram,
        now,
        jobFunction: "senior_doctor",
      });
      expect(result.maxUnlockedLevel).toBe("L1");
      expect(result.previewLevel).toBe("L2");
    });
  });
});
