import { describe, it, expect } from "vitest";
import { getMilestoneToShow, getPendingMilestone } from "./milestone";

describe("milestone", () => {
  // ── getPendingMilestone (pure function) ──────────────────────

  describe("getPendingMilestone", () => {
    it("returns null when tier < 25", () => {
      expect(getPendingMilestone(0, 0)).toBeNull();
      expect(getPendingMilestone(24, 0)).toBeNull();
    });

    it("returns milestone 25 when tier >= 25 and lastCelebrated < 25", () => {
      const r = getPendingMilestone(25, 0);
      expect(r).toEqual({ milestone: 25 });
    });

    it("returns null when tier >= 25 but already celebrated 25", () => {
      expect(getPendingMilestone(25, 25)).toBeNull();
      expect(getPendingMilestone(30, 25)).toBeNull();
    });

    it("returns milestone 50 with previousSubName when tier >= 50 and lastCelebrated < 50", () => {
      const r = getPendingMilestone(50, 25);
      expect(r).not.toBeNull();
      expect(r!.milestone).toBe(50);
      expect(typeof r!.previousSubName).toBe("string");
    });

    it("returns null when tier >= 50 but already celebrated 50", () => {
      expect(getPendingMilestone(55, 50)).toBeNull();
    });

    it("returns milestone 75 with previousSubName when tier >= 75 and lastCelebrated < 75", () => {
      const r = getPendingMilestone(75, 50);
      expect(r).not.toBeNull();
      expect(r!.milestone).toBe(75);
      expect(typeof r!.previousSubName).toBe("string");
    });

    it("returns null when all milestones already celebrated", () => {
      expect(getPendingMilestone(75, 75)).toBeNull();
      expect(getPendingMilestone(99, 75)).toBeNull();
    });

    it("skips to highest uncelebrated milestone (75 over 50)", () => {
      const r = getPendingMilestone(80, 0);
      expect(r!.milestone).toBe(75);
    });

    it("skips to 50 if 25 is celebrated but 50 isn't", () => {
      const r = getPendingMilestone(60, 25);
      expect(r!.milestone).toBe(50);
    });
  });

  // ── getMilestoneToShow (backward-compat wrapper) ─────────────

  describe("getMilestoneToShow", () => {
    it("returns null when tier is below 25 (e.g. core XP 249)", () => {
      expect(getMilestoneToShow(249)).toBeNull();
      expect(getMilestoneToShow(0)).toBeNull();
      expect(getMilestoneToShow(100)).toBeNull();
    });

    it("returns { milestone: 25 } when tier reaches 25 (core XP 250)", () => {
      const result = getMilestoneToShow(250);
      expect(result).not.toBeNull();
      expect(result!.milestone).toBe(25);
      expect(result!.previousSubName).toBeUndefined();
    });

    it("returns { milestone: 50, previousSubName } when tier reaches 50 (core XP 500)", () => {
      const result = getMilestoneToShow(500);
      expect(result).not.toBeNull();
      expect(result!.milestone).toBe(50);
      expect(typeof result!.previousSubName).toBe("string");
      expect(result!.previousSubName!.length).toBeGreaterThan(0);
    });

    it("returns { milestone: 75, previousSubName } when tier reaches 75 (core XP 750)", () => {
      const result = getMilestoneToShow(750);
      expect(result).not.toBeNull();
      expect(result!.milestone).toBe(75);
      expect(typeof result!.previousSubName).toBe("string");
      expect(result!.previousSubName!.length).toBeGreaterThan(0);
    });

    it("prioritizes highest crossed milestone (75 over 50 over 25)", () => {
      const at750 = getMilestoneToShow(750);
      expect(at750?.milestone).toBe(75);
      const at500 = getMilestoneToShow(500);
      expect(at500?.milestone).toBe(50);
      const at250 = getMilestoneToShow(250);
      expect(at250?.milestone).toBe(25);
    });
  });
});
