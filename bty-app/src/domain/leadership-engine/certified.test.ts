import { describe, it, expect } from "vitest";
import {
  isCertified,
  certifiedStatus,
  CERTIFIED_AIR_14D_MIN,
  CERTIFIED_MWD_THRESHOLD_DEFAULT,
  type CertifiedInputs,
} from "./certified";

describe("certifiedStatus / isCertified", () => {
  const allMet: CertifiedInputs = {
    air14d: 0.85,
    mwd14d: 0.35,
    resetComplianceMet: true,
    noIntegritySlipIn14d: true,
  };

  it("returns current true when all conditions met", () => {
    const r = certifiedStatus(allMet);
    expect(r.current).toBe(true);
    expect(r.reasons_missing).toHaveLength(0);
    expect(r.reasons_met).toContain("air_14d_ge_80");
    expect(r.reasons_met).toContain("mwd_14d_ge_threshold");
    expect(r.reasons_met).toContain("reset_compliance_met");
    expect(r.reasons_met).toContain("no_integrity_slip_in_14d");
  });

  it("isCertified returns true when all conditions met", () => {
    expect(isCertified(allMet)).toBe(true);
  });

  it("returns current false when AIR_14d < 0.80", () => {
    const r = certifiedStatus({ ...allMet, air14d: 0.75 });
    expect(r.current).toBe(false);
    expect(r.reasons_missing).toContain("air_14d_ge_80");
  });

  it("returns current false when MWD_14d below threshold", () => {
    const r = certifiedStatus({ ...allMet, mwd14d: 0.1 });
    expect(r.current).toBe(false);
    expect(r.reasons_missing).toContain("mwd_14d_ge_threshold");
  });

  it("uses custom mwdThreshold when provided", () => {
    const r = certifiedStatus({
      ...allMet,
      mwd14d: 0.25,
      mwdThreshold: 0.2,
    });
    expect(r.current).toBe(true);
    const r2 = certifiedStatus({
      ...allMet,
      mwd14d: 0.25,
      mwdThreshold: 0.3,
    });
    expect(r2.current).toBe(false);
  });

  it("returns current false when reset compliance not met", () => {
    const r = certifiedStatus({ ...allMet, resetComplianceMet: false });
    expect(r.current).toBe(false);
    expect(r.reasons_missing).toContain("reset_compliance_met");
  });

  it("returns current false when integrity_slip in 14d", () => {
    const r = certifiedStatus({ ...allMet, noIntegritySlipIn14d: false });
    expect(r.current).toBe(false);
    expect(r.reasons_missing).toContain("no_integrity_slip_in_14d");
  });

  it("boundary: AIR_14d exactly 0.80 passes", () => {
    const r = certifiedStatus({ ...allMet, air14d: CERTIFIED_AIR_14D_MIN });
    expect(r.current).toBe(true);
  });

  it("boundary: MWD_14d exactly at default threshold passes", () => {
    const r = certifiedStatus({
      ...allMet,
      mwd14d: CERTIFIED_MWD_THRESHOLD_DEFAULT,
    });
    expect(r.current).toBe(true);
  });

  it("multiple reasons_missing when several conditions fail", () => {
    const r = certifiedStatus({
      air14d: 0.5,
      mwd14d: 0.1,
      resetComplianceMet: false,
      noIntegritySlipIn14d: false,
    });
    expect(r.current).toBe(false);
    expect(r.reasons_missing).toHaveLength(4);
  });
});
