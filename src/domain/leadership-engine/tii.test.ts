/**
 * Unit tests for TII (Team Integrity Index) — pure domain.
 * Single source: docs/LEADERSHIP_ENGINE_SPEC.md §6.
 */

import { describe, it, expect } from "vitest";
import {
  computeTII,
  computeTIIWithComponents,
  normalizeAIR,
  normalizeMWD,
  normalizeTSP,
  TII_TARGET_MWD_DEFAULT,
  TII_WEIGHT_AIR,
  TII_WEIGHT_MWD,
  TII_WEIGHT_TSP,
} from "./tii";

describe("normalizeAIR", () => {
  it("returns value in 0..1 as-is", () => {
    expect(normalizeAIR(0)).toBe(0);
    expect(normalizeAIR(0.5)).toBe(0.5);
    expect(normalizeAIR(1)).toBe(1);
  });
  it("clamps below 0 to 0", () => {
    expect(normalizeAIR(-0.1)).toBe(0);
  });
  it("clamps above 1 to 1", () => {
    expect(normalizeAIR(1.2)).toBe(1);
  });
});

describe("normalizeMWD", () => {
  it("returns min(mwd/target, 1) with default target", () => {
    expect(normalizeMWD(0, TII_TARGET_MWD_DEFAULT)).toBe(0);
    expect(normalizeMWD(0.15, TII_TARGET_MWD_DEFAULT)).toBe(0.5);
    expect(normalizeMWD(0.3, TII_TARGET_MWD_DEFAULT)).toBe(1);
    expect(normalizeMWD(0.6, TII_TARGET_MWD_DEFAULT)).toBe(1);
  });
  it("uses custom target when provided", () => {
    expect(normalizeMWD(0.2, 0.4)).toBe(0.5);
  });
  it("returns 0 when target <= 0", () => {
    expect(normalizeMWD(0.3, 0)).toBe(0);
  });
});

describe("normalizeTSP", () => {
  it("maps 1..5 to 0..1 via (x-1)/4", () => {
    expect(normalizeTSP(1)).toBe(0);
    expect(normalizeTSP(3)).toBe(0.5);
    expect(normalizeTSP(5)).toBe(1);
  });
  it("clamps TSP to 1..5", () => {
    expect(normalizeTSP(0)).toBe(0);
    expect(normalizeTSP(6)).toBe(1);
  });
});

describe("computeTII", () => {
  it("returns 0 when all inputs are zero", () => {
    expect(computeTII({ avgAIR: 0, avgMWD: 0, tsp: 1 })).toBe(0);
  });
  it("returns weighted sum with full AIR, MWD, TSP", () => {
    const tii = computeTII({ avgAIR: 1, avgMWD: 0.3, tsp: 5 });
    const expected = 1 * TII_WEIGHT_AIR + 1 * TII_WEIGHT_MWD + 1 * TII_WEIGHT_TSP;
    expect(tii).toBeCloseTo(expected, 10);
    expect(tii).toBeCloseTo(1, 10);
  });
  it("formula: (Avg AIR × 0.6) + (MWD_norm × 0.25) + (TSP_norm × 0.15)", () => {
    const inputs = { avgAIR: 0.8, avgMWD: 0.3, tsp: 4 };
    const airN = 0.8;
    const mwdN = 1;
    const tspN = (4 - 1) / 4;
    const expected = airN * 0.6 + mwdN * 0.25 + tspN * 0.15;
    expect(computeTII(inputs)).toBeCloseTo(expected, 10);
  });
  it("clamps AIR to 0..1", () => {
    const over = computeTII({ avgAIR: 1.5, avgMWD: 0, tsp: 1 });
    expect(over).toBeLessThanOrEqual(1);
    const under = computeTII({ avgAIR: -0.1, avgMWD: 0, tsp: 1 });
    expect(under).toBeGreaterThanOrEqual(0);
  });
  it("uses optional targetMwd", () => {
    const defaultTarget = computeTII({ avgAIR: 0, avgMWD: 0.15, tsp: 1 });
    const customTarget = computeTII({ avgAIR: 0, avgMWD: 0.15, tsp: 1, targetMwd: 0.15 });
    expect(customTarget).toBeGreaterThan(defaultTarget);
  });
});

describe("computeTIIWithComponents", () => {
  it("returns tii and team-level aggregates only (no individual AIR)", () => {
    const result = computeTIIWithComponents({ avgAIR: 0.7, avgMWD: 0.2, tsp: 3 });
    expect(result.tii).toBeCloseTo(
      0.7 * TII_WEIGHT_AIR + (0.2 / 0.3) * TII_WEIGHT_MWD + 0.5 * TII_WEIGHT_TSP,
      10
    );
    expect(result.avg_air).toBe(0.7);
    expect(result.avg_mwd).toBe(0.2);
    expect(result.tsp).toBe(3);
    expect(result.components?.air_normalized).toBe(0.7);
    expect(result.components?.mwd_normalized).toBeCloseTo(0.2 / 0.3, 10);
    expect(result.components?.tsp_normalized).toBe(0.5);
  });
  it("result is deterministic for same inputs", () => {
    const a = computeTIIWithComponents({ avgAIR: 0.5, avgMWD: 0.25, tsp: 4 });
    const b = computeTIIWithComponents({ avgAIR: 0.5, avgMWD: 0.25, tsp: 4 });
    expect(a.tii).toBe(b.tii);
  });
});
