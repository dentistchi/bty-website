/**
 * C6 240 — Elite 멘토 큐(도메인) + Healing Awakening 완료 가드 엣지.
 */
import { describe, it, expect } from "vitest";
import {
  eliteMentorAdminActionEligibility,
  canEliteMentorAdminTransition,
} from "./rules/eliteMentorRequest";
import { canCompleteHealingAwakeningAct } from "./healing";

describe("240 elite mentor + healing edges", () => {
  it("Elite: approved/rejected rows — 승인·거절 버튼 비활성(eligibility)", () => {
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

  it("Elite: domain transition only pending → approved|rejected", () => {
    expect(canEliteMentorAdminTransition("pending", "approved")).toBe(true);
    expect(canEliteMentorAdminTransition("rejected", "approved")).toBe(false);
    expect(canEliteMentorAdminTransition("approved", "rejected")).toBe(false);
  });

  it("Healing: act 3 완료는 act 1·2 완료 없이 불가", () => {
    expect(canCompleteHealingAwakeningAct(3, [])).toBe(false);
    expect(canCompleteHealingAwakeningAct(3, [1])).toBe(false);
    expect(canCompleteHealingAwakeningAct(3, [1, 2])).toBe(true);
  });
});
