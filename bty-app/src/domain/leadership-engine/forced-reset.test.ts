import { describe, it, expect } from "vitest";
import {
  evaluateForcedReset,
  getResetDueAt,
  FORCED_RESET_STAGE3_COUNT_THRESHOLD,
  FORCED_RESET_NO_QR_DAYS_THRESHOLD,
  type ResetEvalInputs,
} from "./forced-reset";

function inputs(overrides: Partial<ResetEvalInputs> = {}): ResetEvalInputs {
  return {
    stage3SelectedCountIn14d: 0,
    air7dBelow70ForTwoConsecutiveWeeks: false,
    noQrVerificationDays: 0,
    tspDecliningTwoConsecutiveWeeks: false,
    ...overrides,
  };
}

describe("evaluateForcedReset", () => {
  it("does not trigger when no condition is met", () => {
    const result = evaluateForcedReset(inputs());
    expect(result.shouldTrigger).toBe(false);
    expect(result.reasons).toHaveLength(0);
  });

  it("does not trigger when only one condition is met (stage3 twice)", () => {
    const result = evaluateForcedReset(
      inputs({ stage3SelectedCountIn14d: FORCED_RESET_STAGE3_COUNT_THRESHOLD })
    );
    expect(result.shouldTrigger).toBe(false);
    expect(result.reasons).toHaveLength(1);
    expect(result.reasons).toContain("stage3_selected_twice_in_14d");
  });

  it("does not trigger when only one condition is met (no QR 7 days)", () => {
    const result = evaluateForcedReset(
      inputs({ noQrVerificationDays: FORCED_RESET_NO_QR_DAYS_THRESHOLD })
    );
    expect(result.shouldTrigger).toBe(false);
    expect(result.reasons).toHaveLength(1);
    expect(result.reasons).toContain("no_qr_verification_7_days");
  });

  it("triggers when exactly two conditions are met", () => {
    const result = evaluateForcedReset(
      inputs({
        stage3SelectedCountIn14d: 2,
        air7dBelow70ForTwoConsecutiveWeeks: true,
      })
    );
    expect(result.shouldTrigger).toBe(true);
    expect(result.reasons).toHaveLength(2);
    expect(result.reasons).toContain("stage3_selected_twice_in_14d");
    expect(result.reasons).toContain("air_7d_below_70_two_consecutive_weeks");
  });

  it("triggers when three conditions are met", () => {
    const result = evaluateForcedReset(
      inputs({
        stage3SelectedCountIn14d: 3,
        noQrVerificationDays: 10,
        tspDecliningTwoConsecutiveWeeks: true,
      })
    );
    expect(result.shouldTrigger).toBe(true);
    expect(result.reasons).toHaveLength(3);
  });

  it("triggers when all four conditions are met", () => {
    const result = evaluateForcedReset(
      inputs({
        stage3SelectedCountIn14d: 2,
        air7dBelow70ForTwoConsecutiveWeeks: true,
        noQrVerificationDays: 7,
        tspDecliningTwoConsecutiveWeeks: true,
      })
    );
    expect(result.shouldTrigger).toBe(true);
    expect(result.reasons).toHaveLength(4);
  });

  it("uses threshold for stage3 count (>= 2)", () => {
    expect(evaluateForcedReset(inputs({ stage3SelectedCountIn14d: 1 })).reasons).not.toContain(
      "stage3_selected_twice_in_14d"
    );
    expect(evaluateForcedReset(inputs({ stage3SelectedCountIn14d: 2 })).reasons).toContain(
      "stage3_selected_twice_in_14d"
    );
  });

  it("uses threshold for no QR days (>= 7)", () => {
    expect(evaluateForcedReset(inputs({ noQrVerificationDays: 6 })).reasons).not.toContain(
      "no_qr_verification_7_days"
    );
    expect(evaluateForcedReset(inputs({ noQrVerificationDays: 7 })).reasons).toContain(
      "no_qr_verification_7_days"
    );
  });
});

describe("getResetDueAt", () => {
  it("returns triggeredAt + 48 hours", () => {
    const triggered = new Date("2025-01-01T12:00:00Z");
    const due = getResetDueAt(triggered);
    expect(due.getTime()).toBe(triggered.getTime() + 48 * 60 * 60 * 1000);
  });
});
