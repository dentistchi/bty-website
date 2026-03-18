/**
 * C6 243 — 주간 경계 멱등(no-op)·Healing 진행률 표시 0–100 클립 엣지.
 */
import { describe, it, expect } from "vitest";
import {
  ledgerStateAfterWeeklyBoundaryReset,
  isWeeklyBoundaryResetNoop,
} from "./weeklyResetIdempotency";

function healingProgressPercentDisplay(raw: number): number {
  const n = Number.isFinite(raw) ? raw : 0;
  return Math.min(100, Math.max(0, Math.round(n)));
}

describe("243 weekly noop + healing percent", () => {
  it("same activeWeekId as stored → noop idempotent (런/리더보드 주간 경계)", () => {
    expect(isWeeklyBoundaryResetNoop("2026-03-10", "2026-03-10")).toBe(true);
    const o = ledgerStateAfterWeeklyBoundaryReset({
      storedWeekId: "2026-03-10",
      activeWeekId: "2026-03-10",
      storedXpTotal: 88,
    });
    expect(o.kind).toBe("noop_already_active_week");
    if (o.kind === "noop_already_active_week") expect(o.xpTotal).toBe(88);
  });

  it("Healing 진행률 표시용 퍼센트 정규화 0–100", () => {
    expect(healingProgressPercentDisplay(-10)).toBe(0);
    expect(healingProgressPercentDisplay(200)).toBe(100);
    expect(healingProgressPercentDisplay(33.4)).toBe(33);
    expect(healingProgressPercentDisplay(NaN)).toBe(0);
  });
});
