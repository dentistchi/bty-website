/**
 * domain/dashboard — RECOMMENDATION_SOURCE_PRIORITY·RECOMMENDATION_SOURCE_ORDER·PROGRESS_PERCENT_DEFAULT 단위 테스트 (C3 대시보드·Q3/Q4).
 */
import { describe, it, expect } from "vitest";
import {
  RECOMMENDATION_SOURCE_PRIORITY,
  RECOMMENDATION_SOURCE_ORDER,
  PROGRESS_PERCENT_DEFAULT,
  RECOMMENDATION_SOURCE_PRIORITY_MIN,
  RECOMMENDATION_SOURCE_PRIORITY_MAX,
  DASHBOARD_RECOMMENDATION_EMPTY_PLACEHOLDER_KEY,
  DASHBOARD_LE_PROGRESS_DISPLAY_PERCENT_MIN,
  DASHBOARD_LE_PROGRESS_DISPLAY_PERCENT_MAX,
  clampDashboardLeProgressDisplayPercent,
} from "./dashboard";

describe("clampDashboardLeProgressDisplayPercent (251)", () => {
  it("caps 0–100 and rounds", () => {
    expect(DASHBOARD_LE_PROGRESS_DISPLAY_PERCENT_MIN).toBe(0);
    expect(DASHBOARD_LE_PROGRESS_DISPLAY_PERCENT_MAX).toBe(100);
    expect(clampDashboardLeProgressDisplayPercent(-1)).toBe(0);
    expect(clampDashboardLeProgressDisplayPercent(101)).toBe(100);
    expect(clampDashboardLeProgressDisplayPercent(33.6)).toBe(34);
    expect(clampDashboardLeProgressDisplayPercent(Number.NaN)).toBe(0);
  });
});

describe("DASHBOARD_RECOMMENDATION_EMPTY_PLACEHOLDER_KEY (250)", () => {
  it("is stable i18n key for empty recommendation", () => {
    expect(DASHBOARD_RECOMMENDATION_EMPTY_PLACEHOLDER_KEY).toBe(
      "dashboard.recommendation.empty_placeholder"
    );
  });
});

describe("PROGRESS_PERCENT_DEFAULT", () => {
  it("is 0 for missing progress display", () => {
    expect(PROGRESS_PERCENT_DEFAULT).toBe(0);
  });
});

describe("RECOMMENDATION_SOURCE_PRIORITY bounds", () => {
  it("MIN/MAX align with center and arena priorities", () => {
    expect(RECOMMENDATION_SOURCE_PRIORITY_MIN).toBe(RECOMMENDATION_SOURCE_PRIORITY.center);
    expect(RECOMMENDATION_SOURCE_PRIORITY_MAX).toBe(RECOMMENDATION_SOURCE_PRIORITY.arena);
    expect(RECOMMENDATION_SOURCE_PRIORITY_MIN).toBeLessThan(RECOMMENDATION_SOURCE_PRIORITY_MAX);
    expect(RECOMMENDATION_SOURCE_PRIORITY.foundry).toBeGreaterThan(
      RECOMMENDATION_SOURCE_PRIORITY_MIN
    );
    expect(RECOMMENDATION_SOURCE_PRIORITY.foundry).toBeLessThan(RECOMMENDATION_SOURCE_PRIORITY_MAX);
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

describe("RECOMMENDATION_SOURCE_ORDER", () => {
  it("orders sources by RECOMMENDATION_SOURCE_PRIORITY (arena, foundry, center)", () => {
    expect(RECOMMENDATION_SOURCE_ORDER).toEqual(["arena", "foundry", "center"]);
    const order = [...RECOMMENDATION_SOURCE_ORDER];
    const priorities = order.map((s) => RECOMMENDATION_SOURCE_PRIORITY[s]);
    for (let i = 1; i < priorities.length; i++) {
      expect(priorities[i]).toBeLessThanOrEqual(priorities[i - 1]);
    }
  });

  it("has length 3 and no duplicates", () => {
    expect(RECOMMENDATION_SOURCE_ORDER).toHaveLength(3);
    const set = new Set(RECOMMENDATION_SOURCE_ORDER);
    expect(set.size).toBe(3);
  });

  it("each source in ORDER has a numeric priority in RECOMMENDATION_SOURCE_PRIORITY", () => {
    for (const source of RECOMMENDATION_SOURCE_ORDER) {
      expect(RECOMMENDATION_SOURCE_PRIORITY).toHaveProperty(source);
      expect(typeof RECOMMENDATION_SOURCE_PRIORITY[source]).toBe("number");
    }
  });
});
