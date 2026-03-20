import { describe, expect, it } from "vitest";
import type { ArenaSignal } from "@/features/my-page/logic/types";
import { checkArenaLowRegulation, checkRecoveryTrigger } from "./checkRecoveryTrigger";

function sig(reg: number): ArenaSignal {
  return {
    scenarioId: "s",
    primary: "A",
    reinforcement: "X",
    traits: {},
    meta: { relationalBias: 0.5, operationalBias: 0.5, emotionalRegulation: reg },
    timestamp: 1,
  };
}

describe("checkArenaLowRegulation", () => {
  it("returns false when fewer than 3 signals", () => {
    expect(checkArenaLowRegulation([sig(0.2), sig(0.2)])).toBe(false);
  });

  it("returns true when recent average regulation is very low", () => {
    const signals = [sig(0.5), sig(0.4), sig(0.3)];
    expect(checkArenaLowRegulation(signals)).toBe(true);
  });
});

describe("checkRecoveryTrigger (compound)", () => {
  it("returns true when last up to 3 signals average regulation below threshold", () => {
    expect(checkRecoveryTrigger([sig(0.2), sig(0.2)])).toBe(true);
  });

  it("returns true when two of last five reflections are regulation-focused", () => {
    const reflections = [
      { focus: "regulation" },
      { focus: "clarity" },
      { focus: "regulation" },
    ];
    expect(checkRecoveryTrigger([], reflections)).toBe(true);
  });

  it("returns false when signals empty and no regulation cluster", () => {
    expect(checkRecoveryTrigger([], [{ focus: "clarity" }])).toBe(false);
  });
});
