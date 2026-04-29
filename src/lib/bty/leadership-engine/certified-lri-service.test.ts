import { describe, it, expect, vi } from "vitest";
import {
  getCertifiedStatus,
  isUserCertified,
  getLRI,
  approveLeaderTrack,
  type GetCertifiedInputs,
  type GetLRIInputs,
} from "./certified-lri-service";
import type { CertifiedInputs } from "@/domain/leadership-engine/certified";
import type { LRIInputs } from "@/domain/leadership-engine/lri";

describe("certified-lri-service", () => {
  const certifiedInputsAllMet: CertifiedInputs = {
    air14d: 0.85,
    mwd14d: 0.35,
    resetComplianceMet: true,
    noIntegritySlipIn14d: true,
  };

  const lriInputsReady: LRIInputs = {
    air14d: 0.9,
    mwd14d: 0.3,
    personalResponsibilityPulse: 5,
    noIntegritySlipIn14d: true,
  };

  describe("getCertifiedStatus", () => {
    it("returns certified status from getInputs", async () => {
      const getInputs: GetCertifiedInputs = vi.fn().mockResolvedValue(certifiedInputsAllMet);
      const r = await getCertifiedStatus("u1", getInputs);
      expect(r.current).toBe(true);
      expect(getInputs).toHaveBeenCalledWith("u1");
    });
  });

  describe("isUserCertified", () => {
    it("returns true when inputs meet all conditions", async () => {
      const getInputs: GetCertifiedInputs = vi.fn().mockResolvedValue(certifiedInputsAllMet);
      expect(await isUserCertified("u1", getInputs)).toBe(true);
    });

    it("returns false when AIR below threshold", async () => {
      const getInputs: GetCertifiedInputs = vi
        .fn()
        .mockResolvedValue({ ...certifiedInputsAllMet, air14d: 0.5 });
      expect(await isUserCertified("u1", getInputs)).toBe(false);
    });
  });

  describe("getLRI", () => {
    it("returns LRI result from getInputs", async () => {
      const getInputs: GetLRIInputs = vi.fn().mockResolvedValue(lriInputsReady);
      const r = await getLRI("u1", getInputs);
      expect(r.lri).toBeGreaterThanOrEqual(0.8);
      expect(r.readiness_flag).toBe(true);
      expect(getInputs).toHaveBeenCalledWith("u1");
    });
  });

  describe("approveLeaderTrack", () => {
    it("returns approved: false when candidate not ready", async () => {
      const getLRIInputs: GetLRIInputs = vi.fn().mockResolvedValue({
        ...lriInputsReady,
        noIntegritySlipIn14d: false,
      });
      const getCertifiedInputs: GetCertifiedInputs = vi
        .fn()
        .mockResolvedValue(certifiedInputsAllMet);
      const supabase = { from: vi.fn().mockReturnThis(), update: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ error: null }) };
      const r = await approveLeaderTrack(
        supabase,
        "candidate",
        "approver",
        getLRIInputs,
        getCertifiedInputs
      );
      expect(r.approved).toBe(false);
      expect(r.reason).toBe("candidate_readiness_not_met");
      expect(supabase.from).not.toHaveBeenCalled();
    });

    it("returns approved: false when approver not certified", async () => {
      const getLRIInputs: GetLRIInputs = vi.fn().mockResolvedValue(lriInputsReady);
      const getCertifiedInputs: GetCertifiedInputs = vi.fn().mockResolvedValue({
        ...certifiedInputsAllMet,
        air14d: 0.5,
      });
      const supabase = { from: vi.fn().mockReturnThis(), update: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ error: null }) };
      const r = await approveLeaderTrack(
        supabase,
        "candidate",
        "approver",
        getLRIInputs,
        getCertifiedInputs
      );
      expect(r.approved).toBe(false);
      expect(r.reason).toBe("approver_not_certified");
    });

    it("returns approved: true and updates when both ready and certified", async () => {
      const getLRIInputs: GetLRIInputs = vi.fn().mockResolvedValue(lriInputsReady);
      const getCertifiedInputs: GetCertifiedInputs = vi
        .fn()
        .mockResolvedValue(certifiedInputsAllMet);
      const eq = vi.fn().mockResolvedValue({ error: null });
      const update = vi.fn().mockReturnValue({ eq });
      const from = vi.fn().mockReturnValue({ update });
      const supabase = { from, update, eq };
      const r = await approveLeaderTrack(
        supabase,
        "candidate",
        "approver",
        getLRIInputs,
        getCertifiedInputs
      );
      expect(r.approved).toBe(true);
      expect(supabase.from).toHaveBeenCalledWith("leadership_engine_state");
      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({
          is_leader_track: true,
          leader_approver_id: "approver",
        })
      );
      expect(eq).toHaveBeenCalledWith("user_id", "candidate");
    });
  });
});
