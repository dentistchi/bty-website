/**
 * TII 도메인 경계 테스트.
 * tii.test.ts와 중복 없이 미커버 경계만.
 */
import { describe, it, expect } from "vitest";
import {
  computeTII,
  computeTIIWithComponents,
  normalizeMWD,
  TSP_MIN,
  TSP_MAX,
  TII_TARGET_MWD_DEFAULT,
  type TIIInputs,
  type TIIResult,
} from "./tii";

describe("tii (edges)", () => {
  it("TSP_MIN and TSP_MAX are 1 and 5", () => {
    expect(TSP_MIN).toBe(1);
    expect(TSP_MAX).toBe(5);
  });

  it("normalizeMWD with negative avgMWD returns negative (clamped by min with 1)", () => {
    const n = normalizeMWD(-0.1, TII_TARGET_MWD_DEFAULT);
    expect(n).toBeLessThan(0);
    expect(n).toBeCloseTo(-0.1 / 0.3, 10);
  });

  it("normalizeMWD with targetMwd 0 returns 0 (guard)", () => {
    expect(normalizeMWD(0.5, 0)).toBe(0);
  });

  it("normalizeMWD when avgMWD equals targetMwd returns 1", () => {
    expect(normalizeMWD(0.3, TII_TARGET_MWD_DEFAULT)).toBe(1);
    expect(normalizeMWD(0.5, 0.5)).toBe(1);
  });

  it("computeTII result stays in [0, 1] for extreme inputs", () => {
    const tii = computeTII({ avgAIR: 1, avgMWD: 10, tsp: 5 });
    expect(tii).toBeLessThanOrEqual(1);
    expect(tii).toBeGreaterThanOrEqual(0);
  });

  it("TIIResult type usage and components shape", () => {
    const result: TIIResult = computeTIIWithComponents({
      avgAIR: 0.5,
      avgMWD: 0.15,
      tsp: 3,
    });
    expect(result.tii).toBeGreaterThanOrEqual(0);
    expect(result.avg_air).toBe(0.5);
    expect(result.components?.tsp_normalized).toBe(0.5);
  });

  it("TIIInputs with optional targetMwd at boundary", () => {
    const inputs: TIIInputs = {
      avgAIR: 0,
      avgMWD: 0.3,
      tsp: 1,
      targetMwd: 0.3,
    };
    expect(computeTII(inputs)).toBeGreaterThanOrEqual(0);
  });

  it("tsp 1 yields tsp_normalized 0 in components", () => {
    const result = computeTIIWithComponents({ avgAIR: 0.5, avgMWD: 0.1, tsp: 1 });
    expect(result.components?.tsp_normalized).toBe(0);
  });

  it("tsp 5 yields tsp_normalized 1 in components", () => {
    const result = computeTIIWithComponents({ avgAIR: 0.5, avgMWD: 0.1, tsp: 5 });
    expect(result.components?.tsp_normalized).toBe(1);
  });

  it("tsp 3 yields tsp_normalized 0.5 in components", () => {
    const result = computeTIIWithComponents({ avgAIR: 0.5, avgMWD: 0.1, tsp: 3 });
    expect(result.components?.tsp_normalized).toBe(0.5);
  });
});
