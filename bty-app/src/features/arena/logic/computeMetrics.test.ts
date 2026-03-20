import { describe, expect, it } from "vitest";
import type { ArenaSignal } from "@/features/my-page/logic/types";
import { computeMetrics } from "./computeMetrics";

const sample: ArenaSignal = {
  scenarioId: "s1",
  primary: "A",
  reinforcement: "X",
  traits: {
    Insight: 0.6,
    Communication: 0.8,
    Integrity: 0.7,
  },
  meta: {
    relationalBias: 0.9,
    operationalBias: 0.2,
    emotionalRegulation: 0.7,
  },
  timestamp: 1,
};

describe("computeMetrics", () => {
  it("returns zeros when no signals", () => {
    const m = computeMetrics([]);
    expect(m.xp).toBe(0);
    expect(m.AIR).toBe(0);
    expect(m.TII).toBe(0);
    expect(m.relationalBias).toBe(0);
    expect(m.signalCount).toBe(0);
  });

  it("aggregates xp, AIR, TII, and bias means for one signal", () => {
    const m = computeMetrics([sample]);
    expect(m.xp).toBeCloseTo(10 + 0.7 * 5, 5);
    expect(m.AIR).toBeCloseTo((0.6 + 0.8) / 2, 5);
    expect(m.TII).toBeCloseTo((0.7 + 0.9) / 2, 5);
    expect(m.relationalBias).toBeCloseTo(0.9, 5);
    expect(m.signalCount).toBe(1);
  });

  it("reads legacy lowercase trait keys", () => {
    const legacy = {
      ...sample,
      traits: { insight: 0.5, communication: 0.5, integrity: 0.5 } as ArenaSignal["traits"],
    };
    const m = computeMetrics([legacy]);
    expect(m.AIR).toBeCloseTo(0.5, 5);
    expect(m.TII).toBeCloseTo((0.5 + 0.9) / 2, 5);
  });
});
