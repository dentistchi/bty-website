/**
 * Client helper: GET `/api/bty/avatar/outfit-progress` — mirrors engine {@link getOutfitUnlockProgress} rows + unlock list.
 */
import type { OutfitProgress } from "@/engine/avatar/avatar-outfit-unlock.service";

export type OutfitUnlockProgressApi = {
  items: OutfitProgress[];
  equipped_asset_ids: string[];
  unlocked_assets: string[];
  /** `asset_id` → stored `#RRGGBB` outfit tint. */
  asset_tints?: Record<string, string>;
  current_tier?: number;
  core_xp_total?: number;
};
export async function getOutfitUnlockProgress(userId: string): Promise<OutfitUnlockProgressApi> {
  const uid = userId.trim();
  if (!uid) {
    return { items: [], equipped_asset_ids: [], unlocked_assets: [] };
  }
  const res = await fetch(
    `/api/bty/avatar/outfit-progress?userId=${encodeURIComponent(uid)}`,
    { credentials: "include" },
  );
  const json = (await res.json()) as OutfitUnlockProgressApi & { error?: string };
  if (!res.ok) {
    throw new Error(json.error ?? "OUTFIT_PROGRESS_LOAD_FAILED");
  }
  if (json.error) throw new Error(json.error);
  return {
    items: Array.isArray(json.items) ? json.items : [],
    equipped_asset_ids: Array.isArray(json.equipped_asset_ids) ? json.equipped_asset_ids : [],
    unlocked_assets: Array.isArray(json.unlocked_assets) ? json.unlocked_assets : [],
    asset_tints:
      json.asset_tints && typeof json.asset_tints === "object" && !Array.isArray(json.asset_tints)
        ? (json.asset_tints as Record<string, string>)
        : {},
    current_tier: typeof json.current_tier === "number" ? json.current_tier : undefined,
    core_xp_total: typeof json.core_xp_total === "number" ? json.core_xp_total : undefined,
  };
}
