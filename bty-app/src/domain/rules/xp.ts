/**
 * XP rules: Seasonal → Core conversion.
 * Core XP is permanent; conversion rates from docs/spec/arena-domain-rules.md.
 */

import type { SeasonalToCoreResult } from "../types";
import {
  BEGINNER_CORE_THRESHOLD,
  BEGINNER_SEASONAL_TO_CORE_RATE,
  DEFAULT_SEASONAL_TO_CORE_RATE,
} from "../constants";

/**
 * Seasonal XP → Core XP conversion.
 * Core < 200: 45:1 (Beginner). Else 60:1.
 * Fractional remainder goes to buffer (caller persists).
 */
export function seasonalToCoreConversion(
  seasonalEarned: number,
  currentCoreXp: number
): SeasonalToCoreResult {
  const rate =
    currentCoreXp < BEGINNER_CORE_THRESHOLD
      ? BEGINNER_SEASONAL_TO_CORE_RATE
      : DEFAULT_SEASONAL_TO_CORE_RATE;
  const exact = seasonalEarned / rate;
  const coreGain = Math.floor(exact);
  const fractionalBuffer = exact - coreGain;
  return { rate, coreGain, fractionalBuffer };
}
