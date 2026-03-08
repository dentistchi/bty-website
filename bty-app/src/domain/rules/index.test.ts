/**
 * domain/rules/index — barrel re-exports 검증 (비즈니스/XP 미변경).
 */
import { describe, it, expect } from "vitest";
import * as rules from "./index";

describe("domain/rules/index", () => {
  it("re-exports level-tier (tierFromCoreXp)", () => {
    expect(typeof rules.tierFromCoreXp).toBe("function");
    expect(rules.tierFromCoreXp(0)).toBe(0);
    expect(rules.tierFromCoreXp(25)).toBe(2);
  });

  it("re-exports xp (seasonalToCoreConversion)", () => {
    expect(typeof rules.seasonalToCoreConversion).toBe("function");
    const r = rules.seasonalToCoreConversion(60, 0);
    expect(r.rate).toBeDefined();
    expect(r.coreGain).toBeDefined();
  });

  it("re-exports leaderboard (rankByWeeklyXpOnly)", () => {
    expect(typeof rules.rankByWeeklyXpOnly).toBe("function");
    const ranked = rules.rankByWeeklyXpOnly([{ weeklyXp: 10 }, { weeklyXp: 20 }]);
    expect(ranked[0].rank).toBe(1);
    expect(ranked[0].weeklyXp).toBe(20);
  });
});
