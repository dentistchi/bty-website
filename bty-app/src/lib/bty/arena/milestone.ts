/**
 * Tier 25/50/75 celebration — pure domain logic.
 * Pure function: getPendingMilestone(currentTier, lastCelebratedMilestone).
 * Side-effect wrapper: getMilestoneToShow (backward compat, uses localStorage).
 * Preferred in React: useMilestoneTracker hook (src/hooks/useMilestoneTracker.ts).
 */

import { TIER_MILESTONES, type TierMilestoneValue } from "@/domain/constants";
import {
  codeIndexFromTier,
  subTierGroupFromTier,
  tierFromCoreXp,
} from "@/lib/bty/arena/codes";
import { defaultSubName } from "@/domain/rules";

/** Tier celebration milestones. Shared by lib and UI. Domain 단일 소스: TIER_MILESTONES. */
export type TierMilestone = TierMilestoneValue;

export type MilestoneToShow = {
  milestone: TierMilestone;
  previousSubName?: string;
};

export const MILESTONE_STORAGE_KEY = "btyArenaLastCelebratedMilestone";

// ---------------------------------------------------------------------------
// Pure function — no side effects
// ---------------------------------------------------------------------------

/**
 * Returns the highest pending milestone to celebrate, or null.
 * Pure: caller supplies currentTier and lastCelebratedMilestone.
 */
export function getPendingMilestone(
  currentTier: number,
  lastCelebratedMilestone: number,
): MilestoneToShow | null {
  if (currentTier >= 75 && lastCelebratedMilestone < 75) {
    const codeIndex = codeIndexFromTier(currentTier);
    const previousSubName =
      defaultSubName(codeIndex, subTierGroupFromTier(74)) ?? "—";
    return { milestone: 75, previousSubName };
  }
  if (currentTier >= 50 && lastCelebratedMilestone < 50) {
    const codeIndex = codeIndexFromTier(currentTier);
    const previousSubName =
      defaultSubName(codeIndex, subTierGroupFromTier(49)) ?? "—";
    return { milestone: 50, previousSubName };
  }
  if (currentTier >= 25 && lastCelebratedMilestone < 25) {
    return { milestone: 25 };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Backward-compat wrapper (localStorage side effect)
// Prefer useMilestoneTracker hook in React components.
// ---------------------------------------------------------------------------

function getLastCelebrated(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = localStorage.getItem(MILESTONE_STORAGE_KEY);
    const n = parseInt(raw ?? "0", 10);
    return Number.isFinite(n) ? Math.max(0, n) : 0;
  } catch {
    return 0;
  }
}

function setLastCelebrated(milestone: TierMilestone): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(MILESTONE_STORAGE_KEY, String(milestone));
  } catch {
    // ignore
  }
}

/**
 * Returns the next milestone to celebrate if the user just crossed it.
 * Reads/writes localStorage. For React, prefer useMilestoneTracker hook.
 */
export function getMilestoneToShow(newCoreXpTotal: number): MilestoneToShow | null {
  const tier = tierFromCoreXp(newCoreXpTotal);
  const last = getLastCelebrated();
  const result = getPendingMilestone(tier, last);
  if (result) setLastCelebrated(result.milestone);
  return result;
}
