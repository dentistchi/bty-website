/**
 * domain/index — barrel re-export 경계 테스트.
 * index.test.ts와 중복 없이 미커버 경계만.
 */
import { describe, it, expect } from "vitest";
import * as domain from "./index";

describe("domain/index (edges)", () => {
  it("seasonalToCoreConversion re-export returns rate and coreGain", () => {
    const r = domain.seasonalToCoreConversion(90, 0);
    expect(r.rate).toBe(45);
    expect(r.coreGain).toBe(2);
  });
});
