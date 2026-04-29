/**
 * Pure equip-slot typing for layer conflict resolution — safe for client bundles (no server imports).
 */

import { OUTFIT_UNLOCK_CONDITIONS, type OutfitUnlockAssetType } from "./avatar-outfit-unlock-data";

/**
 * Layer type for equip conflict resolution (single base / outfit / badge; multiple accessories).
 */
export function assetTypeForEquipConflict(assetId: string): OutfitUnlockAssetType {
  const row = OUTFIT_UNLOCK_CONDITIONS[assetId];
  if (row) return row.asset_type;
  if (assetId.includes("outfit")) return "outfit";
  if (assetId.includes("frame") || assetId.includes("visor")) return "badge";
  if (assetId.includes("accessory") || assetId.includes("palette") || assetId.includes("slot")) {
    return "accessory";
  }
  return "base";
}
