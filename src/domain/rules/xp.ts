/**
 * XP domain rules: Core XP vs Weekly XP, conversion, caps.
 * Pure functions only; no I/O.
 */

import {
  BEGINNER_CORE_XP_THRESHOLD,
  BEGINNER_SEASONAL_TO_CORE_RATE,
  STANDARD_SEASONAL_TO_CORE_RATE,
} from "../constants";
import type { CoreXp, WeeklyXp } from "../types";

/** Core XP is permanent and never resets. */
export const CORE_XP_IS_PERMANENT = true;

/** Weekly XP resets each season (with carryover); used only for leaderboard ranking. */
export const WEEKLY_XP_IS_FOR_LEADERBOARD_ONLY = true;

/**
 * Seasonal (weekly) XP → Core XP conversion.
 * Core < 200: 45:1 (Beginner). Else 60:1.
 */
export function seasonalToCoreConversion(
  seasonalEarned: number,
  currentCoreXp: CoreXp
): { rate: number; coreGain: number; fractionalBuffer: number } {
  const rate =
    currentCoreXp < BEGINNER_CORE_XP_THRESHOLD
      ? BEGINNER_SEASONAL_TO_CORE_RATE
      : STANDARD_SEASONAL_TO_CORE_RATE;
  const exact = seasonalEarned / rate;
  const coreGain = Math.floor(exact);
  const fractionalBuffer = exact - coreGain;
  return { rate, coreGain, fractionalBuffer };
}

/**
 * Whether user has left Beginner band (Core XP >= threshold).
 */
export function isBeginnerComplete(coreXp: CoreXp): boolean {
  return coreXp >= BEGINNER_CORE_XP_THRESHOLD;
}
