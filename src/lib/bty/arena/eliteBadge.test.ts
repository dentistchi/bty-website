import { describe, it, expect } from "vitest";
import { getEliteBadgeGrants, ELITE_BADGE_KINDS } from "./eliteBadge";

describe("eliteBadge", () => {
  describe("getEliteBadgeGrants", () => {
    it("returns empty array when not elite", () => {
      expect(getEliteBadgeGrants(false)).toEqual([]);
    });

    it("returns weekly_elite badge when elite", () => {
      const grants = getEliteBadgeGrants(true);
      expect(grants).toHaveLength(1);
      expect(grants[0]).toEqual({ kind: "weekly_elite", labelKey: "weekly_elite" });
    });

    it("returns only weekly_elite kind in ELITE_BADGE_KINDS", () => {
      expect(ELITE_BADGE_KINDS).toContain("weekly_elite");
      const grants = getEliteBadgeGrants(true);
      expect(grants.every((g) => ELITE_BADGE_KINDS.includes(g.kind))).toBe(true);
    });
  });
});
