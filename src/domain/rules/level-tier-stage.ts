/**
 * Level / Tier / Stage mapping rules.
 * Level = content unlock (tenure-only). Tier = internal (coreXp/10). Stage = user-facing (coreXp/100).
 */

import {
  TIER_CORE_XP_STEP,
  TIERS_PER_CODE,
  TIERS_PER_SUB_TIER,
  STAGE_CORE_XP_STEP,
  STAGE_MAX,
  CORE_XP_CODE_HIDDEN_THRESHOLD,
} from "../constants";
import type { CodeIndex, CoreXp, LevelId, StageNumber, SubTierGroup, Tier } from "../types";

/** Level unlock is tenure-only. Tier and XP do not unlock levels. */
export const LEVEL_UNLOCK_IS_TENURE_ONLY = true;

/**
 * Tier from Core XP. tier = floor(coreXp / 10).
 */
export function tierFromCoreXp(coreXp: CoreXp): Tier {
  return Math.max(0, Math.floor(coreXp / TIER_CORE_XP_STEP));
}

/**
 * Code index 0..6 from tier. codeIndex = floor(tier / 100).
 */
export function codeIndexFromTier(tier: Tier): CodeIndex {
  const idx = Math.floor(tier / TIERS_PER_CODE);
  return Math.min(6, Math.max(0, idx)) as CodeIndex;
}

/**
 * Sub-tier group 0..3 from tier. subTierGroup = floor((tier % 100) / 25).
 */
export function subTierGroupFromTier(tier: Tier): SubTierGroup {
  const g = Math.floor((tier % 100) / TIERS_PER_SUB_TIER);
  return Math.min(3, Math.max(0, g)) as SubTierGroup;
}

/**
 * Stage number 1..7 from Core XP. stage = min(7, floor(coreXp/100) + 1).
 */
export function stageFromCoreXp(coreXp: CoreXp): StageNumber {
  const raw = Math.floor(Math.max(0, coreXp) / STAGE_CORE_XP_STEP) + 1;
  return Math.min(STAGE_MAX, Math.max(1, raw)) as StageNumber;
}

/**
 * Whether code name is visible (below threshold). 700+ = hidden.
 */
export function isCodeNameVisible(coreXp: CoreXp): boolean {
  return coreXp < CORE_XP_CODE_HIDDEN_THRESHOLD;
}

/**
 * Progress within current tier (0..1). For UI progress bar.
 */
export function progressToNextTier(coreXp: CoreXp): { xpToNext: number; progressPct: number } {
  const tier = tierFromCoreXp(coreXp);
  const nextTierAt = (tier + 1) * TIER_CORE_XP_STEP;
  const xpToNext = Math.max(0, nextTierAt - coreXp);
  const segmentStart = tier * TIER_CORE_XP_STEP;
  const segmentEnd = nextTierAt;
  const progressPct =
    segmentEnd > segmentStart ? (coreXp - segmentStart) / (segmentEnd - segmentStart) : 1;
  return { xpToNext, progressPct };
}

// Re-export for consumers that need LevelId order (tenure rules live in tenure/program in app).
export type { LevelId };
