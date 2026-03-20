import { isArenaHiddenStatLabel } from "./arenaHiddenStatLabel";
import type { HiddenStat } from "./types";

/**
 * Parses `ResolveOutcome.activatedStats` from an unknown value (e.g. JSON array).
 * Every element must pass `isArenaHiddenStatLabel` (`HiddenStat` spelling/case).
 * Returns a new array (empty input array → `[]`).
 */
export function arenaActivatedHiddenStatsFromUnknown(value: unknown): HiddenStat[] | null {
  if (!Array.isArray(value)) return null;
  const out: HiddenStat[] = [];
  for (const item of value) {
    if (!isArenaHiddenStatLabel(item)) return null;
    out.push(item);
  }
  return out;
}
