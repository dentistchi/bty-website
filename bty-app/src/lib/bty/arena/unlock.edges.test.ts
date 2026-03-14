/**
 * Edge-case tests for unlock (Arena 12차).
 * TASK 2(weeklyQuest)·TASK 8(11차 program)와 다른 미커버 모듈. 기존 동작만 검증, 비즈니스/XP 로직 미변경.
 */
import { describe, it, expect } from "vitest";
import { buildTenurePolicyConfig, getUnlockedContentWindow } from "./unlock";
import type { ArenaProgramConfig, LevelWithTenure } from "./program";

function level(
  levelId: string,
  min_tenure_months: number,
  tenure_basis?: "joinedAt" | "leaderStartedAt"
): LevelWithTenure {
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
      levels: [level("S1", 0), level("S2", 3), level("S3", 12)],
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

describe("unlock (edges)", () => {
  describe("buildTenurePolicyConfig", () => {
    it("L4 minTenureMonths is 9999 (partner admin-only)", () => {
      const cfg = buildTenurePolicyConfig(minimalProgram);
      expect(cfg.minTenureMonthsByLevel.L4).toBe(9999);
    });
    it("S1 minTenureMonths is 0 from program", () => {
      const cfg = buildTenurePolicyConfig(minimalProgram);
      expect(cfg.minTenureMonthsByLevel.S1).toBe(0);
    });
    it("S3 minTenureMonths is 12 from program", () => {
      const cfg = buildTenurePolicyConfig(minimalProgram);
      expect(cfg.minTenureMonthsByLevel.S3).toBe(12);
    });
    it("newJoinerRule.forcedTrack is staff", () => {
      const cfg = buildTenurePolicyConfig(minimalProgram);
      expect(cfg.newJoinerRule.forcedTrack).toBe("staff");
    });
    it("uses default 30 days when new_joiner_rule has no staff_training_days", () => {
      const program: ArenaProgramConfig = {
        ...minimalProgram,
        new_joiner_rule: { description: "X" } as { description: string; staff_training_days: number },
      };
      const cfg = buildTenurePolicyConfig(program);
      expect(cfg.newJoinerRule.days).toBe(30);
    });
  });

  describe("getUnlockedContentWindow", () => {
    it("staff track: l4Granted has no effect (maxUnlocked from tenure)", () => {
      const user = { joinedAt: "2026-03-01" };
      const now = new Date("2026-03-01");
      const result = getUnlockedContentWindow({
        track: "staff",
        user,
        program: minimalProgram,
        now,
        l4Granted: true,
      });
      expect(result.maxUnlockedLevel).toBe("S1");
      expect(result.previewLevel).toBe("S2");
    });
    it("jobFunction empty string yields no cap (unknown key)", () => {
      const user = { joinedAt: "2020-01-01", leaderStartedAt: "2020-01-01" };
      const now = new Date("2030-01-01");
      const result = getUnlockedContentWindow({
        track: "leader",
        user,
        program: minimalProgram,
        now,
        jobFunction: "",
      });
      expect(["L1", "L2", "L3"]).toContain(result.maxUnlockedLevel);
    });
  });
});
