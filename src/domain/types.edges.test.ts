/**
 * domain/types — 경계 테스트 (타입·shape만).
 * types.test.ts와 중복 없이 미커버 경계만.
 */
import { describe, it, expect } from "vitest";
import type { SeasonalToCoreResult, SeasonWindow } from "./types";

describe("domain/types (edges)", () => {
  it("SeasonalToCoreResult allows coreGain 0 and fractionalBuffer 0", () => {
    const r: SeasonalToCoreResult = { rate: 45, coreGain: 0, fractionalBuffer: 0 };
    expect(r.coreGain).toBe(0);
    expect(r.fractionalBuffer).toBe(0);
  });

  it("SeasonWindow allows optional label", () => {
    const w: SeasonWindow = { id: "s1", startDate: "2026-01-01", endDate: "2026-01-31" };
    expect(w.label).toBeUndefined();
    const w2: SeasonWindow = { id: "s2", startDate: "2026-01-01", endDate: "2026-01-31", label: "Jan" };
    expect(w2.label).toBe("Jan");
  });
});
