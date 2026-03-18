import { describe, it, expect } from "vitest";
import {
  weeklyLeaderboardResetDaysRemaining,
  weeklyCompetitionDaysLeftInWindowDisplay,
  WEEKLY_COMPETITION_STAGE_TIER_DISPLAY_LABEL_KEY,
  weeklyCompetitionStageTierBandDisplayLabelKey,
} from "./weeklyCompetitionDisplay";

describe("weeklyCompetitionDisplay", () => {
  it("251: WEEKLY_COMPETITION_STAGE_TIER_DISPLAY_LABEL_KEY", () => {
    expect(WEEKLY_COMPETITION_STAGE_TIER_DISPLAY_LABEL_KEY).toBe(
      "arena.weekly_competition.stage_tier_display"
    );
  });
  it("251: weeklyCompetitionStageTierBandDisplayLabelKey per tier", () => {
    expect(weeklyCompetitionStageTierBandDisplayLabelKey("Bronze")).toBe(
      "arena.weekly_competition.stage_band_bronze"
    );
    expect(weeklyCompetitionStageTierBandDisplayLabelKey("Platinum")).toBe(
      "arena.weekly_competition.stage_band_platinum"
    );
  });
  it("weeklyLeaderboardResetDaysRemaining", () => {
    const now = Date.parse("2025-03-10T12:00:00.000Z");
    const reset = "2025-03-17T00:00:00.000Z";
    expect(weeklyLeaderboardResetDaysRemaining(now, reset)).toBeGreaterThanOrEqual(6);
    expect(weeklyLeaderboardResetDaysRemaining(Date.parse(reset), reset)).toBe(0);
  });

  it("weeklyCompetitionDaysLeftInWindowDisplay caps 1–7", () => {
    const weekEnd = "2025-03-16T23:59:59.999Z";
    const mid = Date.parse("2025-03-10T12:00:00.000Z");
    const d = weeklyCompetitionDaysLeftInWindowDisplay(mid, weekEnd);
    expect(d).toBeGreaterThanOrEqual(1);
    expect(d).toBeLessThanOrEqual(7);
  });
});
