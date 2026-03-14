/**
 * Leadership Engine — 경계 케이스 보강.
 * 기존 테스트와 중복 없이 미커버 경계만.
 */
import { describe, it, expect } from "vitest";
import {
  computeLRI,
  normalizePersonalPulse,
  type LRIInputs,
} from "./lri";
import {
  computeTII,
  computeTIIWithComponents,
  normalizeAIR,
  normalizeMWD,
  normalizeTSP,
} from "./tii";
import {
  computeAIR,
  detectIntegritySlip,
  type ActivationRecord,
  CONSECUTIVE_MISS_THRESHOLD,
} from "./air";
import {
  certifiedStatus,
  isCertified,
  CERTIFIED_AIR_14D_MIN,
  CERTIFIED_MWD_THRESHOLD_DEFAULT,
} from "./certified";
import {
  evaluateForcedReset,
  getResetDueAt,
  FORCED_RESET_STAGE3_COUNT_THRESHOLD,
  FORCED_RESET_NO_QR_DAYS_THRESHOLD,
} from "./forced-reset";

describe("leadership-engine (edges)", () => {
  // ----- LRI edges -----
  describe("LRI edges", () => {
    it("all inputs 0 yields LRI 0", () => {
      const r = computeLRI({
        air14d: 0,
        mwd14d: 0,
        personalResponsibilityPulse: 1,
        noIntegritySlipIn14d: true,
      });
      expect(r.lri).toBe(0);
      expect(r.readiness_flag).toBe(false);
    });

    it("negative air14d is clamped to 0", () => {
      const r = computeLRI({
        air14d: -0.5,
        mwd14d: 0,
        personalResponsibilityPulse: 1,
        noIntegritySlipIn14d: true,
      });
      expect(r.lri).toBe(0);
    });

    it("NaN personalResponsibilityPulse propagates as NaN (no guard)", () => {
      const r = normalizePersonalPulse(NaN);
      expect(Number.isNaN(r)).toBe(true);
    });

    it("negative pulse clamps to PULSE_MIN (result 0)", () => {
      expect(normalizePersonalPulse(-10)).toBe(0);
    });
  });

  // ----- TII edges -----
  describe("TII edges", () => {
    it("normalizeAIR above 1 clamps to 1", () => {
      expect(normalizeAIR(1.5)).toBe(1);
      expect(normalizeAIR(2)).toBe(1);
    });

    it("normalizeAIR 0 and negative clamp to 0", () => {
      expect(normalizeAIR(0)).toBe(0);
      expect(normalizeAIR(-0.5)).toBe(0);
    });

    it("NaN avgAIR propagates as NaN (no guard)", () => {
      const tii = computeTII({ avgAIR: NaN, avgMWD: 0, tsp: 1 });
      expect(Number.isNaN(tii)).toBe(true);
    });

    it("negative targetMwd returns mwd_normalized 0", () => {
      expect(normalizeMWD(0.3, -1)).toBe(0);
    });

    it("TSP exactly at boundaries (1 and 5)", () => {
      expect(normalizeTSP(1)).toBe(0);
      expect(normalizeTSP(5)).toBe(1);
    });

    it("computeTIIWithComponents with all max returns tii ≈ 1", () => {
      const r = computeTIIWithComponents({ avgAIR: 1, avgMWD: 0.3, tsp: 5 });
      expect(r.tii).toBeCloseTo(1, 10);
      expect(r.components?.air_normalized).toBe(1);
      expect(r.components?.mwd_normalized).toBe(1);
      expect(r.components?.tsp_normalized).toBe(1);
    });

    it("NaN tsp propagates as NaN (no guard)", () => {
      expect(Number.isNaN(normalizeTSP(NaN))).toBe(true);
    });
  });

  // ----- AIR edges -----
  describe("AIR edges", () => {
    const asOf = new Date("2026-03-09T12:00:00Z");

    it("empty activations returns air 0, no slip", () => {
      const r = computeAIR([], "7d", asOf);
      expect(r.air).toBe(0);
      expect(r.missedWindows).toBe(0);
      expect(r.integritySlip).toBe(false);
    });

    it("all completed and verified yields air 1", () => {
      const acts: ActivationRecord[] = Array.from({ length: 5 }, (_, i) => ({
        activation_id: `a${i}`,
        user_id: "u1",
        type: "micro_win" as const,
        chosen_at: new Date("2026-03-08T10:00:00Z"),
        due_at: new Date("2026-03-09T10:00:00Z"),
        completed_at: new Date("2026-03-08T14:00:00Z"),
        verified: true,
      }));
      const r = computeAIR(acts, "7d", asOf);
      expect(r.air).toBe(1);
      expect(r.integritySlip).toBe(false);
    });

    it("all missed yields air 0 after penalty", () => {
      const acts: ActivationRecord[] = Array.from({ length: 4 }, (_, i) => ({
        activation_id: `m${i}`,
        user_id: "u1",
        type: "micro_win" as const,
        chosen_at: new Date("2026-03-05T10:00:00Z"),
        due_at: new Date("2026-03-06T10:00:00Z"),
        completed_at: null,
        verified: false,
      }));
      const r = computeAIR(acts, "14d", asOf);
      expect(r.air).toBe(0);
      expect(r.missedWindows).toBe(4);
      expect(r.integritySlip).toBe(true);
    });

    it("exactly 3 consecutive misses triggers integrity slip", () => {
      const acts: ActivationRecord[] = Array.from({ length: 3 }, (_, i) => ({
        activation_id: `s${i}`,
        user_id: "u1",
        type: "micro_win" as const,
        chosen_at: new Date("2026-03-07T10:00:00Z"),
        due_at: new Date(`2026-03-0${7 + i}T10:00:00Z`),
        completed_at: null,
        verified: false,
      }));
      expect(detectIntegritySlip(acts, asOf)).toBe(true);
    });

    it("2 consecutive misses does NOT trigger integrity slip", () => {
      const acts: ActivationRecord[] = Array.from({ length: 2 }, (_, i) => ({
        activation_id: `n${i}`,
        user_id: "u1",
        type: "micro_win" as const,
        chosen_at: new Date("2026-03-07T10:00:00Z"),
        due_at: new Date(`2026-03-0${7 + i}T10:00:00Z`),
        completed_at: null,
        verified: false,
      }));
      expect(detectIntegritySlip(acts, asOf)).toBe(false);
    });

    it("single activation completed yields air 1", () => {
      const acts: ActivationRecord[] = [{
        activation_id: "single",
        user_id: "u1",
        type: "reset",
        chosen_at: new Date("2026-03-08T10:00:00Z"),
        due_at: new Date("2026-03-09T10:00:00Z"),
        completed_at: new Date("2026-03-08T15:00:00Z"),
        verified: true,
      }];
      const r = computeAIR(acts, "7d", asOf);
      expect(r.air).toBe(1);
    });
  });

  // ----- Certified edges -----
  describe("certified edges", () => {
    it("exactly at threshold (0.80 AIR, 0.30 MWD) → certified", () => {
      const r = certifiedStatus({
        air14d: CERTIFIED_AIR_14D_MIN,
        mwd14d: CERTIFIED_MWD_THRESHOLD_DEFAULT,
        resetComplianceMet: true,
        noIntegritySlipIn14d: true,
      });
      expect(r.current).toBe(true);
      expect(r.reasons_missing).toHaveLength(0);
    });

    it("AIR just below threshold (0.79) → not certified", () => {
      const r = certifiedStatus({
        air14d: 0.79,
        mwd14d: 0.3,
        resetComplianceMet: true,
        noIntegritySlipIn14d: true,
      });
      expect(r.current).toBe(false);
      expect(r.reasons_missing).toContain("air_14d_ge_80");
    });

    it("MWD just below threshold (0.29) → not certified", () => {
      const r = certifiedStatus({
        air14d: 0.9,
        mwd14d: 0.29,
        resetComplianceMet: true,
        noIntegritySlipIn14d: true,
      });
      expect(r.current).toBe(false);
      expect(r.reasons_missing).toContain("mwd_14d_ge_threshold");
    });

    it("all conditions fail → 4 missing reasons", () => {
      const r = certifiedStatus({
        air14d: 0,
        mwd14d: 0,
        resetComplianceMet: false,
        noIntegritySlipIn14d: false,
      });
      expect(r.current).toBe(false);
      expect(r.reasons_missing).toHaveLength(4);
    });

    it("isCertified returns boolean matching certifiedStatus.current", () => {
      const inputs = {
        air14d: 0.9,
        mwd14d: 0.5,
        resetComplianceMet: true,
        noIntegritySlipIn14d: true,
      };
      expect(isCertified(inputs)).toBe(certifiedStatus(inputs).current);
    });
  });

  // ----- Forced Reset edges -----
  describe("forced-reset edges", () => {
    it("exactly 1 condition met → no trigger", () => {
      const r = evaluateForcedReset({
        stage3SelectedCountIn14d: FORCED_RESET_STAGE3_COUNT_THRESHOLD,
        air7dBelow70ForTwoConsecutiveWeeks: false,
        noQrVerificationDays: 0,
        tspDecliningTwoConsecutiveWeeks: false,
      });
      expect(r.shouldTrigger).toBe(false);
      expect(r.reasons).toHaveLength(1);
    });

    it("exactly 2 conditions met → trigger", () => {
      const r = evaluateForcedReset({
        stage3SelectedCountIn14d: FORCED_RESET_STAGE3_COUNT_THRESHOLD,
        air7dBelow70ForTwoConsecutiveWeeks: true,
        noQrVerificationDays: 0,
        tspDecliningTwoConsecutiveWeeks: false,
      });
      expect(r.shouldTrigger).toBe(true);
      expect(r.reasons).toHaveLength(2);
    });

    it("all 4 conditions met → trigger with 4 reasons", () => {
      const r = evaluateForcedReset({
        stage3SelectedCountIn14d: 5,
        air7dBelow70ForTwoConsecutiveWeeks: true,
        noQrVerificationDays: 10,
        tspDecliningTwoConsecutiveWeeks: true,
      });
      expect(r.shouldTrigger).toBe(true);
      expect(r.reasons).toHaveLength(4);
    });

    it("0 conditions met → no trigger, empty reasons", () => {
      const r = evaluateForcedReset({
        stage3SelectedCountIn14d: 0,
        air7dBelow70ForTwoConsecutiveWeeks: false,
        noQrVerificationDays: 0,
        tspDecliningTwoConsecutiveWeeks: false,
      });
      expect(r.shouldTrigger).toBe(false);
      expect(r.reasons).toHaveLength(0);
    });

    it("stage3 count at threshold-1 does not count", () => {
      const r = evaluateForcedReset({
        stage3SelectedCountIn14d: FORCED_RESET_STAGE3_COUNT_THRESHOLD - 1,
        air7dBelow70ForTwoConsecutiveWeeks: true,
        noQrVerificationDays: FORCED_RESET_NO_QR_DAYS_THRESHOLD,
        tspDecliningTwoConsecutiveWeeks: false,
      });
      expect(r.shouldTrigger).toBe(true);
      expect(r.reasons).toHaveLength(2);
    });

    it("noQrDays exactly at threshold counts", () => {
      const r = evaluateForcedReset({
        stage3SelectedCountIn14d: 0,
        air7dBelow70ForTwoConsecutiveWeeks: false,
        noQrVerificationDays: FORCED_RESET_NO_QR_DAYS_THRESHOLD,
        tspDecliningTwoConsecutiveWeeks: true,
      });
      expect(r.shouldTrigger).toBe(true);
    });

    it("getResetDueAt adds exactly 48 hours", () => {
      const triggered = new Date("2026-03-09T00:00:00Z");
      const due = getResetDueAt(triggered);
      expect(due.getTime() - triggered.getTime()).toBe(48 * 60 * 60 * 1000);
    });
  });
});
