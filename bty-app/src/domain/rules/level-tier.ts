/**
 * Level / Tier / Stage mapping from Core XP.
 * Tier is internal (not exposed). Code and Sub Name drive leaderboard identity.
 * See docs/spec/arena-domain-rules.md.
 */

import {
  CODE_NAMES,
  SUB_NAMES,
  CORE_XP_PER_TIER,
  TIERS_PER_CODE,
  type CodeIndex,
} from "../constants";
import type { SubTierGroup } from "../types";

/** Tier = floor(coreXp / 10). Internal only; not shown to user. */
export function tierFromCoreXp(coreXp: number): number {
  return Math.max(0, Math.floor(coreXp / CORE_XP_PER_TIER));
}

/** Code index 0..6 from tier. */
export function codeIndexFromTier(tier: number): CodeIndex {
  const idx = Math.floor(tier / TIERS_PER_CODE);
  return Math.min(6, Math.max(0, idx)) as CodeIndex;
}

/** Sub tier group 0..3 within current code. */
export function subTierGroupFromTier(tier: number): SubTierGroup {
  const g = Math.floor((tier % TIERS_PER_CODE) / 25);
  return Math.min(3, Math.max(0, g)) as SubTierGroup;
}

/**
 * Resolve display sub name: custom (if set) or default from code + subTierGroup.
 * CODELESS ZONE (code 6): no defaults; use custom or "—".
 */
export function resolveSubName(
  codeIndex: CodeIndex,
  subTierGroup: SubTierGroup,
  customSubName: string | null
): string {
  if (customSubName != null && customSubName.trim() !== "")
    return customSubName.trim();
  const defaults = SUB_NAMES[codeIndex];
  if (defaults) return defaults[subTierGroup];
  return "—";
}

/** Code name string for a code index. */
export function codeNameFromIndex(codeIndex: CodeIndex): string {
  return CODE_NAMES[codeIndex];
}

/** Stage number 1..7 from core XP (for display). 700+ may be treated as 7 or "beyond". */
export function stageFromCoreXp(coreXp: number): number {
  return Math.min(7, Math.floor(coreXp / 100) + 1);
}
