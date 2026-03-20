import { describe, it, expect } from "vitest";
import {
  ARENA_DASHBOARD_SOURCE_VALUES,
  arenaRecommendationSourceFromParam,
} from "./arenaRecommendationSourceFromParam";

describe("arenaRecommendationSourceFromParam (edges)", () => {
  it("returns null for null, undefined, empty", () => {
    expect(arenaRecommendationSourceFromParam(null)).toBe(null);
    expect(arenaRecommendationSourceFromParam(undefined)).toBe(null);
    expect(arenaRecommendationSourceFromParam("")).toBe(null);
    expect(arenaRecommendationSourceFromParam("   ")).toBe(null);
  });

  it("returns source for valid values (case-insensitive)", () => {
    expect(arenaRecommendationSourceFromParam("arena")).toBe("arena");
    expect(arenaRecommendationSourceFromParam("Arena")).toBe("arena");
    expect(arenaRecommendationSourceFromParam("foundry")).toBe("foundry");
    expect(arenaRecommendationSourceFromParam("center")).toBe("center");
  });

  it("returns null for invalid value", () => {
    expect(arenaRecommendationSourceFromParam("other")).toBe(null);
  });

  it("constant has three values", () => {
    expect(ARENA_DASHBOARD_SOURCE_VALUES).toHaveLength(3);
  });
});
