/**
 * domain/dashboard — RECOMMENDATION_SOURCE_PRIORITY 단위 테스트 (C3 대시보드 소스별 우선순위 대응).
 */
import { describe, it, expect } from "vitest";
import { RECOMMENDATION_SOURCE_PRIORITY } from "./dashboard";

describe("RECOMMENDATION_SOURCE_PRIORITY", () => {
  it("defines numeric priority for arena, foundry, center with arena highest", () => {
    expect(RECOMMENDATION_SOURCE_PRIORITY.arena).toBe(30);
    expect(RECOMMENDATION_SOURCE_PRIORITY.foundry).toBe(20);
    expect(RECOMMENDATION_SOURCE_PRIORITY.center).toBe(10);
    expect(RECOMMENDATION_SOURCE_PRIORITY.arena).toBeGreaterThan(RECOMMENDATION_SOURCE_PRIORITY.foundry);
    expect(RECOMMENDATION_SOURCE_PRIORITY.foundry).toBeGreaterThan(RECOMMENDATION_SOURCE_PRIORITY.center);
  });
});
