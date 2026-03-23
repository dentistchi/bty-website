/**
 * Tier → asset id grants (single source for {@link unlockedAssetsForTier} and DB `user_avatar_assets` rows).
 * On `avatar_tier_upgraded`, new rows are inserted for assets not yet in cumulative unlock.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AvatarTier, AvatarTierUpgradedPayload } from "./avatar-state.service";
import { getSupabaseServerClient } from "@/lib/bty/arena/supabaseServer";

export type AssetUnlockMap = Record<AvatarTier, string[]>;

/**
 * Asset IDs unlocked when the user **reaches** that tier (not cumulative; use {@link unlockedAssetsForTier} for cumulative).
 */
export const ASSET_UNLOCK_MAP: AssetUnlockMap = {
  0: ["avatar_base", "character_default"],
  1: ["palette_basic", "accessory_slot_1"],
  2: ["outfit_theme_professional", "accessory_slot_2"],
  3: ["outfit_theme_fantasy", "accessory_slot_3"],
  4: ["frame_legend", "accessory_slot_4", "palette_full"],
};

/** Stable reference for UI (e.g. {@link AvatarRenderer}) — same data as {@link ASSET_UNLOCK_MAP}. */
export function getAssetUnlockMap(): AssetUnlockMap {
  return ASSET_UNLOCK_MAP;
}

/** Cumulative asset ids for tiers `0..tier` (deduped). */
export function unlockedAssetsForTier(tier: AvatarTier): string[] {
  const acc: string[] = [];
  for (let t = 0; t <= tier; t++) {
    acc.push(...ASSET_UNLOCK_MAP[t as AvatarTier]);
  }
  return [...new Set(acc)];
}

/**
 * Assets gained when moving from `previousTier` to `newTier` (set difference of cumulative unlocks).
 */
export function diffNewlyUnlockedAssets(
  previousTier: AvatarTier,
  newTier: AvatarTier,
): string[] {
  const prev = new Set(unlockedAssetsForTier(previousTier));
  const next = unlockedAssetsForTier(newTier);
  return next.filter((id) => !prev.has(id));
}

/**
 * Inserts one row per newly unlocked asset for this tier transition (idempotent vs existing rows).
 */
export async function persistTierUnlockAssetsFromEvent(
  e: AvatarTierUpgradedPayload,
  supabase: SupabaseClient,
): Promise<void> {
  const ids = diffNewlyUnlockedAssets(e.previousTier, e.newTier);
  if (ids.length === 0) return;

  const { data: existing, error: selErr } = await supabase
    .from("user_avatar_assets")
    .select("asset_id")
    .eq("user_id", e.userId)
    .in("asset_id", ids);

  if (selErr) {
    console.warn("[persistTierUnlockAssetsFromEvent] select", selErr.message);
    return;
  }

  const have = new Set(
    (existing ?? []).map((r: { asset_id: string }) => r.asset_id),
  );
  const fresh = ids.filter((id) => !have.has(id));
  if (fresh.length === 0) return;

  const rows = fresh.map((asset_id) => ({
    user_id: e.userId,
    asset_id,
    unlocked_at: e.at,
  }));

  const { error } = await supabase.from("user_avatar_assets").insert(rows);
  if (error) {
    console.warn("[persistTierUnlockAssetsFromEvent] insert", error.message);
  }
}

/**
 * Ordered `asset_id` list: prefers `user_avatar_assets` rows; falls back to `user_avatar_state.unlocked_assets`
 * then tier-0 defaults (legacy users before any row).
 */
export async function getUnlockedAssets(
  userId: string,
  supabase?: SupabaseClient,
): Promise<string[]> {
  const client = supabase ?? (await getSupabaseServerClient());

  const { data: rows, error } = await client
    .from("user_avatar_assets")
    .select("asset_id")
    .eq("user_id", userId)
    .order("unlocked_at", { ascending: true });

  if (!error && rows && rows.length > 0) {
    return rows.map((r) => (r as { asset_id: string }).asset_id);
  }

  const { data: st } = await client
    .from("user_avatar_state")
    .select("unlocked_assets")
    .eq("user_id", userId)
    .maybeSingle();

  const fromState = (st as { unlocked_assets?: string[] } | null)?.unlocked_assets;
  if (Array.isArray(fromState) && fromState.length > 0) {
    return fromState;
  }

  return unlockedAssetsForTier(0);
}

/** `asset_id` → stored `#RRGGBB` tint for outfit multiply (from `user_avatar_assets.tint_color`). */
export async function getOutfitTintByAssetId(
  userId: string,
  supabase?: SupabaseClient,
): Promise<Record<string, string>> {
  const client = supabase ?? (await getSupabaseServerClient());

  const { data, error } = await client
    .from("user_avatar_assets")
    .select("asset_id, tint_color")
    .eq("user_id", userId);

  if (error || !data?.length) return {};

  const out: Record<string, string> = {};
  for (const row of data as { asset_id: string; tint_color: string | null }[]) {
    const c = row.tint_color;
    if (typeof c === "string" && c.trim() !== "") {
      out[row.asset_id] = c.trim();
    }
  }
  return out;
}
