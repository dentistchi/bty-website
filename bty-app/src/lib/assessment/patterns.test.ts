import { describe, it, expect } from "vitest";
import {
  detectPattern,
  detectBarriers,
  recommendTrack,
  buildOnePageSummary,
} from "./patterns";
import type { DimensionScores } from "./types";

function scores(overrides: Partial<DimensionScores>): DimensionScores {
  return {
    core_self_esteem: 60,
    self_compassion: 60,
    self_esteem_stability: 60,
    growth_mindset: 60,
    social_self_esteem: 60,
    ...overrides,
  };
}

describe("assessment/patterns", () => {
  it("detectPattern returns perfectionism when core high and compassion low", () => {
    const s = scores({ core_self_esteem: 70, self_compassion: 45 });
    expect(detectPattern(s)).toBe("perfectionism");
  });

  it("detectPattern returns fragile_stability when stability low", () => {
    const s = scores({ self_esteem_stability: 40 });
    expect(detectPattern(s)).toBe("fragile_stability");
  });

  it("detectPattern returns balanced when spread small and avg >= 55", () => {
    const s = scores({ core_self_esteem: 58, self_compassion: 58, self_esteem_stability: 58, growth_mindset: 58, social_self_esteem: 58 });
    expect(detectPattern(s)).toBe("balanced");
  });

  it("detectBarriers returns up to 2 lowest dimensions below 50", () => {
    const s = scores({ self_compassion: 30, self_esteem_stability: 40, core_self_esteem: 55 });
    const b = detectBarriers(s);
    expect(b).toContain("low_compassion");
    expect(b).toContain("low_stability");
    expect(b.length).toBeLessThanOrEqual(2);
  });

  it("recommendTrack returns Stability Reset when low_stability barrier", () => {
    const s = scores({ self_esteem_stability: 40 });
    expect(recommendTrack(s)).toBe("Stability Reset");
  });

  it("recommendTrack returns Compassion First when low_compassion barrier", () => {
    const s = scores({ self_compassion: 40 });
    expect(recommendTrack(s)).toBe("Compassion First");
  });

  it("buildOnePageSummary returns summaryTitle_en/ko and summaryBody_en/ko", () => {
    const s = scores({ core_self_esteem: 70, self_compassion: 45 });
    const out = buildOnePageSummary(s);
    expect(out.summaryTitle_en).toBeDefined();
    expect(out.summaryTitle_ko).toBeDefined();
    expect(out.summaryBody_en).toContain("energy map");
    expect(out.summaryBody_ko).toContain("에너지 지도");
  });
});
