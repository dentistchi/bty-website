/**
 * C6 247 — 주간 표시 잔여일·성찰 길이 힌트·SLA 키·Awakening 축하 키.
 */
import { describe, it, expect } from "vitest";
import {
  weeklyLeaderboardResetDaysRemaining,
  weeklyCompetitionDaysLeftInWindowDisplay,
} from "./weeklyCompetitionDisplay";
import { reflectTextLengthHintKey } from "./reflectTextHint";
import {
  eliteMentorResponseSlaWarningKey,
  ELITE_MENTOR_RESPONSE_SLA_WARNING_DAYS,
} from "./eliteMentorRequest";
import { healingAwakeningCompletionCelebrationMessageKey } from "../healing";

describe("247 weekly · reflect hint · SLA · awakening copy", () => {
  it("weekly display: reset days remaining ceil; competition window cap 7", () => {
    const now = Date.parse("2026-03-10T12:00:00.000Z");
    expect(weeklyLeaderboardResetDaysRemaining(now, "2026-03-11T00:00:00.000Z")).toBe(1);
    expect(weeklyCompetitionDaysLeftInWindowDisplay(now, "2026-03-15T12:00:00.000Z")).toBeLessThanOrEqual(7);
  });

  it("reflect length hint keys along ratio bands", () => {
    const max = 24_000;
    expect(reflectTextLengthHintKey(0, max)).toBe("reflect_hint_empty");
    expect(reflectTextLengthHintKey(Math.floor(max * 0.96), max)).toBe("reflect_hint_near_limit");
  });

  it("Elite mentor SLA imminent key when pending ≥ SLA days", () => {
    const now = Date.now();
    const old = now - (ELITE_MENTOR_RESPONSE_SLA_WARNING_DAYS + 1) * 86_400_000;
    expect(eliteMentorResponseSlaWarningKey("pending", old, now)).toBe(
      "elite_mentor_sla_response_imminent",
    );
    expect(eliteMentorResponseSlaWarningKey("pending", now - 86_400_000, now)).toBeNull();
  });

  it("Awakening all-complete celebration key", () => {
    expect(healingAwakeningCompletionCelebrationMessageKey()).toBe(
      "healing_awakening_all_complete_next_steps",
    );
  });
});
