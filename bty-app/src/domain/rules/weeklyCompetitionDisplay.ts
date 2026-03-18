/**
 * 주간 랭킹 창 **표시용** 남은 시간(Core XP와 무관). API가 준 `reset_at`·`week_end` ISO만 사용.
 */

import type { WeeklyTierName } from "./weeklyXp";

/** 주간 경쟁 화면 — 스테이지·티어 구간 표시 슬롯(render-only; UI가 레벨·티어 값 보간). */
export const WEEKLY_COMPETITION_STAGE_TIER_DISPLAY_LABEL_KEY =
  "arena.weekly_competition.stage_tier_display" as const;

/** 주간 경쟁 티어 밴드별 스테이지 라벨 키(251·render-only). 리더보드 티어 키와 네임스페이스 분리. */
export type WeeklyCompetitionStageTierBandDisplayLabelKey =
  | "arena.weekly_competition.stage_band_bronze"
  | "arena.weekly_competition.stage_band_silver"
  | "arena.weekly_competition.stage_band_gold"
  | "arena.weekly_competition.stage_band_platinum";

export function weeklyCompetitionStageTierBandDisplayLabelKey(
  tier: WeeklyTierName
): WeeklyCompetitionStageTierBandDisplayLabelKey {
  switch (tier) {
    case "Bronze":
      return "arena.weekly_competition.stage_band_bronze";
    case "Silver":
      return "arena.weekly_competition.stage_band_silver";
    case "Gold":
      return "arena.weekly_competition.stage_band_gold";
    case "Platinum":
      return "arena.weekly_competition.stage_band_platinum";
    default: {
      const _e: never = tier;
      return _e;
    }
  }
}

const MS_PER_DAY = 86_400_000;

/**
 * 다음 주간 리셋(`reset_at` ISO)까지 **올림 일수**(0 = 오늘 내 리셋).
 */
export function weeklyLeaderboardResetDaysRemaining(
  nowMs: number,
  resetAtIso: string
): number {
  const end = Date.parse(resetAtIso);
  if (!Number.isFinite(end)) return 0;
  const diff = end - nowMs;
  if (diff <= 0) return 0;
  return Math.ceil(diff / MS_PER_DAY);
}

/**
 * 현재 주 창 안에서 **남은 달력 일수**(week_end 기준, 표시용 상한 7).
 */
export function weeklyCompetitionDaysLeftInWindowDisplay(
  nowMs: number,
  weekEndSundayIso: string
): number {
  const end = Date.parse(weekEndSundayIso);
  if (!Number.isFinite(end)) return 0;
  const diff = end - nowMs;
  if (diff <= 0) return 0;
  const d = Math.ceil(diff / MS_PER_DAY);
  return Math.min(7, Math.max(1, d));
}
