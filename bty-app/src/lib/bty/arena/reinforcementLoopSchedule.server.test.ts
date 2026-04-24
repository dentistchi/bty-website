import { describe, expect, it } from "vitest";
import {
  REINFORCEMENT_NO_CHANGE_DELAY_DAYS,
  REINFORCEMENT_UNSTABLE_DELAY_DAYS,
  loopIterationForPendingRow,
} from "./reinforcementLoopSchedule.server";

describe("reinforcementLoopSchedule", () => {
  it("loopIterationForPendingRow defaults to 1", () => {
    expect(loopIterationForPendingRow({})).toBe(1);
    expect(loopIterationForPendingRow({ reinforcement_loop: null })).toBe(1);
  });

  it("loopIterationForPendingRow reads loop_iteration", () => {
    expect(loopIterationForPendingRow({ reinforcement_loop: { loop_iteration: 3 } })).toBe(3);
  });

  it("exposes reschedule day offsets (unstable medium / no_change stronger-sooner)", () => {
    expect(REINFORCEMENT_UNSTABLE_DELAY_DAYS).toBe(5);
    expect(REINFORCEMENT_NO_CHANGE_DELAY_DAYS).toBe(3);
    expect(REINFORCEMENT_NO_CHANGE_DELAY_DAYS).toBeLessThan(REINFORCEMENT_UNSTABLE_DELAY_DAYS);
  });
});
