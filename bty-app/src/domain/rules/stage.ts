/**
 * Stage / Code / Sub-tier rules (pure). See docs/spec/arena-domain.md.
 *
 * codeIndexFromTier, subTierGroupFromTier, codeNameFromIndex, resolveSubName
 * are canonical in level-tier.ts — imported here for internal use only.
 * Unique: stageNumberFromCoreXp (floor(coreXp/100)+1, cap 7), stageStateFromCoreXp → types.StageState. tier 경계 = level-tier (tierFromCoreXp·CORE_XP_PER_TIER).
 */

import { SUB_NAMES, STAGE_NUMBER_MAX, CORE_XP_PER_STAGE_STEP } from "../constants";
import type { CodeIndex, StageState, SubTierGroup } from "../types";
import {
  tierFromCoreXp,
  codeIndexFromTier,
  subTierGroupFromTier,
  codeNameFromIndex,
  resolveSubName,
} from "./level-tier";

/** Stage number 1–7 from Core XP (floor(coreXp/CORE_XP_PER_STAGE_STEP) + 1, capped at STAGE_NUMBER_MAX). */
export function stageNumberFromCoreXp(coreXp: number): number {
  const safe = Math.max(0, Math.floor(coreXp));
  return Math.min(STAGE_NUMBER_MAX, Math.floor(safe / CORE_XP_PER_STAGE_STEP) + 1);
}

// BTY non-uniform stage boundaries (Stage 6 = 500–699, Stage 7 = 700+)
const BTY_STAGE_ENTRIES = [
  { minXp: 700, stageNumber: 7, label: "STAGE 7: CODELESS ZONE" },
  { minXp: 500, stageNumber: 6, label: "STAGE 6: ARCHITECT" },
  { minXp: 400, stageNumber: 5, label: "STAGE 5: NOVA" },
  { minXp: 300, stageNumber: 4, label: "STAGE 4: ASCEND" },
  { minXp: 200, stageNumber: 3, label: "STAGE 3: FRAME" },
  { minXp: 100, stageNumber: 2, label: "STAGE 2: PULSE" },
  { minXp: 0, stageNumber: 1, label: "STAGE 1: FORGE" },
] as const;

export type BtyStageEntry = { stageNumber: number; label: string };

/** Stage number + label from Core XP using BTY non-uniform boundaries. */
export function btyStageFromCoreXp(coreXp: number): BtyStageEntry {
  const safe = Math.max(0, Math.floor(coreXp));
  for (const entry of BTY_STAGE_ENTRIES) {
    if (safe >= entry.minXp) return { stageNumber: entry.stageNumber, label: entry.label };
  }
  return { stageNumber: 1, label: "STAGE 1: FORGE" };
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
