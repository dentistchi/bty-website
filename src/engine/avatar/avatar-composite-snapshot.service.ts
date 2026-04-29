/**
 * Persists precomputed {@link ResolvedLayer} rows for instant avatar composite hydration.
 * Refreshes on {@link EQUIPPED_STATE_CHANGED_EVENT} and {@link AVATAR_TIER_UPGRADED_EVENT};
 * {@link invalidateSnapshot} clears cache when state changes elsewhere.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  resolveCompositeAssets,
  type AvatarManifestTierId,
  type ResolvedLayer,
} from "@/engine/avatar/avatar-manifest.service";
import {
  getAvatarState,
  onAvatarTierUpgraded,
} from "@/engine/avatar/avatar-state.service";
import { onEquippedStateChanged } from "@/engine/avatar/avatar-equipped-state.service";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export type CompositeSnapshot = {
  user_id: string;
  tier: AvatarManifestTierId;
  layers: ResolvedLayer[];
  snapped_at: string | null;
};

function resolveClient(supabase?: SupabaseClient): SupabaseClient | null {
  return supabase ?? getSupabaseAdmin();
}

function buildLayersFromState(state: Awaited<ReturnType<typeof getAvatarState>>): ResolvedLayer[] {
  const tier = state.current_tier as AvatarManifestTierId;
  const slots = state.equipped_slots ?? null;
  const legacy = state.equipped_asset_ids ?? [];
  return resolveCompositeAssets(
    tier,
    state.unlocked_assets,
    slots != null ? undefined : legacy,
    slots,
    state.outfit_tint_by_asset_id ?? null,
  );
}

/**
 * Recomputes layers from current avatar + equipped state and upserts `avatar_composite_snapshots`.
 */
export async function persistSnapshotForUser(
  userId: string,
  supabase?: SupabaseClient,
): Promise<CompositeSnapshot | null> {
  const client = resolveClient(supabase);
  if (!client) return null;

  const state = await getAvatarState(userId, client);
  const layers = buildLayersFromState(state);
  const tier = state.current_tier as AvatarManifestTierId;
  const snapped_at = new Date().toISOString();

  const { error } = await client.from("avatar_composite_snapshots").upsert(
    {
      user_id: userId,
      tier,
      layers_json: JSON.parse(JSON.stringify(layers)) as unknown[],
      snapped_at,
    },
    { onConflict: "user_id" },
  );

  if (error) {
    console.warn("[persistSnapshotForUser]", error.message);
    return null;
  }

  return { user_id: userId, tier, layers, snapped_at };
}

/** Deletes the cached snapshot so the next read refetches / recomputes. */
export async function invalidateSnapshot(
  userId: string,
  supabase?: SupabaseClient,
): Promise<void> {
  const client = resolveClient(supabase);
  if (!client) return;
  const { error } = await client.from("avatar_composite_snapshots").delete().eq("user_id", userId);
  if (error) {
    console.warn("[invalidateSnapshot]", error.message);
  }
}

function parseLayersJson(raw: unknown): ResolvedLayer[] {
  if (!Array.isArray(raw)) return [];
  return raw as ResolvedLayer[];
}

/**
 * Latest cached composite for `userId`, or empty layers when missing / error.
 */
export async function getLatestSnapshot(
  userId: string,
  supabase?: SupabaseClient,
): Promise<CompositeSnapshot> {
  const client = resolveClient(supabase);
  const empty: CompositeSnapshot = {
    user_id: userId,
    tier: 0,
    layers: [],
    snapped_at: null,
  };
  if (!client) return empty;

  const { data, error } = await client
    .from("avatar_composite_snapshots")
    .select("tier, layers_json, snapped_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.warn("[getLatestSnapshot]", error.message);
    return empty;
  }
  if (!data) return empty;

  const row = data as { tier?: number; layers_json?: unknown; snapped_at?: string };
  const tier = Math.min(4, Math.max(0, Number(row.tier ?? 0))) as AvatarManifestTierId;
  return {
    user_id: userId,
    tier,
    layers: parseLayersJson(row.layers_json),
    snapped_at: typeof row.snapped_at === "string" ? row.snapped_at : null,
  };
}

let subscribed = false;

function ensureSnapshotHooks(): void {
  if (subscribed) return;
  subscribed = true;

  onEquippedStateChanged((p) => {
    void persistSnapshotForUser(p.userId).catch(() => {});
  });

  onAvatarTierUpgraded((e) => {
    void persistSnapshotForUser(e.userId).catch(() => {});
  });
}

if (typeof window === "undefined") {
  ensureSnapshotHooks();
}
