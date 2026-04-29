import { describe, it, expect } from "vitest";
import {
  computeLRI,
  canApproveLeaderTrack,
  normalizePersonalPulse,
  LRI_WEIGHT_AIR,
  LRI_WEIGHT_MWD,
  LRI_WEIGHT_PULSE,
  LRI_READINESS_THRESHOLD,
  PULSE_MIN,
  PULSE_MAX,
  type LRIInputs,
} from "./lri";

describe("normalizePersonalPulse", () => {
  it("maps 1..5 to 0..1", () => {
    expect(normalizePersonalPulse(1)).toBe(0);
    expect(normalizePersonalPulse(5)).toBe(1);
    expect(normalizePersonalPulse(3)).toBe(0.5);
  });

  it("clamps below 1 to 1", () => {
    expect(normalizePersonalPulse(0)).toBe(0);
  });

  it("clamps above 5 to 5", () => {
    expect(normalizePersonalPulse(10)).toBe(1);
  });
});

describe("computeLRI", () => {
  it("formula: 0.50*AIR + 0.30*MWD_norm + 0.20*pulse", () => {
    const inputs: LRIInputs = {
      air14d: 1,
      mwd14d: 0.3,
      personalResponsibilityPulse: 5,
      noIntegritySlipIn14d: true,
    };
    const r = computeLRI(inputs);
    const expected =
      1 * LRI_WEIGHT_AIR + 1 * LRI_WEIGHT_MWD + 1 * LRI_WEIGHT_PULSE;
    expect(r.lri).toBeCloseTo(expected, 10);
    expect(r.lri).toBe(1);
    expect(r.readiness_flag).toBe(true);
  });

  it("readiness_flag true when LRI >= 0.80 and no integrity_slip", () => {
    const inputs: LRIInputs = {
      air14d: 0.9,
      mwd14d: 0.3,
      personalResponsibilityPulse: 4,
      noIntegritySlipIn14d: true,
    };
    const r = computeLRI(inputs);
    expect(r.lri).toBeGreaterThanOrEqual(LRI_READINESS_THRESHOLD);
    expect(r.readiness_flag).toBe(true);
  });

  it("readiness_flag false when LRI < 0.80", () => {
    const inputs: LRIInputs = {
      air14d: 0.5,
      mwd14d: 0,
      personalResponsibilityPulse: 1,
      noIntegritySlipIn14d: true,
    };
    const r = computeLRI(inputs);
    expect(r.lri).toBeLessThan(LRI_READINESS_THRESHOLD);
    expect(r.readiness_flag).toBe(false);
    expect(r.reasons.some((s) => s.includes("lri_below_threshold"))).toBe(true);
  });

  it("readiness_flag false when integrity_slip even if LRI >= 0.80", () => {
    const inputs: LRIInputs = {
      air14d: 1,
      mwd14d: 0.3,
      personalResponsibilityPulse: 5,
      noIntegritySlipIn14d: false,
    };
    const r = computeLRI(inputs);
    expect(r.lri).toBe(1);
    expect(r.readiness_flag).toBe(false);
    expect(r.reasons.some((s) => s.includes("integrity_slip"))).toBe(true);
  });

  it("returns reasons array with lri and components", () => {
    const inputs: LRIInputs = {
      air14d: 0.8,
      mwd14d: 0.2,
      personalResponsibilityPulse: 4,
      noIntegritySlipIn14d: true,
    };
    const r = computeLRI(inputs);
    expect(r.reasons.length).toBeGreaterThanOrEqual(4);
    expect(r.reasons.some((s) => s.startsWith("lri="))).toBe(true);
  });

  it("boundary: LRI exactly 0.80 with no slip gives readiness_flag true", () => {
    const inputs: LRIInputs = {
      air14d: 0.8,
      mwd14d: 0.3,
      personalResponsibilityPulse: 4,
      noIntegritySlipIn14d: true,
    };
    const r = computeLRI(inputs);
    expect(r.lri).toBeGreaterThanOrEqual(LRI_READINESS_THRESHOLD);
    expect(r.readiness_flag).toBe(true);
  });
});

describe("canApproveLeaderTrack", () => {
  it("returns true only when both candidate readiness and approver certified", () => {
    expect(canApproveLeaderTrack(true, true)).toBe(true);
  });

  it("returns false when candidate not ready", () => {
    expect(canApproveLeaderTrack(false, true)).toBe(false);
  });

  it("returns false when approver not certified", () => {
    expect(canApproveLeaderTrack(true, false)).toBe(false);
  });

  it("returns false when both false", () => {
    expect(canApproveLeaderTrack(false, false)).toBe(false);
  });
});
