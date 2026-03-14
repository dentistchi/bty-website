/**
 * BTY Arena Code and Sub Name — service layer.
 * Domain rules (tier, code, sub name, XP conversion) are delegated to @/domain/rules.
 * This module re-exports them for backward compatibility and adds display helpers.
 */

import {
  CODE_NAMES,
  SUB_NAMES,
  CORE_XP_PER_TIER,
  TIERS_PER_CODE,
} from "@/domain/constants";
import type { CodeIndex } from "@/domain/constants";
import {
  tierFromCoreXp,
  codeIndexFromTier,
  subTierGroupFromTier,
  resolveSubName,
  defaultSubName,
  seasonalToCoreConversion,
} from "@/domain/rules";

export {
  CODE_NAMES,
  SUB_NAMES,
  tierFromCoreXp,
  codeIndexFromTier,
  subTierGroupFromTier,
  resolveSubName,
  seasonalToCoreConversion,
};
export type { CodeIndex };

/** One-line lore per code (for progress UI). */
export const CODE_LORE: Record<CodeIndex, string> = {
  0: "Shape your foundation.",
  1: "Find your rhythm.",
  2: "Build the structure.",
  3: "Rise to the summit.",
  4: "Let your light shine.",
  5: "Design what endures.",
  6: "You define the path.",
};

/**
 * Progress to next tier (next tier = +CORE_XP_PER_TIER Core XP). Tier is not shown to user.
 * Returns xpToNext (0–10), progress 0–1 within current tier, and optional next code name at 100-tier boundary.
 */
export function progressToNextTier(coreXpTotal: number): {
  xpToNext: number;
  progressPct: number;
  nextCodeName?: string;
} {
  const tier = tierFromCoreXp(coreXpTotal);
  const nextTierAt = (tier + 1) * CORE_XP_PER_TIER;
  const xpToNext = Math.max(0, nextTierAt - coreXpTotal);
  const segmentStart = tier * CORE_XP_PER_TIER;
  const segmentEnd = nextTierAt;
  const progressPct =
    segmentEnd > segmentStart
      ? (coreXpTotal - segmentStart) / (segmentEnd - segmentStart)
      : 1;
  const isNextCode = (tier + 1) % TIERS_PER_CODE === 0;
  const nextCodeName =
    isNextCode && tier + 1 <= 700
      ? CODE_NAMES[Math.floor((tier + 1) / TIERS_PER_CODE) as CodeIndex]
      : undefined;
  return { xpToNext, progressPct, nextCodeName };
}

/**
 * All display fields for core-xp API (progress bar, code lore, milestone modal).
 * Domain-only; route calls this and returns the result.
 */
export type CoreXpDisplay = {
  stage: number;
  progressPct: number;
  nextCodeName: string | null;
  xpToNext: number;
  codeLore: string;
  milestoneToCelebrate: 25 | 50 | 75 | null;
  previousSubName: string | null;
};

export function computeCoreXpDisplay(coreXpTotal: number): CoreXpDisplay {
  const tier = tierFromCoreXp(coreXpTotal);
  const progress = progressToNextTier(coreXpTotal);
  const codeIndex = codeIndexFromTier(tier);
  const stage = codeIndex + 1;
  const codeLore = CODE_LORE[codeIndex];
  let milestoneToCelebrate: 25 | 50 | 75 | null = null;
  let previousSubName: string | null = null;
  if (tier >= 75) {
    milestoneToCelebrate = 75;
    previousSubName =
      defaultSubName(codeIndexFromTier(74), subTierGroupFromTier(74)) ?? "—";
  } else if (tier >= 50) {
    milestoneToCelebrate = 50;
    previousSubName =
      defaultSubName(codeIndexFromTier(49), subTierGroupFromTier(49)) ?? "—";
  } else if (tier >= 25) {
    milestoneToCelebrate = 25;
  }
  return {
    stage,
    progressPct: progress.progressPct,
    nextCodeName: progress.nextCodeName ?? null,
    xpToNext: progress.xpToNext,
    codeLore,
    milestoneToCelebrate,
    previousSubName,
  };
}
