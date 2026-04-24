import { describe, expect, it } from "vitest";
import { computeMetrics } from "@/features/arena/logic/computeMetrics";
import type { ArenaSignal } from "@/features/my-page/logic/types";
import { computeLeadershipState } from "./computeLeadershipState";

const rich: ArenaSignal = {
  scenarioId: "s1",
  primary: "A",
  reinforcement: "X",
  traits: { Insight: 0.85, Communication: 0.85, Integrity: 0.8 },
  meta: { relationalBias: 0.9, operationalBias: 0.3, emotionalRegulation: 0.85 },
  timestamp: 1,
};

describe("computeLeadershipState", () => {
  it("returns dormant copy when no signals", () => {
    const m = computeMetrics([]);
    const s = computeLeadershipState(m, "en");
    expect(m.signalCount).toBe(0);
    expect(s.headline).toMatch(/No Arena patterns/i);
  });

  it("returns high-tier labels for strong metrics", () => {
    const m = computeMetrics([rich, rich]);
    const s = computeLeadershipState(m, "en");
    expect(s.airLabel).toMatch(/execution integrity|실행 무결성/i);
    expect(s.tiiLabel).toContain("High");
  });
});
