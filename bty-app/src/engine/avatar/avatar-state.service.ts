/**
 * Avatar progression by **display** Core XP bands (독립적 internal `tierFromCoreXp` 와 별개).
 * Core XP 반영 후 `syncAvatarStateAfterCoreXpChange`로 `user_avatar_state` 갱신·티어 상승 이벤트.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServerClient } from "@/lib/bty/arena/supabaseServer";
import {
  getOutfitTintByAssetId,
  persistTierUnlockAssetsFromEvent,
  unlockedAssetsForTier,
} from "./avatar-assets.service";
import { AVATAR_TIER_THRESHOLDS } from "./avatar-manifest.service";
import { equippedIdsCompact, getEquippedState } from "./avatar-equipped-state.service";

export { AVATAR_TIER_THRESHOLDS };

/** 0 = 0–499, 1 = 500–1499, …, 4 = 7000+. */
export type AvatarTier = 0 | 1 | 2 | 3 | 4;

export const AVATAR_TIER_UPGRADED_EVENT = "avatar_tier_upgraded" as const;

export type AvatarTierUpgradedPayload = {
  type: typeof AVATAR_TIER_UPGRADED_EVENT;
  userId: string;
  previousTier: AvatarTier;
  newTier: AvatarTier;
  at: string;
};

export type AvatarState = {
  user_id: string;
  current_tier: AvatarTier;
  unlocked_assets: string[];
  /** Subset of unlocked assets selected for display (see POST `/api/bty/avatar/equip`). */
  equipped_asset_ids: string[];
  /** Per-slot 0..4 (`z_index`); from `user_equipped_assets`. */
  equipped_slots?: (string | null)[];
  core_xp_total?: number;
  /** Outfit asset_id → stored #RRGGBB from `user_avatar_assets.tint_color`. */
  outfit_tint_by_asset_id?: Record<string, string>;
};

export { unlockedAssetsForTier };

let tierUpgradeHandler: ((e: AvatarTierUpgradedPayload) => void) | undefined;

const avatarTierUpgradeListeners = new Set<
  (e: AvatarTierUpgradedPayload) => void | Promise<void>
>();

/** Subscribe to tier-upgraded events (same payload as {@link AVATAR_TIER_UPGRADED_EVENT}). */
export function onAvatarTierUpgraded(
  fn: (e: AvatarTierUpgradedPayload) => void | Promise<void>,
): () => void {
  avatarTierUpgradeListeners.add(fn);
  return () => avatarTierUpgradeListeners.delete(fn);
}

/** 테스트·분석용: 티어 상승 시 1회 콜백. */
export function setAvatarTierUpgradeHandler(
  fn: ((e: AvatarTierUpgradedPayload) => void) | undefined,
): void {
  tierUpgradeHandler = fn;
}

export function computeTier(coreXp: number): AvatarTier {
  const x = Math.max(0, Math.floor(Number(coreXp)));
  let tier: AvatarTier = 0;
  for (let i = 0; i < AVATAR_TIER_THRESHOLDS.length; i++) {
    if (x >= AVATAR_TIER_THRESHOLDS[i]) tier = i as AvatarTier;
  }
  return tier;
}

/**
 * Progress within the current avatar tier band toward the next threshold (0–1).
 * Tier 4 is max — returns progress 1 and no next threshold.
 */
export function nextAvatarTierProgress(
  coreXp: number,
  currentTier: AvatarTier,
): {
  progress01: number;
  nextThresholdXp: number | null;
  currentBandMinXp: number;
} {
  const th = AVATAR_TIER_THRESHOLDS;
  if (currentTier >= 4) {
    return { progress01: 1, nextThresholdXp: null, currentBandMinXp: th[4] };
  }
  const curMin = th[currentTier];
  const nextAt = th[currentTier + 1];
  const span = nextAt - curMin;
  const x = Math.max(0, Math.floor(Number(coreXp)));
  const within = x - curMin;
  const progress01 = span > 0 ? Math.min(1, Math.max(0, within / span)) : 0;
  return {
    progress01,
    nextThresholdXp: nextAt,
    currentBandMinXp: curMin,
  };
}

function clampAvatarTier(n: number): AvatarTier {
  if (n <= 0) return 0;
  if (n >= 4) return 4;
  return n as AvatarTier;
}

/**
 * Core XP 반영 직후 호출: `user_avatar_state`를 갱신하고 티어가 올랐으면 이벤트를 내보낸다.
 */
export async function syncAvatarStateAfterCoreXpChange(
  userId: string,
  supabase: SupabaseClient,
  previousCoreXp: number,
  newCoreXp: number,
): Promise<{ tierChanged: boolean; event: AvatarTierUpgradedPayload | null }> {
  const prevTier = computeTier(previousCoreXp);
  const nextTier = computeTier(newCoreXp);
  const unlocked = unlockedAssetsForTier(nextTier);
  const now = new Date().toISOString();

  const eq = await getEquippedState(userId, supabase);
  const equipped_asset_ids = equippedIdsCompact(eq.equipped_asset_ids);

  const { error } = await supabase.from("user_avatar_state").upsert(
    {
      user_id: userId,
      current_tier: nextTier,
      unlocked_assets: unlocked,
      equipped_asset_ids,
      updated_at: now,
    },
    { onConflict: "user_id" },
  );

  if (error) {
    console.warn("[syncAvatarStateAfterCoreXpChange]", error.message);
    return { tierChanged: false, event: null };
  }

  void import("./avatar-composite-snapshot.service").then(async (m) => {
    await m.invalidateSnapshot(userId, supabase);
    await m.persistSnapshotForUser(userId, supabase);
  }).catch(() => {});

  void import("./avatar-outfit-unlock.service").then((m) =>
    m.checkOutfitUnlocks(userId, supabase).catch((err) =>
      console.warn("[checkOutfitUnlocks]", err),
    ),
  );

  if (prevTier !== nextTier) {
    const event: AvatarTierUpgradedPayload = {
      type: AVATAR_TIER_UPGRADED_EVENT,
      userId,
      previousTier: prevTier,
      newTier: nextTier,
      at: now,
    };
    try {
      tierUpgradeHandler?.(event);
      for (const fn of avatarTierUpgradeListeners) {
        try {
          void fn(event);
        } catch (e) {
          console.warn("[onAvatarTierUpgraded]", e);
        }
      }
    } catch (e) {
      console.warn("[avatar_tier_upgraded handler]", e);
    }
    void import("@/engine/integration/notification-router.service").then((m) =>
      m.insertNotificationForEvent(event.userId, "avatar_tier_upgraded").catch(() => {}),
    );
    void persistTierUnlockAssetsFromEvent(event, supabase).catch((err) =>
      console.warn("[persistTierUnlockAssetsFromEvent]", err),
    );
    return { tierChanged: true, event };
  }

  return { tierChanged: false, event: null };
}

/**
 * 저장된 avatar state 또는 `arena_profiles.core_xp_total`로 계산한 기본값.
 */
export async function getAvatarState(
  userId: string,
  supabase?: SupabaseClient,
): Promise<AvatarState> {
  const client = supabase ?? (await getSupabaseServerClient());

  const { data: row, error } = await client
    .from("user_avatar_state")
    .select("user_id, current_tier, unlocked_assets, equipped_asset_ids")
    .eq("user_id", userId)
    .maybeSingle();

  const equippedFromTable = await getEquippedState(userId, client);
  const outfit_tint_by_asset_id = await getOutfitTintByAssetId(userId, client);

  if (!error && row) {
    const t = clampAvatarTier(Number((row as { current_tier?: number }).current_tier ?? 0));
    const assets = (row as { unlocked_assets?: string[] }).unlocked_assets;
    return {
      user_id: userId,
      current_tier: t,
      unlocked_assets: Array.isArray(assets) ? assets : unlockedAssetsForTier(t),
      equipped_asset_ids: equippedIdsCompact(equippedFromTable.equipped_asset_ids),
      equipped_slots: equippedFromTable.equipped_asset_ids,
      outfit_tint_by_asset_id,
    };
  }

  const { data: prof } = await client
    .from("arena_profiles")
    .select("core_xp_total")
    .eq("user_id", userId)
    .maybeSingle();

  const core = Math.max(0, Number((prof as { core_xp_total?: number } | null)?.core_xp_total ?? 0));
  const t = computeTier(core);
  return {
    user_id: userId,
    current_tier: t,
    unlocked_assets: unlockedAssetsForTier(t),
    equipped_asset_ids: equippedIdsCompact(equippedFromTable.equipped_asset_ids),
    equipped_slots: equippedFromTable.equipped_asset_ids,
    core_xp_total: core,
    outfit_tint_by_asset_id,
  };
}

/** Unlocked asset ids for the user’s current tier (from {@link getAvatarState}). */
export async function getUnlockedAssets(
  userId: string,
  supabase?: SupabaseClient,
): Promise<string[]> {
  const state = await getAvatarState(userId, supabase);
  return [...state.unlocked_assets];
}
