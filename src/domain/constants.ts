/**
 * BTY Arena domain constants.
 * Single source of truth for numeric and semantic constants.
 * No DB, no API, no UI.
 */

import type { CodeIndex } from "./types";

// ─── Core XP ↔ Tier / Code / Stage ───────────────────────────────────────────

/** 1 tier = this many Core XP. tier = floor(coreXp / TIER_CORE_XP_STEP). */
export const TIER_CORE_XP_STEP = 10;

/** 1 code = this many tiers. codeIndex = floor(tier / TIERS_PER_CODE). */
export const TIERS_PER_CODE = 100;

/** Sub-tier groups per code (0..3). subTierGroup = floor((tier % 100) / 25). */
export const SUB_TIERS_PER_CODE = 4;

/** Sub-tier size in tiers. 25 tiers per sub-tier group. */
export const TIERS_PER_SUB_TIER = 25;

/** Core XP at which code name is hidden (e.g. "CODELESS ZONE" / beyond). */
export const CORE_XP_CODE_HIDDEN_THRESHOLD = 700;

/** Stage formula: stage = floor(coreXp / STAGE_CORE_XP_STEP) + 1, capped at 7. */
export const STAGE_CORE_XP_STEP = 100;

/** Max stage number (1..7). Beyond this, code hidden. */
export const STAGE_MAX = 7;

// ─── Seasonal → Core conversion ─────────────────────────────────────────────

/** Core XP below this uses BEGINNER_SEASONAL_TO_CORE_RATE. */
export const BEGINNER_CORE_XP_THRESHOLD = 200;

/** Seasonal (weekly) XP to Core XP ratio when Core < BEGINNER_CORE_XP_THRESHOLD. */
export const BEGINNER_SEASONAL_TO_CORE_RATE = 45;

/** Seasonal (weekly) XP to Core XP ratio when Core >= BEGINNER_CORE_XP_THRESHOLD. */
export const STANDARD_SEASONAL_TO_CORE_RATE = 60;

// ─── Season / League ─────────────────────────────────────────────────────────

/** Season length in days (MVP). */
export const SEASON_LENGTH_DAYS = 30;

/** Carryover fraction at season end (0.1 = 10%). Rest of Weekly XP is reset. */
export const SEASON_CARRYOVER_FRACTION = 0.1;

// ─── Anti-farming ───────────────────────────────────────────────────────────

/** Daily cap for combined (arena + activity) XP (soft cap). */
export const DAILY_XP_CAP = 1200;

// ─── Code names (display identity; leaderboard shows code name only, no real name) ──

export const CODE_NAMES: readonly [string, string, string, string, string, string, string] = [
  "FORGE",
  "PULSE",
  "FRAME",
  "ASCEND",
  "NOVA",
  "ARCHITECT",
  "CODELESS ZONE",
];

/** Default sub names per code, by SubTierGroup 0..3. Code 6 has no defaults (user-defined). */
export const SUB_NAMES: Record<CodeIndex, readonly [string, string, string, string] | null> = {
  0: ["Spark", "Ember", "Flame", "Inferno"],
  1: ["Echo", "Rhythm", "Resonance", "Surge"],
  2: ["Outline", "Structure", "Framework", "Foundation"],
  3: ["Lift", "Rise", "Elevation", "Summit"],
  4: ["Glimmer", "Radiance", "Brilliance", "Supernova"],
  5: ["Draft", "Design", "Blueprint", "Grand Architect"],
  6: null,
};

// ─── Level (tenure) ─────────────────────────────────────────────────────────

/** Staff levels (tenure-unlock order). */
export const STAFF_LEVEL_ORDER: readonly ("S1" | "S2" | "S3")[] = ["S1", "S2", "S3"];

/** Leader levels (tenure-unlock order). L4 is admin-granted only. */
export const LEADER_LEVEL_ORDER: readonly ("L1" | "L2" | "L3" | "L4")[] = ["L1", "L2", "L3", "L4"];

/** New joiner: first N days get staff track regardless of role. */
export const NEW_JOINER_STAFF_DAYS = 30;

// ─── Leaderboard / Elite ─────────────────────────────────────────────────────

/** Elite = top this fraction of leaderboard by Weekly XP (e.g. 0.05 = 5%). */
export const ELITE_TOP_FRACTION = 0.05;

/** Minimum number of users to still designate at least one elite. */
export const ELITE_MIN_COUNT = 1;
