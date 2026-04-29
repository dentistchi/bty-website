import { describe, expect, it } from "vitest";
import type { ArenaSignal } from "@/features/my-page/logic/types";
import { buildReflectionSeed } from "./buildReflectionSeed";

const base = (overrides: Partial<ArenaSignal>): ArenaSignal => ({
  scenarioId: "s1",
  primary: "A",
  reinforcement: "X",
  traits: { Insight: 0.5, Communication: 0.5, Integrity: 0.5 },
  meta: { relationalBias: 0.5, operationalBias: 0.5, emotionalRegulation: 0.7 },
  timestamp: 1,
  ...overrides,
});

describe("buildReflectionSeed", () => {
  it("maps A_X to clarity", () => {
    const s = buildReflectionSeed(base({ primary: "A", reinforcement: "X" }));
    expect(s.focus).toBe("clarity");
    expect(s.promptTitle).toContain("clarity");
  });

  it("maps B_Y to trust", () => {
    const s = buildReflectionSeed(base({ primary: "B", reinforcement: "Y" }));
    expect(s.focus).toBe("trust");
  });

  it("uses regulation when emotionalRegulation is low (non A_X/B_Y)", () => {
    const s = buildReflectionSeed(
      base({
        primary: "C",
        reinforcement: "Y",
        meta: { relationalBias: 0.5, operationalBias: 0.5, emotionalRegulation: 0.4 },
      }),
    );
    expect(s.focus).toBe("regulation");
  });
});
