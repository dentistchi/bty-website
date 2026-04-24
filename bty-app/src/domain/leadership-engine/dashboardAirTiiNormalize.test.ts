import { describe, it, expect } from "vitest";
import {
  normalizeDashboardAirTiiSummary,
  normalizeDashboardAirTiiRollingSummary,
} from "./dashboardAirTiiNormalize";

describe("normalizeDashboardAirTiiSummary", () => {
  it("clamps AIR and maps bands; TII when team fields present", () => {
    const r = normalizeDashboardAirTiiSummary({
      air_7d: 0.35,
      air_14d: 0.85,
      avg_air_team: 1,
      avg_mwd: 0.3,
      tsp: 5,
      integrity_slip: true,
    });
    expect(r.air_7d).toBe(0.35);
    expect(r.band_7d).toBe("low");
    expect(r.band_14d).toBe("high");
    expect(r.tii).toBeGreaterThan(0.9);
    expect(r.integrity_slip).toBe(true);
  });

  it("tii null when team aggregates incomplete", () => {
    const r = normalizeDashboardAirTiiSummary({
      air_7d: 0.5,
      air_14d: 0.5,
      avg_air_team: 0.8,
    });
    expect(r.tii).toBeNull();
    expect(r.band_7d).toBe("mid");
  });

  it("nullish AIR defaults to 0 → low band", () => {
    const r = normalizeDashboardAirTiiSummary({});
    expect(r.air_7d).toBe(0);
    expect(r.band_7d).toBe("low");
  });

  it("normalizeDashboardAirTiiRollingSummary adds 90d band", () => {
    const r = normalizeDashboardAirTiiRollingSummary({
      air_7d: 0.5,
      air_14d: 0.5,
      air_90d: 0.75,
    });
    expect(r.air_90d).toBe(0.75);
    expect(r.band_90d).toBe("mid");
    expect(r.band_7d).toBe("mid");
  });
});
