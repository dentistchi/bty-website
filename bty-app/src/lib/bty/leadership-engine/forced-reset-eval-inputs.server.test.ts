import { describe, it, expect } from "vitest";
import { air7dBelowHighBandLastTwoCompletedWeeks } from "./forced-reset-eval-inputs.server";

describe("air7dBelowHighBandLastTwoCompletedWeeks", () => {
  it("is false when there are no activations (no double-hit with no-QR)", () => {
    const now = new Date("2026-03-15T12:00:00.000Z");
    expect(air7dBelowHighBandLastTwoCompletedWeeks([], now)).toBe(false);
  });
});
