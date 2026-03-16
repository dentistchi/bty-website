/**
 * domain/dashboard — RECOMMENDATION_SOURCE_PRIORITY·PROGRESS_PERCENT_DEFAULT 단위 테스트 (C3 대시보드·Q3/Q4).
 */
import { describe, it, expect } from "vitest";
import { RECOMMENDATION_SOURCE_PRIORITY, PROGRESS_PERCENT_DEFAULT } from "./dashboard";

describe("PROGRESS_PERCENT_DEFAULT", () => {
  it("is 0 for missing progress display", () => {
    expect(PROGRESS_PERCENT_DEFAULT).toBe(0);
  });
});

describe("RECOMMENDATION_SOURCE_PRIORITY", () => {
  it("defines numeric priority for arena, foundry, center with arena highest", () => {
    expect(RECOMMENDATION_SOURCE_PRIORITY.arena).toBe(30);
    expect(RECOMMENDATION_SOURCE_PRIORITY.foundry).toBe(20);
    expect(RECOMMENDATION_SOURCE_PRIORITY.center).toBe(10);
    expect(RECOMMENDATION_SOURCE_PRIORITY.arena).toBeGreaterThan(RECOMMENDATION_SOURCE_PRIORITY.foundry);
    expect(RECOMMENDATION_SOURCE_PRIORITY.foundry).toBeGreaterThan(RECOMMENDATION_SOURCE_PRIORITY.center);
  });
});
