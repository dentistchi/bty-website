/**
 * Edge-case tests for program (Arena 11차).
 * TASK 2(weeklyQuest)와 다른 미커버 모듈. 경계·상수·기존 동작만 검증, 비즈니스/XP 로직 미변경.
 */
import { describe, it, expect } from "vitest";
import {
  STAFF_JOB_FUNCTIONS,
  LEADER_JOB_FUNCTIONS,
  JOB_MAX_LEVEL_CAP,
  NEW_JOINER_STAFF_DAYS,
  minLevel,
} from "./program";

describe("program (edges)", () => {
  describe("constants", () => {
    it("NEW_JOINER_STAFF_DAYS is 30", () => {
      expect(NEW_JOINER_STAFF_DAYS).toBe(30);
    });
    it("JOB_MAX_LEVEL_CAP has doctor, senior_doctor, partner", () => {
      expect(JOB_MAX_LEVEL_CAP["doctor"]).toBe("S3");
      expect(JOB_MAX_LEVEL_CAP["senior_doctor"]).toBe("L1");
      expect(JOB_MAX_LEVEL_CAP["partner"]).toBe("L4");
    });
    it("STAFF_JOB_FUNCTIONS and LEADER_JOB_FUNCTIONS are non-empty", () => {
      expect(STAFF_JOB_FUNCTIONS.length).toBeGreaterThan(0);
      expect(LEADER_JOB_FUNCTIONS.length).toBeGreaterThan(0);
    });
  });

  describe("minLevel", () => {
    it("returns first arg when first is unknown (index -1)", () => {
      expect(minLevel("X9", "S1")).toBe("X9");
    });
    it("S1 is lower than L1 in progression", () => {
      expect(minLevel("S1", "L1")).toBe("S1");
      expect(minLevel("L1", "S1")).toBe("S1");
    });
    it("L4 is highest in order", () => {
      expect(minLevel("L4", "S3")).toBe("S3");
      expect(minLevel("S3", "L4")).toBe("S3");
    });
    it("same level returns that level", () => {
      expect(minLevel("S1", "S1")).toBe("S1");
      expect(minLevel("L2", "L2")).toBe("L2");
    });
  });
});
