/**
 * Healing / Awakening domain — constants and types (Q4).
 */
import { describe, it, expect } from "vitest";
import {
  AWAKENING_ACT_NAMES,
  AWAKENING_TRIGGER_DAY,
  AWAKENING_TRIGGER_MIN_SESSIONS,
  HEALING_PHASE_I_LABEL,
  HEALING_PHASE_II_LABEL,
  HEALING_PHASE_RING_TYPE,
  isValidHealingAwakeningActId,
  nextHealingAwakeningActAfter,
  canCompleteHealingAwakeningAct,
  isHealingAwakeningCompletionHistoryValid,
  healingAwakeningNextUnlockedAfterCompleting,
  isHealingAwakeningAllActsComplete,
  healingAwakeningProgressPercent,
  healingProgressGetPostMismatchMessageKey,
  isSecondAwakeningEligible,
  healingAwakeningActBlockedMessageKey,
  healingAwakeningActLockReasonDisplayKey,
  secondAwakeningJourneyCompleteMessageKeys,
  HEALING_AWAKENING_PROGRESS_PERCENT_MIN,
  HEALING_AWAKENING_PROGRESS_PERCENT_MAX,
  clampHealingAwakeningActProgressDisplayPercent,
  HEALING_PROGRESS_BLOCKED_COOLDOWN_DISPLAY_KEY,
  HEALING_PROGRESS_BLOCKED_PHASE_DISPLAY_KEY,
  healingPathProgressBlockedUserDisplayKey,
} from "./healing";

describe("healing domain", () => {
  it("AWAKENING_ACT_NAMES has entries for act 1, 2, 3", () => {
    expect(AWAKENING_ACT_NAMES[1]).toBe("Reflection Chamber");
    expect(AWAKENING_ACT_NAMES[2]).toBe("Transition");
    expect(AWAKENING_ACT_NAMES[3]).toBe("Awakening");
  });

  it("AWAKENING_ACT_NAMES has exactly three keys (1, 2, 3)", () => {
    expect(Object.keys(AWAKENING_ACT_NAMES)).toEqual(["1", "2", "3"]);
  });

  it("HEALING_PHASE_I_LABEL and HEALING_PHASE_II_LABEL are Phase I and Phase II", () => {
    expect(HEALING_PHASE_I_LABEL).toBe("Phase I");
    expect(HEALING_PHASE_II_LABEL).toBe("Phase II");
  });

  it("HEALING_PHASE_RING_TYPE is phase_ring", () => {
    expect(HEALING_PHASE_RING_TYPE).toBe("phase_ring");
  });

  it("AWAKENING_TRIGGER_DAY and AWAKENING_TRIGGER_MIN_SESSIONS match spec defaults", () => {
    expect(AWAKENING_TRIGGER_DAY).toBe(30);
    expect(AWAKENING_TRIGGER_MIN_SESSIONS).toBe(10);
  });

  it("AWAKENING_TRIGGER_DAY and AWAKENING_TRIGGER_MIN_SESSIONS are numbers", () => {
    expect(typeof AWAKENING_TRIGGER_DAY).toBe("number");
    expect(typeof AWAKENING_TRIGGER_MIN_SESSIONS).toBe("number");
  });

  it("238: isValidHealingAwakeningActId only 1–3", () => {
    expect(isValidHealingAwakeningActId(1)).toBe(true);
    expect(isValidHealingAwakeningActId(4)).toBe(false);
    expect(isValidHealingAwakeningActId("2")).toBe(false);
  });

  it("238: nextHealingAwakeningActAfter sequential path", () => {
    expect(nextHealingAwakeningActAfter([])).toBe(1);
    expect(nextHealingAwakeningActAfter([1])).toBe(2);
    expect(nextHealingAwakeningActAfter([1, 2])).toBe(3);
    expect(nextHealingAwakeningActAfter([1, 2, 3])).toBeNull();
    expect(nextHealingAwakeningActAfter([2])).toBeNull();
  });

  it("239: canCompleteHealingAwakeningAct mirrors next-act path", () => {
    expect(canCompleteHealingAwakeningAct(1, [])).toBe(true);
    expect(canCompleteHealingAwakeningAct(1, [1])).toBe(false);
    expect(canCompleteHealingAwakeningAct(2, [])).toBe(false);
    expect(canCompleteHealingAwakeningAct(2, [1])).toBe(true);
    expect(canCompleteHealingAwakeningAct(3, [1, 2])).toBe(true);
    expect(canCompleteHealingAwakeningAct(3, [1])).toBe(false);
  });

  it("240: isHealingAwakeningCompletionHistoryValid order and no duplicate", () => {
    expect(isHealingAwakeningCompletionHistoryValid([])).toBe(true);
    expect(isHealingAwakeningCompletionHistoryValid([1])).toBe(true);
    expect(isHealingAwakeningCompletionHistoryValid([1, 2])).toBe(true);
    expect(isHealingAwakeningCompletionHistoryValid([1, 2, 3])).toBe(true);
    expect(isHealingAwakeningCompletionHistoryValid([2])).toBe(false);
    expect(isHealingAwakeningCompletionHistoryValid([1, 1])).toBe(false);
    expect(isHealingAwakeningCompletionHistoryValid([1, 3])).toBe(false);
    expect(isHealingAwakeningCompletionHistoryValid([1, 2, 3, 1])).toBe(false);
  });

  it("241: healingAwakeningNextUnlockedAfterCompleting", () => {
    expect(healingAwakeningNextUnlockedAfterCompleting(1, [])).toBe(2);
    expect(healingAwakeningNextUnlockedAfterCompleting(2, [1])).toBe(3);
    expect(healingAwakeningNextUnlockedAfterCompleting(3, [1, 2])).toBe("all_done");
    expect(healingAwakeningNextUnlockedAfterCompleting(2, [])).toBeNull();
  });

  it("242: isHealingAwakeningAllActsComplete", () => {
    expect(isHealingAwakeningAllActsComplete([])).toBe(false);
    expect(isHealingAwakeningAllActsComplete([1, 2])).toBe(false);
    expect(isHealingAwakeningAllActsComplete([1, 2, 3])).toBe(true);
    expect(isHealingAwakeningAllActsComplete([3, 1, 2])).toBe(true);
  });

  it("243: healingAwakeningProgressPercent 0–100", () => {
    expect(healingAwakeningProgressPercent([])).toBe(0);
    expect(healingAwakeningProgressPercent([1])).toBe(33);
    expect(healingAwakeningProgressPercent([1, 2])).toBe(67);
    expect(healingAwakeningProgressPercent([1, 2, 3])).toBe(100);
    expect(healingAwakeningProgressPercent([1, 1, 2])).toBe(67);
  });

  it("244: healingProgressGetPostMismatchMessageKey", () => {
    expect(healingProgressGetPostMismatchMessageKey({ getProgressPercent: 33, postClaimedPercent: 33 })).toBeNull();
    expect(
      healingProgressGetPostMismatchMessageKey({ getProgressPercent: 33, postClaimedPercent: 67 })
    ).toBe("healing_sync_mismatch_client_ahead");
    expect(
      healingProgressGetPostMismatchMessageKey({ getProgressPercent: 67, postClaimedPercent: 33 })
    ).toBe("healing_sync_mismatch_server_ahead");
  });

  it("247: secondAwakeningJourneyCompleteMessageKeys", () => {
    expect(secondAwakeningJourneyCompleteMessageKeys([])).toBeNull();
    expect(secondAwakeningJourneyCompleteMessageKeys([1, 2])).toBeNull();
    const keys = secondAwakeningJourneyCompleteMessageKeys([1, 2, 3]);
    expect(keys?.congrats).toBe("awakening_journey_complete_congrats");
    expect(keys?.nextStep).toBe("awakening_journey_complete_next_explore");
  });

  it("249: healingAwakeningActLockReasonDisplayKey", () => {
    expect(healingAwakeningActLockReasonDisplayKey(1, [])).toBeNull();
    expect(healingAwakeningActLockReasonDisplayKey(1, [1])).toBe(
      "healing_act_lock_already_complete"
    );
    expect(healingAwakeningActLockReasonDisplayKey(3, [])).toBe(
      "healing_act_lock_prerequisite"
    );
    expect(healingAwakeningActLockReasonDisplayKey(2, [1])).toBeNull();
  });

  it("246: healingAwakeningActBlockedMessageKey", () => {
    expect(healingAwakeningActBlockedMessageKey(1, [])).toBeNull();
    expect(healingAwakeningActBlockedMessageKey(1, [1])).toBe(
      "healing_awakening_act_already_complete"
    );
    expect(healingAwakeningActBlockedMessageKey(3, [])).toBe(
      "healing_awakening_act_order_required"
    );
    expect(healingAwakeningActBlockedMessageKey(2, [1])).toBeNull();
  });

  it("245: isSecondAwakeningEligible", () => {
    const ok = {
      phaseTwoUnlocked: true,
      daysSinceEnrollment: AWAKENING_TRIGGER_DAY,
      sessionCount: AWAKENING_TRIGGER_MIN_SESSIONS,
      allAwakeningActsComplete: false,
    };
    expect(isSecondAwakeningEligible(ok)).toBe(true);
    expect(isSecondAwakeningEligible({ ...ok, phaseTwoUnlocked: false })).toBe(false);
    expect(isSecondAwakeningEligible({ ...ok, allAwakeningActsComplete: true })).toBe(
      false
    );
    expect(
      isSecondAwakeningEligible({ ...ok, daysSinceEnrollment: AWAKENING_TRIGGER_DAY - 1 })
    ).toBe(false);
    expect(
      isSecondAwakeningEligible({ ...ok, sessionCount: AWAKENING_TRIGGER_MIN_SESSIONS - 1 })
    ).toBe(false);
  });

  it("248: HEALING_AWAKENING_PROGRESS_PERCENT bounds 0–100", () => {
    expect(HEALING_AWAKENING_PROGRESS_PERCENT_MIN).toBe(0);
    expect(HEALING_AWAKENING_PROGRESS_PERCENT_MAX).toBe(100);
  });

  it("251: HEALING_PROGRESS_BLOCKED_COOLDOWN_DISPLAY_KEY", () => {
    expect(HEALING_PROGRESS_BLOCKED_COOLDOWN_DISPLAY_KEY).toBe(
      "healing.progress_blocked_cooldown"
    );
    expect(HEALING_PROGRESS_BLOCKED_PHASE_DISPLAY_KEY).toBe("healing.progress_blocked_phase");
    expect(healingPathProgressBlockedUserDisplayKey("cooldown_active")).toBe(
      HEALING_PROGRESS_BLOCKED_COOLDOWN_DISPLAY_KEY
    );
    expect(healingPathProgressBlockedUserDisplayKey("phase_requirement_not_met")).toBe(
      HEALING_PROGRESS_BLOCKED_PHASE_DISPLAY_KEY
    );
  });

  it("248: clampHealingAwakeningActProgressDisplayPercent caps and rounds", () => {
    expect(clampHealingAwakeningActProgressDisplayPercent(-5)).toBe(0);
    expect(clampHealingAwakeningActProgressDisplayPercent(150)).toBe(100);
    expect(clampHealingAwakeningActProgressDisplayPercent(33.7)).toBe(34);
    expect(clampHealingAwakeningActProgressDisplayPercent(Number.NaN)).toBe(0);
  });
});
