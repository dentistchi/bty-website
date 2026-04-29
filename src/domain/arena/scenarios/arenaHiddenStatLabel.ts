import type { HiddenStat } from "./types";
import { ARENA_HIDDEN_STAT_ORDER } from "./types";

const ORDER_SET = new Set<string>(ARENA_HIDDEN_STAT_ORDER);

/**
 * Whether `s` is one of the five Arena hidden stat labels (exact spelling/case).
 */
export function isArenaHiddenStatLabel(s: unknown): s is HiddenStat {
  return typeof s === "string" && ORDER_SET.has(s);
}
