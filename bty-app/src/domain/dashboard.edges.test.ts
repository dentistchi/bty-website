/**
 * domain/dashboard — barrel/export 경계 테스트 (Q3 대시보드 추천·C3 도메인).
 * dashboard.test.ts와 중복 없이 export 경계만.
 */
import { describe, it, expect } from "vitest";
import {
  PROGRESS_PERCENT_DEFAULT,
  RECOMMENDATION_SOURCE_ORDER,
  RECOMMENDATION_SOURCE_PRIORITY,
} from "./dashboard";

describe("domain/dashboard (edges)", () => {
  it("exports RECOMMENDATION_SOURCE_PRIORITY with arena, foundry, center keys", () => {
    expect(RECOMMENDATION_SOURCE_PRIORITY).toHaveProperty("arena");
    expect(RECOMMENDATION_SOURCE_PRIORITY).toHaveProperty("foundry");
    expect(RECOMMENDATION_SOURCE_PRIORITY).toHaveProperty("center");
    expect(Object.keys(RECOMMENDATION_SOURCE_PRIORITY).sort()).toEqual(
      ["arena", "center", "foundry"]
    );
  });

  it("exports PROGRESS_PERCENT_DEFAULT as number", () => {
    expect(typeof PROGRESS_PERCENT_DEFAULT).toBe("number");
    expect(PROGRESS_PERCENT_DEFAULT).toBe(0);
  });

  it("exports RECOMMENDATION_SOURCE_ORDER as readonly array of three sources", () => {
    expect(Array.isArray(RECOMMENDATION_SOURCE_ORDER)).toBe(true);
    expect(RECOMMENDATION_SOURCE_ORDER).toHaveLength(3);
    expect(RECOMMENDATION_SOURCE_ORDER).toContain("arena");
    expect(RECOMMENDATION_SOURCE_ORDER).toContain("foundry");
    expect(RECOMMENDATION_SOURCE_ORDER).toContain("center");
  });

  it("RECOMMENDATION_SOURCE_ORDER has exact order arena, foundry, center", () => {
    expect([...RECOMMENDATION_SOURCE_ORDER]).toEqual(["arena", "foundry", "center"]);
  });

  it("RECOMMENDATION_SOURCE_PRIORITY values are numbers", () => {
    expect(typeof RECOMMENDATION_SOURCE_PRIORITY.arena).toBe("number");
    expect(typeof RECOMMENDATION_SOURCE_PRIORITY.foundry).toBe("number");
    expect(typeof RECOMMENDATION_SOURCE_PRIORITY.center).toBe("number");
  });

  it("RECOMMENDATION_SOURCE_PRIORITY values are distinct", () => {
    const vals = [
      RECOMMENDATION_SOURCE_PRIORITY.arena,
      RECOMMENDATION_SOURCE_PRIORITY.foundry,
      RECOMMENDATION_SOURCE_PRIORITY.center,
    ];
    expect(new Set(vals).size).toBe(3);
  });

  it("RECOMMENDATION_SOURCE_PRIORITY values are non-negative", () => {
    expect(RECOMMENDATION_SOURCE_PRIORITY.arena).toBeGreaterThanOrEqual(0);
    expect(RECOMMENDATION_SOURCE_PRIORITY.foundry).toBeGreaterThanOrEqual(0);
    expect(RECOMMENDATION_SOURCE_PRIORITY.center).toBeGreaterThanOrEqual(0);
  });
});
