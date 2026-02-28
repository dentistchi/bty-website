/**
 * BTY Arena domain types.
 * Single source of truth for XP, Level, Tier, Stage, Season, Leaderboard.
 * No DB, no API, no UI — types and semantics only.
 */

/** ISO date "YYYY-MM-DD". */
export type ISODateString = string;

/** ISO datetime "YYYY-MM-DDTHH:mm:ss.sssZ". */
export type ISODateTimeString = string;

/** User identifier (opaque). */
export type UserId = string;

/** League/season window identifier. */
export type LeagueId = string;

/** Season identifier (e.g. "2026Q1" or window-based). */
export type SeasonId = string;

// ─── XP ─────────────────────────────────────────────────────────────────────

/** Permanent XP. Never resets. Used for Tier / Code / Sub Name. */
export type CoreXp = number;

/** Per–time-window XP. Resets each season (with carryover). Used for leaderboard ranking only. */
export type WeeklyXp = number;

// ─── Tier / Code / Stage (Core XP derived) ──────────────────────────────────

/** Internal tier: floor(coreXp / 10). Not shown to user. */
export type Tier = number;

/** Code index 0..6. Maps to Code Name. */
export type CodeIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** Sub-tier group within a code: 0..3 (25 tiers each). */
export type SubTierGroup = 0 | 1 | 2 | 3;

/** Stage number 1..7 from coreXp. 700+ may be treated as "beyond" (code hidden). */
export type StageNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7;

// ─── Level (content unlock, tenure-only) ────────────────────────────────────

/** Level id for content unlock. Tenure-based only; XP/tier do not unlock. */
export type LevelId = "S1" | "S2" | "S3" | "L1" | "L2" | "L3" | "L4";

/** Track: staff (S1–S3) or leader (L1–L4). */
export type ArenaTrack = "staff" | "leader";

// ─── Season / League ───────────────────────────────────────────────────────

/** Time window for a league/season. */
export interface SeasonWindow {
  id: SeasonId;
  startDate: ISODateString;
  endDate: ISODateString;
  label?: string;
}

// ─── Leaderboard ────────────────────────────────────────────────────────────

/**
 * Leaderboard entry. Ranking is by WeeklyXp only.
 * Display: Code Name + Sub Name only (no real name).
 */
export interface LeaderboardEntry {
  userId: UserId;
  weeklyXp: WeeklyXp;
  /** For display only; not used for ranking. */
  codeName?: string;
  subName?: string;
}

/** Elite result (e.g. top 5% of leaderboard by Weekly XP). */
export interface EliteResult {
  seasonId: SeasonId;
  cutoffRank: number;
  eliteUserIds: UserId[];
}
