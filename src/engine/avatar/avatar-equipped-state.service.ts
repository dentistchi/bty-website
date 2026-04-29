/**
 * Per-slot equipped avatar layers (`user_equipped_assets`), aligned with {@link OUTFIT_MANIFEST} `z_index`.
 * Overrides {@link resolveCompositeAssets} asset ids when set and unlocked.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AvatarManifestTierId } from "@/engine/avatar/avatar-manifest.service";
import { getOutfitLayers } from "@/engine/avatar/avatar-manifest.service";
import { assetTypeForEquipConflict } from "@/engine/avatar/avatar-equip-conflict";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const EQUIPPED_SLOT_COUNT = 5 as const;

export const EQUIPPED_STATE_CHANGED_EVENT = "equipped_state_changed" as const;

export type EquippedStateChangedPayload = {
  type: typeof EQUIPPED_STATE_CHANGED_EVENT;
  userId: string;
  slot_index: number;
  asset_id: string;
  at: string;
};

export type EquippedState = {
  user_id: string;
  /** Index = `z_index` / slot 0..4; unused slots are `null`. */
  equipped_asset_ids: (string | null)[];
  slots: { slot_index: number; asset_id: string; equipped_at: string }[];
  updated_at: string;
};

const listeners = new Set<(p: EquippedStateChangedPayload) => void | Promise<void>>();

export function onEquippedStateChanged(
  fn: (p: EquippedStateChangedPayload) => void | Promise<void>,
): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emitEquipped(payload: EquippedStateChangedPayload): void {
  for (const fn of listeners) {
    try {
      void fn(payload);
    } catch {
      /* no-op */
    }
  }
}

function resolveClient(supabase?: SupabaseClient): SupabaseClient | null {
  return supabase ?? getSupabaseAdmin();
}

function clampTier(n: number): AvatarManifestTierId {
  if (n <= 0) return 0;
  if (n >= 4) return 4;
  return n as AvatarManifestTierId;
}

/**
 * Target slot (`z_index`) for an asset on the current tier manifest.
 */
export function resolveEquipSlotIndexForAsset(
  assetId: string,
  tier: AvatarManifestTierId,
): number | null {
  const layers = getOutfitLayers(tier);
  const exact = layers.find((L) => L.default_asset_id === assetId);
  if (exact) return exact.z_index;

  const m = assetId.match(/accessory_slot_(\d+)/i);
  if (m) {
    const want = `accessory_slot_${m[1]}`;
    const hit = layers.find((L) => L.default_asset_id === want);
    if (hit) return hit.z_index;
  }

  const t = assetTypeForEquipConflict(assetId);
  const sameType = layers.filter((L) => L.asset_type === t);
  if (sameType.length === 1) return sameType[0]!.z_index;

  for (const L of sameType) {
    if (assetId.includes(L.layer_id) || L.default_asset_id.includes(assetId.split("_")[0] ?? "")) {
      return L.z_index;
    }
  }

  return sameType[0]?.z_index ?? null;
}

async function fetchCurrentTier(
  userId: string,
  client: SupabaseClient,
): Promise<AvatarManifestTierId> {
  const { data } = await client
    .from("user_avatar_state")
    .select("current_tier")
    .eq("user_id", userId)
    .maybeSingle();
  return clampTier(Number((data as { current_tier?: number } | null)?.current_tier ?? 0));
}

async function userOwnsAsset(
  userId: string,
  assetId: string,
  client: SupabaseClient,
): Promise<boolean> {
  const { data, error } = await client
    .from("user_avatar_assets")
    .select("asset_id")
    .eq("user_id", userId)
    .eq("asset_id", assetId)
    .maybeSingle();

  if (error) {
    console.warn("[userOwnsAsset]", error.message);
    return false;
  }
  return data != null;
}

function emptySlots(): (string | null)[] {
  return Array.from({ length: EQUIPPED_SLOT_COUNT }, () => null);
}

/**
 * Load equipped rows and build a fixed 5-slot view.
 */
export async function getEquippedState(
  userId: string,
  supabase?: SupabaseClient,
): Promise<EquippedState> {
  const client = resolveClient(supabase);
  const now = new Date().toISOString();
  if (!client) {
    return {
      user_id: userId,
      equipped_asset_ids: emptySlots(),
      slots: [],
      updated_at: now,
    };
  }

  const { data, error } = await client
    .from("user_equipped_assets")
    .select("slot_index, asset_id, equipped_at")
    .eq("user_id", userId)
    .order("slot_index", { ascending: true });

  if (error) {
    console.warn("[getEquippedState]", error.message);
    return {
      user_id: userId,
      equipped_asset_ids: emptySlots(),
      slots: [],
      updated_at: now,
    };
  }

  const slots = (data ?? []) as { slot_index: number; asset_id: string; equipped_at: string }[];
  const equipped_asset_ids = emptySlots();
  for (const r of slots) {
    if (r.slot_index >= 0 && r.slot_index < EQUIPPED_SLOT_COUNT) {
      equipped_asset_ids[r.slot_index] = r.asset_id;
    }
  }

  return {
    user_id: userId,
    equipped_asset_ids,
    slots,
    updated_at: slots.length ? slots[slots.length - 1]!.equipped_at : now,
  };
}

/** Compact ordered list for `user_avatar_state.equipped_asset_ids` / API. */
export function equippedIdsCompact(equipped: (string | null)[]): string[] {
  return equipped.filter((x): x is string => x != null && x.trim() !== "");
}

async function syncUserAvatarStateEquippedColumn(
  userId: string,
  equipped: (string | null)[],
  client: SupabaseClient,
): Promise<void> {
  const { data: row } = await client
    .from("user_avatar_state")
    .select("current_tier, unlocked_assets")
    .eq("user_id", userId)
    .maybeSingle();

  const current_tier = clampTier(Number((row as { current_tier?: number } | null)?.current_tier ?? 0));
  const unlocked_assets = Array.isArray((row as { unlocked_assets?: string[] })?.unlocked_assets)
    ? (row as { unlocked_assets: string[] }).unlocked_assets
    : [];

  const { error } = await client.from("user_avatar_state").upsert(
    {
      user_id: userId,
      current_tier,
      unlocked_assets,
      equipped_asset_ids: equippedIdsCompact(equipped),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) {
    console.warn("[syncUserAvatarStateEquippedColumn]", error.message);
  }
}

export type UpdateEquippedSlotOptions = {
  /** When true (e.g. client `slot: "badge"`), use manifest badge layer `z_index` for badge assets. */
  badgeSlot?: boolean;
};

/**
 * Equip `assetId` into its manifest slot for the user’s tier; replaces any prior asset in that slot.
 */
export async function updateEquippedSlot(
  userId: string,
  assetId: string,
  supabase?: SupabaseClient,
  options?: UpdateEquippedSlotOptions,
): Promise<EquippedState> {
  const client = resolveClient(supabase);
  const trimmed = assetId.trim();
  if (!client || !trimmed) {
    return getEquippedState(userId, client ?? undefined);
  }

  const tier = await fetchCurrentTier(userId, client);
  let slot: number | null;
  if (options?.badgeSlot && assetTypeForEquipConflict(trimmed) === "badge") {
    const layers = getOutfitLayers(tier);
    const badgeLayer = layers.find((L) => L.asset_type === "badge");
    slot = badgeLayer?.z_index ?? null;
  } else {
    slot = resolveEquipSlotIndexForAsset(trimmed, tier);
  }
  if (slot == null) {
    throw new Error("ASSET_SLOT_UNRESOLVABLE");
  }

  const owns = await userOwnsAsset(userId, trimmed, client);
  if (!owns) {
    throw new Error("ASSET_NOT_OWNED");
  }

  const now = new Date().toISOString();

  const { error } = await client.from("user_equipped_assets").upsert(
    {
      user_id: userId,
      slot_index: slot,
      asset_id: trimmed,
      equipped_at: now,
    },
    { onConflict: "user_id,slot_index" },
  );

  if (error) {
    throw new Error(error.message);
  }

  const state = await getEquippedState(userId, client);
  await syncUserAvatarStateEquippedColumn(userId, state.equipped_asset_ids, client);

  emitEquipped({
    type: EQUIPPED_STATE_CHANGED_EVENT,
    userId,
    slot_index: slot,
    asset_id: trimmed,
    at: now,
  });

  return state;
}
