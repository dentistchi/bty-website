/**
 * Dental RPG 도메인: rarity·level 상수.
 * 기준: docs/spec/DENTAL_RPG_EQUIPMENT_SYSTEM.md. Pure constants only.
 */

/** Rarity 1–5 (1=common … 5=legendary). */
export type RarityLevel = 1 | 2 | 3 | 4 | 5;

export const RARITY_MIN = 1 as const;
export const RARITY_MAX = 5 as const;
export const RARITY_LEVELS: readonly RarityLevel[] = [1, 2, 3, 4, 5];

/** 장비 레벨 1–5. */
export const EQUIPMENT_LEVEL_MIN = 1 as const;
export const EQUIPMENT_LEVEL_MAX = 5 as const;
export const EQUIPMENT_LEVELS = [1, 2, 3, 4, 5] as const;
export type EquipmentLevel = (typeof EQUIPMENT_LEVELS)[number];

/** 레벨별 능력 스케일 (1–5). 진도·언락 계산용. 단일 소스. */
export const ABILITY_SCALE_BY_LEVEL: Readonly<Record<EquipmentLevel, number>> = {
  1: 1,
  2: 2,
  3: 3,
  4: 4,
  5: 5,
};

/** 도구 카테고리 id. DENTAL_RPG_EQUIPMENT_SYSTEM 기준. */
export const TOOL_CATEGORY_IDS = ["handpiece", "mirror", "explorer", "diagnostic", "preventive"] as const;
export type ToolCategoryId = (typeof TOOL_CATEGORY_IDS)[number];

/** 레어리티 1–5 표시명. */
export const RARITY_LABELS: Readonly<Record<RarityLevel, string>> = {
  1: "common",
  2: "uncommon",
  3: "rare",
  4: "epic",
  5: "legendary",
};
