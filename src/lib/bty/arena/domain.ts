/**
 * BTY Arena — weekly XP competition rules (service-layer re-export).
 * Run·profile·milestone 타입 단일 소스: @/domain/constants TIER_MILESTONES, @/domain/rules/weeklyXp, lib/codes CoreXpDisplay.
 * Canonical source: @/domain/rules/weeklyXp. Re-export for backward compatibility.
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

export {
  ledgerStateAfterWeeklyBoundaryReset,
  isWeeklyBoundaryResetNoop,
  type WeeklyBoundaryLedgerOutcome,
} from "@/domain/rules/weeklyResetIdempotency";

export { weeklyCompetitionDisplay } from "@/domain/rules/leaderboard";
