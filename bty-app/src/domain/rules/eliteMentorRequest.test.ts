import { describe, it, expect } from "vitest";
import {
  canEliteMentorAdminTransition,
  eliteMentorAdminActionEligibility,
  applyEliteMentorAdminDecision,
  isEliteMentorQueueTerminal,
  compareEliteMentorQueueRows,
  eliteMentorRequestTerminalLabelKey,
  isEliteMentorRequestPendingStale,
  eliteMentorPendingStaleLabelKey,
  ELITE_MENTOR_PENDING_STALE_DAYS,
  isEliteMentorApprovedActiveAtCap,
  canEliteMentorApproveWithoutCapViolation,
  ELITE_MENTOR_APPROVED_ACTIVE_CAP,
  eliteMentorDuplicateApplicationBlockKey,
  ELITE_MENTOR_DUPLICATE_PENDING_KEY,
  eliteMentorResponseSlaWarningKey,
  ELITE_MENTOR_RESPONSE_SLA_WARNING_DAYS,
  eliteMentorRequestStatusDisplayLabelKey,
} from "./eliteMentorRequest";

describe("eliteMentorRequest (domain)", () => {
  it("canEliteMentorAdminTransition: only pending → approved|rejected", () => {
    expect(canEliteMentorAdminTransition("pending", "approved")).toBe(true);
    expect(canEliteMentorAdminTransition("pending", "rejected")).toBe(true);
    expect(canEliteMentorAdminTransition("pending", "pending")).toBe(false);
    expect(canEliteMentorAdminTransition("approved", "rejected")).toBe(false);
    expect(canEliteMentorAdminTransition("rejected", "approved")).toBe(false);
  });

  it("eliteMentorAdminActionEligibility: pending만 버튼 허용", () => {
    expect(eliteMentorAdminActionEligibility("pending")).toEqual({
      mayApprove: true,
      mayReject: true,
    });
    expect(eliteMentorAdminActionEligibility("approved")).toEqual({
      mayApprove: false,
      mayReject: false,
    });
    expect(eliteMentorAdminActionEligibility("rejected")).toEqual({
      mayApprove: false,
      mayReject: false,
    });
  });

  it("applyEliteMentorAdminDecision: pending만 결과 상태로 매핑", () => {
    expect(applyEliteMentorAdminDecision("pending", "approve")).toBe("approved");
    expect(applyEliteMentorAdminDecision("pending", "reject")).toBe("rejected");
    expect(applyEliteMentorAdminDecision("approved", "reject")).toBeNull();
    expect(applyEliteMentorAdminDecision("rejected", "approve")).toBeNull();
  });

  it("isEliteMentorQueueTerminal: approved/rejected만 terminal", () => {
    expect(isEliteMentorQueueTerminal("pending")).toBe(false);
    expect(isEliteMentorQueueTerminal("approved")).toBe(true);
    expect(isEliteMentorQueueTerminal("rejected")).toBe(true);
  });

  it("eliteMentorResponseSlaWarningKey after 7d pending", () => {
    const now = 10_000_000_000_000;
    const old = now - (ELITE_MENTOR_RESPONSE_SLA_WARNING_DAYS + 1) * 86_400_000;
    expect(eliteMentorResponseSlaWarningKey("pending", old, now)).toBe(
      "elite_mentor_sla_response_imminent"
    );
    expect(
      eliteMentorResponseSlaWarningKey("pending", now - 86_400_000, now)
    ).toBeNull();
    expect(eliteMentorResponseSlaWarningKey("approved", old, now)).toBeNull();
  });

  it("249: eliteMentorRequestStatusDisplayLabelKey all statuses", () => {
    expect(eliteMentorRequestStatusDisplayLabelKey("pending")).toBe(
      "elite_mentor_status_pending"
    );
    expect(eliteMentorRequestStatusDisplayLabelKey("approved")).toBe(
      "elite_mentor_status_approved"
    );
    expect(eliteMentorRequestStatusDisplayLabelKey("rejected")).toBe(
      "elite_mentor_status_rejected"
    );
  });

  it("eliteMentorDuplicateApplicationBlockKey pending only", () => {
    expect(eliteMentorDuplicateApplicationBlockKey(null)).toBeNull();
    expect(eliteMentorDuplicateApplicationBlockKey("approved")).toBeNull();
    expect(eliteMentorDuplicateApplicationBlockKey("pending")).toBe(
      ELITE_MENTOR_DUPLICATE_PENDING_KEY
    );
  });

  it("Elite approved active cap", () => {
    expect(canEliteMentorApproveWithoutCapViolation(0)).toBe(true);
    expect(canEliteMentorApproveWithoutCapViolation(ELITE_MENTOR_APPROVED_ACTIVE_CAP - 1)).toBe(
      true
    );
    expect(isEliteMentorApprovedActiveAtCap(ELITE_MENTOR_APPROVED_ACTIVE_CAP)).toBe(true);
    expect(canEliteMentorApproveWithoutCapViolation(ELITE_MENTOR_APPROVED_ACTIVE_CAP)).toBe(
      false
    );
  });

  it("isEliteMentorRequestPendingStale after 14d pending only", () => {
    const now = 1_000_000_000_000;
    const old = now - (ELITE_MENTOR_PENDING_STALE_DAYS + 1) * 86_400_000;
    expect(isEliteMentorRequestPendingStale("pending", old, now)).toBe(true);
    expect(isEliteMentorRequestPendingStale("pending", now - 86_400_000, now)).toBe(
      false
    );
    expect(isEliteMentorRequestPendingStale("approved", old, now)).toBe(false);
    expect(eliteMentorPendingStaleLabelKey("pending", old, now)).toBe(
      "elite_mentor_pending_stale"
    );
  });

  it("eliteMentorRequestTerminalLabelKey: terminal only", () => {
    expect(eliteMentorRequestTerminalLabelKey("pending")).toBeNull();
    expect(eliteMentorRequestTerminalLabelKey("approved")).toBe(
      "elite_mentor_terminal_approved"
    );
    expect(eliteMentorRequestTerminalLabelKey("rejected")).toBe(
      "elite_mentor_terminal_rejected"
    );
  });

  it("compareEliteMentorQueueRows: pending first, then time, then id", () => {
    const a = { status: "approved" as const, createdAtMs: 1, id: "a" };
    const p = { status: "pending" as const, createdAtMs: 99, id: "z" };
    expect(compareEliteMentorQueueRows(p, a)).toBeLessThan(0);
    expect(
      compareEliteMentorQueueRows(
        { status: "pending", createdAtMs: 2, id: "b" },
        { status: "pending", createdAtMs: 1, id: "a" }
      )
    ).toBeGreaterThan(0);
    expect(
      compareEliteMentorQueueRows(
        { status: "pending", createdAtMs: 1, id: "a" },
        { status: "pending", createdAtMs: 1, id: "b" }
      )
    ).toBeLessThan(0);
  });
});
