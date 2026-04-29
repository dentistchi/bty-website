/**
 * weeklyResetIdempotency — XP·week 키 경계 (SPRINT 60 TASK 8 / C3).
 * Core XP는 리셋 대상 아님; 본 모듈은 weekly ledger 주차 전이만 다룸.
 */
import { describe, it, expect } from "vitest";
import {
  ledgerStateAfterWeeklyBoundaryReset,
  isWeeklyBoundaryResetNoop,
} from "./weeklyResetIdempotency";

describe("weeklyResetIdempotency (edges)", () => {
  it("noop floors fractional storedXpTotal", () => {
    const r = ledgerStateAfterWeeklyBoundaryReset({
      storedWeekId: "w1",
      activeWeekId: "w1",
      storedXpTotal: 7.9,
    });
    expect(r).toMatchObject({ kind: "noop_already_active_week", xpTotal: 7 });
  });

  it("advance always yields xpTotal 0 regardless of prior stored total", () => {
    const r = ledgerStateAfterWeeklyBoundaryReset({
      storedWeekId: "old",
      activeWeekId: "new",
      storedXpTotal: 1_000_000,
    });
    expect(r).toEqual({
      kind: "advance_week_zero_xp",
      weekId: "new",
      xpTotal: 0,
    });
  });

  it("string week_id inequality uses lexicographic compare (deterministic)", () => {
    expect(
      isWeeklyBoundaryResetNoop("2025-03-03", "2025-03-10")
    ).toBe(false);
    expect(
      ledgerStateAfterWeeklyBoundaryReset({
        storedWeekId: "2025-03-03",
        activeWeekId: "2025-03-10",
        storedXpTotal: 0,
      }).kind
    ).toBe("advance_week_zero_xp");
  });

  it("empty week ids: equal strings → noop", () => {
    expect(isWeeklyBoundaryResetNoop("", "")).toBe(true);
    expect(
      ledgerStateAfterWeeklyBoundaryReset({
        storedWeekId: "",
        activeWeekId: "",
        storedXpTotal: 1,
      })
    ).toMatchObject({ kind: "noop_already_active_week", xpTotal: 1 });
  });
});
