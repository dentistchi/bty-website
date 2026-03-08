import { describe, it, expect } from "vitest";
import { getMilestoneToShow } from "./milestone";

describe("milestone", () => {
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
