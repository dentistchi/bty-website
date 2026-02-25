/**
 * Tier 25/50/75 celebration: detect when user crosses a milestone and persist "already shown".
 * Used by Arena and Dashboard to show TierMilestoneModal once per milestone.
 */

import {
  codeIndexFromTier,
  subTierGroupFromTier,
  SUB_NAMES,
  tierFromCoreXp,
} from "@/lib/bty/arena/codes";
import type { TierMilestone } from "@/components/bty-arena/TierMilestoneModal";

const STORAGE_KEY = "btyArenaLastCelebratedMilestone";

function getLastCelebrated(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const n = parseInt(raw ?? "0", 10);
    return Number.isFinite(n) ? Math.max(0, n) : 0;
  } catch {
    return 0;
  }
}

function setLastCelebrated(milestone: TierMilestone): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, String(milestone));
  } catch {
    // ignore
  }
}

export type MilestoneToShow = {
  milestone: TierMilestone;
  previousSubName?: string;
};

/**
 * Returns the next milestone to celebrate (25, 50, or 75) if the user just crossed it.
 * Updates localStorage so we only show each milestone once.
 */
export function getMilestoneToShow(newCoreXpTotal: number): MilestoneToShow | null {
  const newTier = tierFromCoreXp(newCoreXpTotal);
  const last = getLastCelebrated();

  if (newTier >= 75 && last < 75) {
    setLastCelebrated(75);
    const codeIndex = codeIndexFromTier(newTier);
    const prevGroup = subTierGroupFromTier(74);
    const names = SUB_NAMES[codeIndex];
    const previousSubName = names ? names[prevGroup] : "—";
    return { milestone: 75, previousSubName };
  }
  if (newTier >= 50 && last < 50) {
    setLastCelebrated(50);
    const codeIndex = codeIndexFromTier(newTier);
    const prevGroup = subTierGroupFromTier(49);
    const names = SUB_NAMES[codeIndex];
    const previousSubName = names ? names[prevGroup] : "—";
    return { milestone: 50, previousSubName };
  }
  if (newTier >= 25 && last < 25) {
    setLastCelebrated(25);
    return { milestone: 25 };
  }
  return null;
}
