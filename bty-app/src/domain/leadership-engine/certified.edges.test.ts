/**
 * Leadership-engine certified 도메인 경계 테스트.
 * certified.test.ts와 중복 없이 미커버 경계만.
 */
import { describe, it, expect } from "vitest";
import {
  certifiedStatus,
  isCertified,
  CERTIFIED_AIR_14D_MIN,
  CERTIFIED_MWD_THRESHOLD_DEFAULT,
  type CertifiedInputs,
  type CertifiedStatusResult,
} from "./certified";

const baseInputs: CertifiedInputs = {
  air14d: 0.85,
  mwd14d: 0.35,
  resetComplianceMet: true,
  noIntegritySlipIn14d: true,
};

describe("certified (edges)", () => {
  it("air14d just below 0.80 fails", () => {
    const r = certifiedStatus({ ...baseInputs, air14d: 0.799 });
    expect(r.current).toBe(false);
    expect(r.reasons_missing).toContain("air_14d_ge_80");
  });

  it("air14d exactly 0.80 passes air condition", () => {
    const r = certifiedStatus({ ...baseInputs, air14d: 0.8 });
    expect(r.reasons_met).toContain("air_14d_ge_80");
  });

  it("mwd14d just below default threshold fails MWD", () => {
    const r = certifiedStatus({
      ...baseInputs,
      mwd14d: CERTIFIED_MWD_THRESHOLD_DEFAULT - 0.01,
    });
    expect(r.reasons_missing).toContain("mwd_14d_ge_threshold");
  });

  it("mwd14d exactly at default threshold passes MWD", () => {
    const r = certifiedStatus({
      ...baseInputs,
      mwd14d: CERTIFIED_MWD_THRESHOLD_DEFAULT,
    });
    expect(r.reasons_met).toContain("mwd_14d_ge_threshold");
  });

  it("mwd14d zero with zero mwdThreshold passes MWD (0 >= 0)", () => {
    const r = certifiedStatus({
      ...baseInputs,
      mwd14d: 0,
      mwdThreshold: 0,
    });
    expect(r.reasons_met).toContain("mwd_14d_ge_threshold");
    expect(r.reasons_missing).not.toContain("mwd_14d_ge_threshold");
  });

  it("constants are stable for re-export", () => {
    expect(CERTIFIED_AIR_14D_MIN).toBe(0.8);
    expect(CERTIFIED_MWD_THRESHOLD_DEFAULT).toBeGreaterThan(0);
  });

  it("isCertified returns true when all conditions met", () => {
    expect(isCertified(baseInputs)).toBe(true);
  });

  it("noIntegritySlipIn14d false with rest met yields current false", () => {
    const r = certifiedStatus({ ...baseInputs, noIntegritySlipIn14d: false });
    expect(r.current).toBe(false);
    expect(r.reasons_missing).toContain("no_integrity_slip_in_14d");
  });

  it("resetComplianceMet false with rest met yields current false", () => {
    const r = certifiedStatus({ ...baseInputs, resetComplianceMet: false });
    expect(r.current).toBe(false);
    expect(r.reasons_missing).toContain("reset_compliance_met");
  });

  it("CertifiedStatusResult shape when all missing", () => {
    const r: CertifiedStatusResult = certifiedStatus({
      air14d: 0,
      mwd14d: 0,
      resetComplianceMet: false,
      noIntegritySlipIn14d: false,
    });
    expect(r.current).toBe(false);
    expect(r.reasons_met).toHaveLength(0);
    expect(r.reasons_missing).toHaveLength(4);
    expect(isCertified({
      air14d: 0,
      mwd14d: 0,
      resetComplianceMet: false,
      noIntegritySlipIn14d: false,
    })).toBe(false);
  });
});
