import { describe, it, expect } from "vitest";
import {
  ledgerStateAfterWeeklyBoundaryReset,
  isWeeklyBoundaryResetNoop,
} from "./weeklyResetIdempotency";

describe("weeklyResetIdempotency", () => {
  it("same week → noop, preserves xp", () => {
    const r = ledgerStateAfterWeeklyBoundaryReset({
      storedWeekId: "2025-03-10",
      activeWeekId: "2025-03-10",
      storedXpTotal: 42,
    });
    expect(r).toEqual({
      kind: "noop_already_active_week",
      weekId: "2025-03-10",
      xpTotal: 42,
    });
  });

  it("prior week → advance to active week, xp zero", () => {
    const r = ledgerStateAfterWeeklyBoundaryReset({
      storedWeekId: "2025-03-03",
      activeWeekId: "2025-03-10",
      storedXpTotal: 999,
    });
    expect(r).toEqual({
      kind: "advance_week_zero_xp",
      weekId: "2025-03-10",
      xpTotal: 0,
    });
  });

  it("idempotent: second logical apply after advance is noop with earned xp", () => {
    const afterReset = ledgerStateAfterWeeklyBoundaryReset({
      storedWeekId: "2025-03-03",
      activeWeekId: "2025-03-10",
      storedXpTotal: 100,
    });
    expect(afterReset.kind).toBe("advance_week_zero_xp");
    const userEarned = { ...afterReset, xpTotal: 10 as number };
    const second = ledgerStateAfterWeeklyBoundaryReset({
      storedWeekId: userEarned.weekId,
      activeWeekId: "2025-03-10",
      storedXpTotal: userEarned.xpTotal,
    });
    expect(second.kind).toBe("noop_already_active_week");
    expect(second).toEqual({
      kind: "noop_already_active_week",
      weekId: "2025-03-10",
      xpTotal: 10,
    });
  });

  it("floors negative storedXpTotal on noop", () => {
    const r = ledgerStateAfterWeeklyBoundaryReset({
      storedWeekId: "2025-03-10",
      activeWeekId: "2025-03-10",
      storedXpTotal: -5,
    });
    expect(r).toMatchObject({ xpTotal: 0 });
  });

  it("isWeeklyBoundaryResetNoop mirrors same-week check", () => {
    expect(isWeeklyBoundaryResetNoop("a", "a")).toBe(true);
    expect(isWeeklyBoundaryResetNoop("a", "b")).toBe(false);
  });
});
