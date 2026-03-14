/**
 * BTY Arena — weekly XP competition rules (service-layer re-export).
 *
 * Canonical source: @/domain/rules/weeklyXp.
 * This file re-exports for backward compatibility so existing consumers
 * (leaderboardService, tests, etc.) keep working without import changes.
 */

export {
  awardXp,
  calculateLevel,
  calculateTier,
  calculateLevelTierProgress,
  seasonReset,
  leaderboardSort,
  type WeeklyTierName,
  type AwardXpInput,
  type AwardXpResult,
  type LevelTierProgress,
  type SeasonResetInput,
  type SeasonResetResult,
  type LeaderboardEntry,
} from "@/domain/rules/weeklyXp";
