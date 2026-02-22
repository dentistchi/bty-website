import { XP_CURVE, XP_SPLIT } from "./constants";
import type { UserProgress, XPEvent, HiddenStat } from "./types";

/**
 * Clamp helper
 */
function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

/**
 * Soft curve: compress very large xpBase values without killing mid-range.
 * A1 uses sqrt curve (simple & stable).
 */
export function applyXpCurve(xpBase: number): number {
  const x = Math.max(0, xpBase);
  // sqrt curve: 1->1, 25->5, 100->10, 400->20, etc.
  const curved = Math.round(Math.sqrt(x) * 10);
  return clamp(curved, XP_CURVE.minAward, XP_CURVE.maxAward);
}

export interface AwardResult {
  coreDelta: number;
  leagueDelta: number;
  hiddenApplied: Partial<Record<HiddenStat, number>>;
}

/**
 * Apply an XPEvent to progress (pure function).
 * - does NOT mutate input
 */
export function applyEventToProgress(progress: UserProgress, ev: XPEvent): { next: UserProgress; award: AwardResult } {
  const difficulty = clamp(ev.difficulty ?? 1.0, XP_CURVE.minDifficulty, XP_CURVE.maxDifficulty);

  // base -> curved
  const curved = applyXpCurve(ev.xpBase);

  // difficulty multiplier (kept modest)
  const scaled = Math.round(curved * difficulty);

  // split core vs league
  const coreDelta = Math.round(scaled * XP_SPLIT.coreRatio);
  const leagueDelta = Math.max(0, scaled - coreDelta);

  // hidden stats
  const hiddenApplied: Partial<Record<HiddenStat, number>> = { ...(ev.hiddenDelta ?? {}) };

  // gratitude is the fundamental: if tags include gratitude cues, add small hidden delta.
  const tags = ev.tags ?? [];
  if (tags.includes("gratitude")) {
    hiddenApplied.gratitude = (hiddenApplied.gratitude ?? 0) + 1;
  }

  // build next
  const next: UserProgress = {
    ...progress,
    coreXp: Math.max(0, progress.coreXp + coreDelta),
    leagueXp: Math.max(0, progress.leagueXp + leagueDelta),
    hidden: {
      ...progress.hidden,
      gratitude: progress.hidden.gratitude + (hiddenApplied.gratitude ?? 0),
      integrity: progress.hidden.integrity + (hiddenApplied.integrity ?? 0),
      insight: progress.hidden.insight + (hiddenApplied.insight ?? 0),
      communication: progress.hidden.communication + (hiddenApplied.communication ?? 0),
      resilience: progress.hidden.resilience + (hiddenApplied.resilience ?? 0),
    },
  };

  return {
    next,
    award: { coreDelta, leagueDelta, hiddenApplied },
  };
}
