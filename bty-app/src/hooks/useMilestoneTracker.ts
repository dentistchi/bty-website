"use client";

import { useState, useCallback } from "react";
import { tierFromCoreXp } from "@/lib/bty/arena/codes";
import {
  getPendingMilestone,
  MILESTONE_STORAGE_KEY,
  type MilestoneToShow,
  type TierMilestone,
} from "@/lib/bty/arena/milestone";

function readLastCelebrated(): number {
  try {
    const raw = localStorage.getItem(MILESTONE_STORAGE_KEY);
    const n = parseInt(raw ?? "0", 10);
    return Number.isFinite(n) ? Math.max(0, n) : 0;
  } catch {
    return 0;
  }
}

function writeLastCelebrated(milestone: TierMilestone): void {
  try {
    localStorage.setItem(MILESTONE_STORAGE_KEY, String(milestone));
  } catch {
    /* ignore */
  }
}

/**
 * React hook for milestone celebration tracking.
 * Manages localStorage state; delegates logic to the pure getPendingMilestone function.
 */
export function useMilestoneTracker() {
  const [lastCelebrated, setLastCelebrated] = useState(readLastCelebrated);

  const checkMilestone = useCallback(
    (coreXpTotal: number): MilestoneToShow | null => {
      const tier = tierFromCoreXp(coreXpTotal);
      return getPendingMilestone(tier, lastCelebrated);
    },
    [lastCelebrated],
  );

  const markShown = useCallback((milestone: TierMilestone) => {
    writeLastCelebrated(milestone);
    setLastCelebrated(milestone);
  }, []);

  return { checkMilestone, markShown } as const;
}
