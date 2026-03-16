/**
 * domain/dashboard — barrel/export 경계 테스트 (Q3 대시보드 추천·C3 도메인).
 * dashboard.test.ts와 중복 없이 export 경계만.
 */
import { describe, it, expect } from "vitest";
import {
  PROGRESS_PERCENT_DEFAULT,
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
});
