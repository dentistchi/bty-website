import type { ArenaSignal } from "@/features/my-page/logic/types";

/**
 * Arena-only: recent emotional-regulation pressure (last up to 5 signals, requires ≥3 signals).
 * Used by `buildRecoveryPrompt` to choose the low-regulation copy branch (not the compound strip alone).
 */
export function checkArenaLowRegulation(signals: ArenaSignal[]): boolean {
  if (signals.length < 3) return false;

  const n = Math.min(5, signals.length);
  const recent = signals.slice(-n);
  const avgReg = recent.reduce((sum, s) => sum + s.meta.emotionalRegulation, 0) / recent.length;

  return avgReg < 0.45;
}

type SignalLike = { meta?: { emotionalRegulation?: number } };
type ReflectionLike = { focus?: string };

/**
 * Compound recovery signal for Growth history / My Page:
 * last 3 Arena signals’ avg regulation **or** ≥2 regulation reflections in the last 5.
 * Accepts DB-shaped rows (`meta` jsonb) or domain `ArenaSignal`.
 */
export function checkRecoveryTrigger(
  signals: SignalLike[],
  reflections: ReflectionLike[] = [],
): boolean {
  const recentSignals = signals.slice(-3);
  const avgReg =
    recentSignals.length > 0
      ? recentSignals.reduce((sum, s) => sum + (s.meta?.emotionalRegulation ?? 0), 0) / recentSignals.length
      : 1;

  const recentReflections = reflections.slice(-5);
  const regulationCount = recentReflections.filter((r) => r.focus === "regulation").length;

  return avgReg < 0.45 || regulationCount >= 2;
}
