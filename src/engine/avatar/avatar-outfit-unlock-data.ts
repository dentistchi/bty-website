/**
 * Pure data for outfit unlock rules — safe to import from client UI / manifest (no DB, no next/headers).
 */

export type OutfitUnlockAssetType = "base" | "outfit" | "accessory" | "badge";

export type OutfitUnlockConditionType =
  | "core_xp"
  | "certified_leader"
  | "healing_phase"
  | "scenario_count"
  | "streak";

export type OutfitUnlockConditionRow = {
  asset_type: OutfitUnlockAssetType;
  condition_type: OutfitUnlockConditionType;
  /**
   * `core_xp`: minimum Core XP total.
   * `certified_leader`: 1 = must have active Certified Leader grant.
   * `healing_phase`: minimum index in healing phase order (0=ACK … 3=RENEWAL).
   * `scenario_count`: minimum distinct scenarios played.
   * `streak`: minimum streak days (UTC).
   */
  condition_value: number;
};

/**
 * Twelve unlockable `asset_id` keys (subset overlaps tier grants in {@link ASSET_UNLOCK_MAP}).
 */
export const OUTFIT_UNLOCK_CONDITIONS: Record<string, OutfitUnlockConditionRow> = {
  avatar_base: { asset_type: "base", condition_type: "core_xp", condition_value: 100 },
  character_default: { asset_type: "base", condition_type: "scenario_count", condition_value: 1 },
  palette_basic: { asset_type: "accessory", condition_type: "core_xp", condition_value: 500 },
  accessory_slot_1: { asset_type: "accessory", condition_type: "scenario_count", condition_value: 5 },
  outfit_theme_professional: { asset_type: "outfit", condition_type: "core_xp", condition_value: 1500 },
  accessory_slot_2: { asset_type: "accessory", condition_type: "streak", condition_value: 5 },
  outfit_theme_fantasy: { asset_type: "outfit", condition_type: "healing_phase", condition_value: 2 },
  accessory_slot_3: { asset_type: "accessory", condition_type: "scenario_count", condition_value: 15 },
  visor_elite_center: { asset_type: "badge", condition_type: "core_xp", condition_value: 3500 },
  frame_legend: { asset_type: "badge", condition_type: "certified_leader", condition_value: 1 },
  palette_full: { asset_type: "accessory", condition_type: "core_xp", condition_value: 5500 },
  accessory_slot_4: { asset_type: "accessory", condition_type: "core_xp", condition_value: 6500 },
};

/** Grid order (3×4) — matches {@link OUTFIT_UNLOCK_CONDITIONS} keys. */
export const OUTFIT_UNLOCK_CARD_ORDER = [
  "avatar_base",
  "character_default",
  "palette_basic",
  "accessory_slot_1",
  "outfit_theme_professional",
  "accessory_slot_2",
  "outfit_theme_fantasy",
  "accessory_slot_3",
  "visor_elite_center",
  "frame_legend",
  "palette_full",
  "accessory_slot_4",
] as const;
