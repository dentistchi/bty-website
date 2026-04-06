import { describe, expect, it } from "vitest";
import { routeLayer2Outcome } from "./routeLayer2Outcome";
import type { Layer2ModelResult } from "./types";

function base(allPass: boolean): Layer2ModelResult {
  const o = allPass ? ("pass" as const) : ("fail" as const);
  const c = 0.95;
  return {
    re_entry_direction: { outcome: o, confidence: c },
    external_measurability: { outcome: o, confidence: c },
    non_cosmetic: { outcome: o, confidence: c },
  };
}

describe("routeLayer2Outcome", () => {
  it("approves when all pass and confidence >= 0.7", () => {
    expect(routeLayer2Outcome(base(true))).toBe("approve");
  });

  it("rejects when all confidences >= 0.7 and any fail", () => {
    const p: Layer2ModelResult = {
      re_entry_direction: { outcome: "pass", confidence: 0.9 },
      external_measurability: { outcome: "fail", confidence: 0.85 },
      non_cosmetic: { outcome: "pass", confidence: 0.8 },
    };
    expect(routeLayer2Outcome(p)).toBe("reject");
  });

  it("escalates when any confidence < 0.7 (mixed-signal)", () => {
    const p: Layer2ModelResult = {
      re_entry_direction: { outcome: "fail", confidence: 0.95 },
      external_measurability: { outcome: "pass", confidence: 0.65 },
      non_cosmetic: { outcome: "pass", confidence: 0.9 },
    };
    expect(routeLayer2Outcome(p)).toBe("escalate");
  });

  it("escalates on ambiguous even if other criteria fail", () => {
    const p: Layer2ModelResult = {
      re_entry_direction: { outcome: "ambiguous", confidence: 0.99 },
      external_measurability: { outcome: "fail", confidence: 0.99 },
      non_cosmetic: { outcome: "pass", confidence: 0.99 },
    };
    expect(routeLayer2Outcome(p)).toBe("escalate");
  });
});
