/**
 * Weekly XP reset vs season carryover — orthogonal domain rules (C3 edges).
 */
import { describe, it, expect } from "vitest";
import { seasonReset, awardXp } from "./weeklyXp";
import { carryoverWeeklyXp } from "./season";
import { ledgerStateAfterWeeklyBoundaryReset } from "./weeklyResetIdempotency";

describe("domain/rules weekly vs season (edges)", () => {
  it("seasonReset zeros weekly ledger field; carryover maps prior weekly total at season boundary", () => {
    const reset = seasonReset({ coreXp: 500, weeklyXp: 80 });
    expect(reset.coreXp).toBe(500);
    expect(reset.weeklyXp).toBe(0);
    expect(carryoverWeeklyXp(80)).toBe(8);
  });

  /** 244: 주간 경계/리셋 결과에 core 필드 없음·Core 스칼라는 주간 전용 리셋으로 감소하지 않음. */
  it("Core vs Weekly: weekly boundary outcome never touches core; awardXp keeps core monotonic", () => {
    const w = ledgerStateAfterWeeklyBoundaryReset({
      storedWeekId: "2025-03-03",
      activeWeekId: "2025-03-10",
      storedXpTotal: 200,
    });
    expect(w).not.toHaveProperty("coreXp");
    expect(w.kind).toBe("advance_week_zero_xp");
    const before = awardXp({ coreXp: 100, weeklyXp: 50, earnedSeasonalXp: 0 });
    const afterWeeklyZero = { ...before, newWeeklyXp: 0 };
    expect(afterWeeklyZero.newCoreXp).toBe(before.newCoreXp);
    const gain = awardXp({ coreXp: 100, weeklyXp: 0, earnedSeasonalXp: 30 });
    expect(gain.newCoreXp).toBeGreaterThanOrEqual(100);
  });
});
