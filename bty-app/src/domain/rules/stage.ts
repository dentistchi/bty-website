/**
 * Stage / Code / Sub-tier rules (pure). See docs/spec/arena-domain.md.
 */

import { CODE_NAMES, CORE_XP_PER_TIER, SUB_NAMES, TIERS_PER_CODE } from "../constants";
import type { CodeIndex, StageState, SubTierGroup } from "../types";
import { tierFromCoreXp } from "./level-tier";

/** Code index 0–6 from tier. */
export function codeIndexFromTier(tier: number): CodeIndex {
  const idx = Math.floor(tier / TIERS_PER_CODE);
  return Math.min(6, Math.max(0, idx)) as CodeIndex;
}

/** Sub-tier group 0–3 from tier (for default Sub Name). */
export function subTierGroupFromTier(tier: number): SubTierGroup {
  const g = Math.floor((tier % TIERS_PER_CODE) / 25);
  return Math.min(3, Math.max(0, g)) as SubTierGroup;
}

/** Stage number 1–7 from Core XP (floor(coreXp/100) + 1, capped at 7). */
export function stageNumberFromCoreXp(coreXp: number): number {
  const safe = Math.max(0, Math.floor(coreXp));
  return Math.min(7, Math.floor(safe / 100) + 1);
}

/** Code name string for code index. */
export function codeNameFromIndex(codeIndex: CodeIndex): string {
  return CODE_NAMES[codeIndex];
}

/** Default sub name for code and sub-tier; null for CODELESS ZONE. */
export function defaultSubName(codeIndex: CodeIndex, subTierGroup: SubTierGroup): string | null {
  const row = SUB_NAMES[codeIndex];
  return row ? row[subTierGroup] : null;
}

/**
 * Resolve display sub name: custom if provided and non-empty, else default from code/subTierGroup.
 * CODELESS ZONE: use custom or fallback (e.g. "—").
 */
export function resolveSubName(
  codeIndex: CodeIndex,
  subTierGroup: SubTierGroup,
  customSubName: string | null
): string {
  if (customSubName != null && customSubName.trim() !== "") return customSubName.trim();
  const def = defaultSubName(codeIndex, subTierGroup);
  return def ?? "—";
}

/** Full derived stage state from Core XP. */
export function stageStateFromCoreXp(
  coreXp: number,
  customSubName: string | null = null
): StageState {
  const tier = tierFromCoreXp(coreXp);
  const codeIndex = codeIndexFromTier(tier);
  const subTierGroup = subTierGroupFromTier(tier);
  const stageNumber = stageNumberFromCoreXp(coreXp);
  const codeName = codeNameFromIndex(codeIndex);
  const subName = resolveSubName(codeIndex, subTierGroup, customSubName);
  return {
    tier,
    codeIndex,
    subTierGroup,
    stageNumber,
    codeName,
    subName,
  };
}
