/**
 * Client snapshot cache + GET `/api/bty/avatar/snapshot` for {@link AvatarComposite} fast paint.
 */

import type { ResolvedLayer } from "@/engine/avatar/avatar-manifest.service";

export type AvatarSnapshot = {
  user_id: string;
  current_tier: number;
  unlocked_assets: string[];
  equipped_asset_ids?: string[];
  equipped_slots?: (string | null)[] | null;
  outfit_tint_by_asset_id?: Record<string, string>;
  core_xp_total: number;
  tier_thresholds: number[];
  core_xp_breakdown?: {
    arenaPct: number;
    labPct: number;
    foundryPct: number;
    mentorPct: number;
    otherPct: number;
  };
  /** Precomputed layers from `avatar_composite_snapshots` (optional until first server persist). */
  composite_tier?: number | null;
  composite_layers?: ResolvedLayer[] | null;
  composite_snapped_at?: string | null;
};

function storageKey(userId: string): string {
  return `bty.avatar.snapshot.v1:${userId.trim()}`;
}

export async function getLatestSnapshot(userId: string): Promise<AvatarSnapshot | null> {
  const uid = userId.trim();
  if (!uid) return null;

  const res = await fetch(`/api/bty/avatar/snapshot?userId=${encodeURIComponent(uid)}`, {
    credentials: "include",
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { snapshot?: AvatarSnapshot | null; error?: string };
  if (json.error || !json.snapshot) return null;
  const s = json.snapshot;
  return {
    ...s,
    composite_layers: Array.isArray(s.composite_layers) ? s.composite_layers : null,
  };
}

export function persistSnapshot(userId: string, snapshot: AvatarSnapshot): void {
  try {
    sessionStorage.setItem(storageKey(userId), JSON.stringify(snapshot));
  } catch {
    /* no-op */
  }
}

export function invalidateSnapshot(userId: string): void {
  try {
    sessionStorage.removeItem(storageKey(userId));
  } catch {
    /* no-op */
  }
}
