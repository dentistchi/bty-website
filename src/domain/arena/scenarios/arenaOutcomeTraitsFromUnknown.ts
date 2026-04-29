import { isArenaHiddenStatLabel } from "./arenaHiddenStatLabel";
import type { HiddenStat } from "./types";

/**
 * Single trait weight for `ResolveOutcome.traits` — accepts finite numbers only, clamped to [0, 1].
 */
export function arenaOutcomeTraitWeightFromUnknown(value: unknown): number | null {
  if (typeof value !== "number") return null;
  if (!Number.isFinite(value)) return null;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

/**
 * Parses a `traits`-like object: keeps only keys that pass `isArenaHiddenStatLabel`, ignores other keys.
 * Returns null if any **Known** hidden-stat entry has a non-normalizable weight.
 */
export function arenaOutcomeTraitsPartialFromUnknown(
  value: unknown,
): Partial<Record<HiddenStat, number>> | null {
  if (value == null || typeof value !== "object" || Array.isArray(value)) return null;
  const o = value as Record<string, unknown>;
  const out: Partial<Record<HiddenStat, number>> = {};
  for (const [k, v] of Object.entries(o)) {
    if (!isArenaHiddenStatLabel(k)) continue;
    const w = arenaOutcomeTraitWeightFromUnknown(v);
    if (w === null) return null;
    out[k] = w;
  }
  return out;
}
