import { describe, it, expect } from "vitest";
import { computePendingPulseRun, type DoneRunRef } from "./pending-pulse";

const run = (id: string, ts: string): DoneRunRef => ({ run_id: id, completed_at: ts });

describe("computePendingPulseRun", () => {
  it("no done runs -> null", () => {
    expect(computePendingPulseRun([], new Set())).toBeNull();
  });

  it("most recent done is unpulsed -> returns it", () => {
    const runs = [run("r3", "2026-05-31"), run("r2", "2026-05-30")];
    expect(computePendingPulseRun(runs, new Set(["r2"]))).toBe("r3");
  });

  it("most recent pulsed -> returns next unpulsed", () => {
    const runs = [run("r3", "2026-05-31"), run("r2", "2026-05-30"), run("r1", "2026-05-29")];
    expect(computePendingPulseRun(runs, new Set(["r3"]))).toBe("r2");
  });

  it("all pulsed -> null", () => {
    const runs = [run("r2", "2026-05-30"), run("r1", "2026-05-29")];
    expect(computePendingPulseRun(runs, new Set(["r1", "r2"]))).toBeNull();
  });

  it("respects DESC order (returns first unpulsed encountered)", () => {
    const runs = [run("rA", "2026-05-31"), run("rB", "2026-05-30")];
    expect(computePendingPulseRun(runs, new Set())).toBe("rA");
  });
});
