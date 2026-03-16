/**
 * Stage / Code / Sub-tier rules (pure). See docs/spec/arena-domain.md.
 *
 * codeIndexFromTier, subTierGroupFromTier, codeNameFromIndex, resolveSubName
 * are canonical in level-tier.ts — imported here for internal use only.
 * Unique: stageNumberFromCoreXp (floor(coreXp/100)+1, cap 7), stageStateFromCoreXp → types.StageState.
 */

import { SUB_NAMES } from "../constants";
import type { CodeIndex, StageState, SubTierGroup } from "../types";
import {
  tierFromCoreXp,
  codeIndexFromTier,
  subTierGroupFromTier,
  codeNameFromIndex,
  resolveSubName,
} from "./level-tier";

/** Stage number 1–7 from Core XP (floor(coreXp/100) + 1, capped at 7). */
export function stageNumberFromCoreXp(coreXp: number): number {
  const safe = Math.max(0, Math.floor(coreXp));
  return Math.min(7, Math.floor(safe / 100) + 1);
}

/** Default sub name for code and sub-tier; null for CODELESS ZONE. */
export function defaultSubName(codeIndex: CodeIndex, subTierGroup: SubTierGroup): string | null {
  const row = SUB_NAMES[codeIndex];
  return row ? row[subTierGroup] : null;
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
