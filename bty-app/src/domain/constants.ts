/**
 * BTY Arena domain constants.
 * Single source of truth; see docs/spec/arena-domain.md.
 */

export type CodeIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6;

// ----- XP & Tier -----

/** 1 Tier = this many Core XP. */
export const CORE_XP_PER_TIER = 10;

/** 1 Code = this many Tiers. */
export const TIERS_PER_CODE = 100;

/** Core XP per full Code (100 * 10). */
export const CORE_XP_PER_CODE = TIERS_PER_CODE * CORE_XP_PER_TIER;

/** Beginner threshold: Core XP below this uses 45:1 conversion. */
export const BEGINNER_CORE_XP_THRESHOLD = 200;
/** @deprecated Use BEGINNER_CORE_XP_THRESHOLD */
export const BEGINNER_CORE_THRESHOLD = BEGINNER_CORE_XP_THRESHOLD;

/** Seasonal → Core rate when Core XP < BEGINNER_CORE_XP_THRESHOLD. */
export const SEASONAL_TO_CORE_RATE_BEGINNER = 45;
/** @deprecated Use SEASONAL_TO_CORE_RATE_BEGINNER */
export const BEGINNER_SEASONAL_TO_CORE_RATE = SEASONAL_TO_CORE_RATE_BEGINNER;

/** Seasonal → Core rate when Core XP >= BEGINNER_CORE_XP_THRESHOLD. */
export const SEASONAL_TO_CORE_RATE_STANDARD = 60;
/** @deprecated Use SEASONAL_TO_CORE_RATE_STANDARD */
export const DEFAULT_SEASONAL_TO_CORE_RATE = SEASONAL_TO_CORE_RATE_STANDARD;

// ----- League / Season -----

/** League window length in days (MVP). */
export const LEAGUE_WINDOW_DAYS = 30;

/** At league end: fraction of Weekly XP carried to next window (0–1). */
export const LEAGUE_CARRYOVER_FRACTION = 0.1;
/** @deprecated Use LEAGUE_CARRYOVER_FRACTION */
export const SEASON_CARRYOVER_FRACTION = LEAGUE_CARRYOVER_FRACTION;

// ----- Code names (display only; order = code index 0–6) -----

export const CODE_NAMES: readonly [string, string, string, string, string, string, string] = [
  "FORGE",
  "PULSE",
  "FRAME",
  "ASCEND",
  "NOVA",
  "ARCHITECT",
  "CODELESS ZONE",
];

/** Default sub names per code, by subTierGroup 0–3. Code 6 has no defaults. */
export const SUB_NAMES: Record<CodeIndex, readonly [string, string, string, string] | null> = {
  0: ["Spark", "Ember", "Flame", "Inferno"],
  1: ["Echo", "Rhythm", "Resonance", "Surge"],
  2: ["Outline", "Structure", "Framework", "Foundation"],
  3: ["Lift", "Rise", "Elevation", "Summit"],
  4: ["Glimmer", "Radiance", "Brilliance", "Supernova"],
  5: ["Draft", "Design", "Blueprint", "Grand Architect"],
  6: null,
};

// ----- Leaderboard -----

/** Elite = top this fraction of ranked users (e.g. 0.05 = top 5%). */
export const ELITE_TOP_FRACTION = 0.05;

/** Minimum users before elite count (e.g. at least 1). */
export const ELITE_MIN_USERS = 1;
