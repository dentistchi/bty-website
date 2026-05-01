/**
 * program — track, job functions, minLevel, isNewJoiner, tenureMonthsSince, getEffectiveTrack, getMaxUnlockedLevel, loadProgramConfig, loadL4Level 단위 테스트.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  STAFF_JOB_FUNCTIONS,
  LEADER_JOB_FUNCTIONS,
  JOB_MAX_LEVEL_CAP,
  NEW_JOINER_STAFF_DAYS,
  minLevel,
  isNewJoiner,
  tenureMonthsSince,
  getEffectiveTrack,
  getMaxUnlockedLevel,
  loadProgramConfig,
  loadL4Level,
  type ArenaProgramConfig,
} from "./program";

describe("program", () => {
  describe("constants", () => {
    it("STAFF_JOB_FUNCTIONS includes doctor and assistant", () => {
      expect(STAFF_JOB_FUNCTIONS).toContain("doctor");
      expect(STAFF_JOB_FUNCTIONS).toContain("assistant");
    });

    it("LEADER_JOB_FUNCTIONS includes partner and senior_doctor", () => {
      expect(LEADER_JOB_FUNCTIONS).toContain("partner");
      expect(LEADER_JOB_FUNCTIONS).toContain("senior_doctor");
    });

    it("JOB_MAX_LEVEL_CAP has expected caps", () => {
      expect(JOB_MAX_LEVEL_CAP.doctor).toBe("S3");
      expect(JOB_MAX_LEVEL_CAP.senior_doctor).toBe("L1");
      expect(JOB_MAX_LEVEL_CAP.partner).toBe("L4");
    });

    it("NEW_JOINER_STAFF_DAYS is 30", () => {
      expect(NEW_JOINER_STAFF_DAYS).toBe(30);
    });
  });

  describe("minLevel", () => {
    it("returns the earlier level in progression order", () => {
      expect(minLevel("S1", "S3")).toBe("S1");
      expect(minLevel("S3", "S1")).toBe("S1");
      expect(minLevel("L1", "S2")).toBe("S2");
      expect(minLevel("S2", "L1")).toBe("S2");
    });

    it("returns same level when equal", () => {
      expect(minLevel("S2", "S2")).toBe("S2");
    });

    it("returns first arg when second is unknown (index -1)", () => {
      expect(minLevel("S1", "X9")).toBe("S1");
    });
  });

  describe("isNewJoiner", () => {
    const fixedNow = new Date("2026-03-15T12:00:00Z");

    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(fixedNow);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("returns false for null or undefined", () => {
      expect(isNewJoiner(null)).toBe(false);
      expect(isNewJoiner(undefined)).toBe(false);
    });

    it("returns true when joined within NEW_JOINER_STAFF_DAYS", () => {
      expect(isNewJoiner("2026-03-01")).toBe(true);
      expect(isNewJoiner("2026-03-10")).toBe(true);
    });

    it("returns false when joined more than NEW_JOINER_STAFF_DAYS ago", () => {
      expect(isNewJoiner("2026-01-01")).toBe(false);
      expect(isNewJoiner("2020-01-01")).toBe(false);
    });

    it("returns false for invalid date string", () => {
      expect(isNewJoiner("not-a-date")).toBe(false);
    });
  });

  describe("tenureMonthsSince", () => {
    const fixedNow = new Date("2026-03-15");

    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(fixedNow);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("returns 0 for null or undefined", () => {
      expect(tenureMonthsSince(null)).toBe(0);
      expect(tenureMonthsSince(undefined)).toBe(0);
    });

    it("returns 0 for invalid date", () => {
      expect(tenureMonthsSince("invalid")).toBe(0);
    });

    it("returns calendar months between since and now", () => {
      expect(tenureMonthsSince("2026-03-15")).toBe(0);
      expect(tenureMonthsSince("2026-02-15")).toBe(1);
      expect(tenureMonthsSince("2026-01-15")).toBe(2);
      expect(tenureMonthsSince("2025-03-15")).toBe(12);
    });
  });

  describe("getEffectiveTrack", () => {
    const oldJoinedAt = "2020-01-01"; // not new joiner

    it("returns staff when jobFunction is staff (doctor, assistant)", () => {
      expect(getEffectiveTrack({ jobFunction: "doctor", joinedAt: oldJoinedAt })).toBe("staff");
      expect(getEffectiveTrack({ jobFunction: "assistant", joinedAt: oldJoinedAt })).toBe("staff");
    });

    it("returns leader when jobFunction is leader (partner, senior_doctor)", () => {
      expect(getEffectiveTrack({ jobFunction: "partner", joinedAt: oldJoinedAt })).toBe("leader");
      expect(getEffectiveTrack({ jobFunction: "senior_doctor", joinedAt: oldJoinedAt })).toBe("leader");
    });

    it("normalizes job function (lowercase, trim, aliases)", () => {
      expect(getEffectiveTrack({ jobFunction: "  Partner  ", joinedAt: oldJoinedAt })).toBe("leader");
      expect(getEffectiveTrack({ jobFunction: "om", joinedAt: oldJoinedAt })).toBe("leader");
    });

    it("falls back to membershipRole when jobFunction not in lists", () => {
      expect(getEffectiveTrack({ membershipRole: "office_manager", joinedAt: oldJoinedAt })).toBe("leader");
      expect(getEffectiveTrack({ membershipRole: "regional_manager", joinedAt: oldJoinedAt })).toBe("leader");
      expect(getEffectiveTrack({ membershipRole: "doctor", joinedAt: oldJoinedAt })).toBe("staff");
      expect(getEffectiveTrack({ membershipRole: "staff", joinedAt: oldJoinedAt })).toBe("staff");
    });

    it("returns staff when no job/role (default)", () => {
      expect(getEffectiveTrack({ joinedAt: oldJoinedAt })).toBe("staff");
    });

    it("returns staff for new joiner even when jobFunction is leader", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-03-15"));
      expect(getEffectiveTrack({ jobFunction: "partner", joinedAt: "2026-03-01" })).toBe("staff");
      vi.useRealTimers();
    });
  });

  describe("getMaxUnlockedLevel", () => {
    it("staff track: returns S1 when tenure 0", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-03-01"));
      expect(getMaxUnlockedLevel({ track: "staff", joinedAt: "2026-03-01" })).toBe("S1");
      vi.useRealTimers();
    });

    it("staff track: returns higher level when tenure meets min_tenure_months", () => {
      // Use a joinedAt far in the past so tenureMonthsSince >= 3, 6, etc.
      expect(getMaxUnlockedLevel({ track: "staff", joinedAt: "2020-01-01" })).toBe("S3");
    });

    it("leader track: uses leaderStartedAt when provided", () => {
      const res = getMaxUnlockedLevel({
        track: "leader",
        joinedAt: "2020-01-01",
        leaderStartedAt: "2026-01-01",
      });
      expect(["L1", "L2", "L3", "L4"]).toContain(res);
    });

    it("leader track: falls back to joinedAt when leaderStartedAt missing", () => {
      const res = getMaxUnlockedLevel({ track: "leader", joinedAt: "2020-01-01" });
      expect(res).toBeDefined();
      expect(["L1", "L2", "L3", "L4"]).toContain(res);
    });
  });

  describe("loadProgramConfig", () => {
    it("returns config with program, version, tracks", () => {
      const config = loadProgramConfig();
      expect(config).toHaveProperty("program");
      expect(config).toHaveProperty("version");
      expect(config).toHaveProperty("tracks");
      expect(Array.isArray(config.tracks)).toBe(true);
    });

    it("tracks include staff and leader", () => {
      const config = loadProgramConfig() as ArenaProgramConfig;
      const tracks = config.tracks.map((t) => t.track);
      expect(tracks).toContain("staff");
      expect(tracks).toContain("leader");
    });
  });

  describe("loadL4Level", () => {
    it("returns L4 level with title and structure", () => {
      const level = loadL4Level();
      expect(level).toHaveProperty("level", "L4");
      expect(level).toHaveProperty("title");
      expect(level).toHaveProperty("title_ko");
      expect(Array.isArray(level.structure)).toBe(true);
      expect(level).toHaveProperty("items");
    });
  });
});
