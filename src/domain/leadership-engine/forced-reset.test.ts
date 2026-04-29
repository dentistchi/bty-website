import { describe, it, expect } from "vitest";
import {
  evaluateForcedReset,
  getResetDueAt,
  FORCED_RESET_STAGE3_COUNT_THRESHOLD,
  FORCED_RESET_NO_QR_DAYS_THRESHOLD,
  FORCED_RESET_AIR_7D_THRESHOLD,
  FORCED_RESET_DELAY_HOURS,
  type ResetEvalInputs,
  type ForcedResetEvalResult,
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
    expect(result.reasons).toContain("air_7d_below_high_band_two_consecutive_weeks");
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

  it("does not mutate the input date", () => {
    const triggered = new Date("2025-06-15T00:00:00Z");
    const ts = triggered.getTime();
    getResetDueAt(triggered);
    expect(triggered.getTime()).toBe(ts);
  });
});

describe("forced-reset constants and result shape", () => {
  it("exports expected threshold constants", () => {
    expect(FORCED_RESET_STAGE3_COUNT_THRESHOLD).toBe(2);
    expect(FORCED_RESET_NO_QR_DAYS_THRESHOLD).toBe(7);
    expect(FORCED_RESET_AIR_7D_THRESHOLD).toBe(0.8);
    expect(FORCED_RESET_DELAY_HOURS).toBe(48);
  });

  it("evaluateForcedReset returns ForcedResetEvalResult shape", () => {
    const r = evaluateForcedReset(inputs());
    expect(r).toHaveProperty("shouldTrigger");
    expect(r).toHaveProperty("reasons");
    expect(typeof r.shouldTrigger).toBe("boolean");
    expect(Array.isArray(r.reasons)).toBe(true);
    r.reasons.forEach((s) => expect(typeof s).toBe("string"));
  });

  it("reasons are only the four known strings when present", () => {
    const known = new Set([
      "stage3_selected_twice_in_14d",
      "air_7d_below_high_band_two_consecutive_weeks",
      "no_qr_verification_7_days",
      "tsp_declining_two_consecutive_weeks",
    ]);
    const r = evaluateForcedReset(
      inputs({
        stage3SelectedCountIn14d: 2,
        air7dBelow70ForTwoConsecutiveWeeks: true,
        noQrVerificationDays: 7,
        tspDecliningTwoConsecutiveWeeks: true,
      })
    );
    expect(r.reasons).toHaveLength(4);
    r.reasons.forEach((s) => expect(known.has(s)).toBe(true));
  });
});

describe("forced-reset boundary (0/1/2/4 conditions)", () => {
  it("0 conditions: shouldTrigger false, reasons empty", () => {
    const r = evaluateForcedReset(inputs());
    expect(r.shouldTrigger).toBe(false);
    expect(r.reasons).toHaveLength(0);
  });

  it("1 condition (stage3): shouldTrigger false, one reason", () => {
    const r = evaluateForcedReset(inputs({ stage3SelectedCountIn14d: 2 }));
    expect(r.shouldTrigger).toBe(false);
    expect(r.reasons).toHaveLength(1);
    expect(r.reasons).toContain("stage3_selected_twice_in_14d");
  });

  it("1 condition (air): shouldTrigger false, one reason", () => {
    const r = evaluateForcedReset(inputs({ air7dBelow70ForTwoConsecutiveWeeks: true }));
    expect(r.shouldTrigger).toBe(false);
    expect(r.reasons).toHaveLength(1);
    expect(r.reasons).toContain("air_7d_below_high_band_two_consecutive_weeks");
  });

  it("1 condition (noQR): shouldTrigger false, one reason", () => {
    const r = evaluateForcedReset(inputs({ noQrVerificationDays: 7 }));
    expect(r.shouldTrigger).toBe(false);
    expect(r.reasons).toHaveLength(1);
    expect(r.reasons).toContain("no_qr_verification_7_days");
  });

  it("1 condition (tsp): shouldTrigger false, one reason", () => {
    const r = evaluateForcedReset(inputs({ tspDecliningTwoConsecutiveWeeks: true }));
    expect(r.shouldTrigger).toBe(false);
    expect(r.reasons).toHaveLength(1);
    expect(r.reasons).toContain("tsp_declining_two_consecutive_weeks");
  });

  it("2 conditions: shouldTrigger true, two reasons (stage3 + air)", () => {
    const r = evaluateForcedReset(
      inputs({
        stage3SelectedCountIn14d: 2,
        air7dBelow70ForTwoConsecutiveWeeks: true,
      })
    );
    expect(r.shouldTrigger).toBe(true);
    expect(r.reasons).toHaveLength(2);
    expect(r.reasons).toContain("stage3_selected_twice_in_14d");
    expect(r.reasons).toContain("air_7d_below_high_band_two_consecutive_weeks");
  });

  it("2 conditions: shouldTrigger true, two reasons (noQR + tsp)", () => {
    const r = evaluateForcedReset(
      inputs({
        noQrVerificationDays: 8,
        tspDecliningTwoConsecutiveWeeks: true,
      })
    );
    expect(r.shouldTrigger).toBe(true);
    expect(r.reasons).toHaveLength(2);
    expect(r.reasons).toContain("no_qr_verification_7_days");
    expect(r.reasons).toContain("tsp_declining_two_consecutive_weeks");
  });

  it("2 conditions: shouldTrigger true (stage3 + noQR)", () => {
    const r = evaluateForcedReset(
      inputs({
        stage3SelectedCountIn14d: 2,
        noQrVerificationDays: 7,
      })
    );
    expect(r.shouldTrigger).toBe(true);
    expect(r.reasons).toHaveLength(2);
  });

  it("4 conditions: shouldTrigger true, all four reasons", () => {
    const r = evaluateForcedReset(
      inputs({
        stage3SelectedCountIn14d: 2,
        air7dBelow70ForTwoConsecutiveWeeks: true,
        noQrVerificationDays: 7,
        tspDecliningTwoConsecutiveWeeks: true,
      })
    );
    expect(r.shouldTrigger).toBe(true);
    expect(r.reasons).toHaveLength(4);
    expect(r.reasons).toContain("stage3_selected_twice_in_14d");
    expect(r.reasons).toContain("air_7d_below_high_band_two_consecutive_weeks");
    expect(r.reasons).toContain("no_qr_verification_7_days");
    expect(r.reasons).toContain("tsp_declining_two_consecutive_weeks");
  });
});
