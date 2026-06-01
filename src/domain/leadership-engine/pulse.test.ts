import { describe, it, expect } from "vitest";
import { computePulse14d, type PulseRecord } from "./pulse";

const MS_PER_DAY = 86_400_000;
const asOf = new Date("2026-05-31T00:00:00.000Z");
const daysBefore = (n: number): Date =>
  new Date(asOf.getTime() - n * MS_PER_DAY);
const rec = (pulse_value: number, created_at: Date): PulseRecord => ({
  pulse_value,
  created_at,
});

describe("computePulse14d", () => {
  it("empty input -> pending (hasPulse false, pulseNorm 0)", () => {
    expect(computePulse14d([], asOf)).toEqual({ pulseNorm: 0, hasPulse: false });
  });

  it("all records outside 14d window -> pending", () => {
    const out = [rec(5, daysBefore(15)), rec(4, daysBefore(30))];
    expect(computePulse14d(out, asOf)).toEqual({ pulseNorm: 0, hasPulse: false });
  });

  it("single in-window value 5 -> norm 1", () => {
    expect(computePulse14d([rec(5, daysBefore(7))], asOf)).toEqual({
      pulseNorm: 1,
      hasPulse: true,
    });
  });

  it("single in-window value 1 -> norm 0", () => {
    expect(computePulse14d([rec(1, daysBefore(1))], asOf)).toEqual({
      pulseNorm: 0,
      hasPulse: true,
    });
  });

  it("mean of multiple (2,4 -> mean 3 -> 0.5)", () => {
    const r = [rec(2, daysBefore(2)), rec(4, daysBefore(5))];
    expect(computePulse14d(r, asOf)).toEqual({ pulseNorm: 0.5, hasPulse: true });
  });

  it("boundary: record exactly at 14d cutoff is included", () => {
    expect(computePulse14d([rec(5, daysBefore(14))], asOf)).toEqual({
      pulseNorm: 1,
      hasPulse: true,
    });
  });

  it("record just before cutoff (14d + 1ms) excluded -> pending", () => {
    const justBefore = new Date(asOf.getTime() - (14 * MS_PER_DAY + 1));
    expect(computePulse14d([rec(5, justBefore)], asOf)).toEqual({
      pulseNorm: 0,
      hasPulse: false,
    });
  });

  it("future record beyond asOf excluded -> pending", () => {
    const future = new Date(asOf.getTime() + MS_PER_DAY);
    expect(computePulse14d([rec(5, future)], asOf)).toEqual({
      pulseNorm: 0,
      hasPulse: false,
    });
  });

  it("only in-window records contribute to mean (in 4 / out 1 -> 0.75)", () => {
    const mixed = [rec(4, daysBefore(3)), rec(1, daysBefore(20))];
    expect(computePulse14d(mixed, asOf)).toEqual({
      pulseNorm: 0.75,
      hasPulse: true,
    });
  });
});
