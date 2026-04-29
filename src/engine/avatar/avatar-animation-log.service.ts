/**
 * Persists avatar CSS animation triggers (`AvatarAnimationPreset`) for the customizer activity feed
 * and 30-day preset counts for integrity resilience adjustment.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const AVATAR_ANIMATION_PRESETS = [
  "TIER_UP",
  "OUTFIT_UNLOCK",
  "INTEGRITY_SLIP",
  "CLEAN_STREAK",
] as const;

export type AvatarAnimationPresetId = (typeof AVATAR_ANIMATION_PRESETS)[number];

export type AnimationLogEntry = {
  id: string;
  user_id: string;
  preset: AvatarAnimationPresetId;
  triggered_by_event: string;
  triggered_at: string;
};

/** Count per preset over the rolling window (default last 30 days). */
export type AnimationStats = Record<AvatarAnimationPresetId, number>;

const EMPTY_STATS: AnimationStats = {
  TIER_UP: 0,
  OUTFIT_UNLOCK: 0,
  INTEGRITY_SLIP: 0,
  CLEAN_STREAK: 0,
};

function resolveClient(supabase?: SupabaseClient): SupabaseClient | null {
  return supabase ?? getSupabaseAdmin();
}

function isPreset(s: string): s is AvatarAnimationPresetId {
  return (AVATAR_ANIMATION_PRESETS as readonly string[]).includes(s);
}

/**
 * Records one animation play (typically from POST `/api/bty/avatar/animation-log` after client trigger).
 */
export async function logAvatarAnimation(
  userId: string,
  preset: AvatarAnimationPresetId,
  triggeredByEvent: string,
  supabase?: SupabaseClient,
): Promise<void> {
  const client = resolveClient(supabase);
  if (!client) return;

  const { error } = await client.from("avatar_animation_log").insert({
    user_id: userId,
    preset,
    triggered_by_event: triggeredByEvent.trim() || preset,
    triggered_at: new Date().toISOString(),
  });

  if (error) {
    console.warn("[logAvatarAnimation]", error.message);
  }
}

/**
 * Recent animation triggers for {@link AvatarCustomizerPanel} activity feed.
 */
export async function getAnimationHistory(
  userId: string,
  limit = 20,
  supabase?: SupabaseClient,
): Promise<AnimationLogEntry[]> {
  const client = resolveClient(supabase);
  if (!client) return [];

  const lim = Math.min(100, Math.max(1, Math.floor(Number(limit)) || 20));
  const { data, error } = await client
    .from("avatar_animation_log")
    .select("id, user_id, preset, triggered_by_event, triggered_at")
    .eq("user_id", userId)
    .order("triggered_at", { ascending: false })
    .limit(lim);

  if (error) {
    console.warn("[getAnimationHistory]", error.message);
    return [];
  }

  const rows = (data ?? []) as Record<string, unknown>[];
  const out: AnimationLogEntry[] = [];
  for (const r of rows) {
    const preset = typeof r.preset === "string" && isPreset(r.preset) ? r.preset : null;
    if (!preset) continue;
    out.push({
      id: String(r.id ?? ""),
      user_id: String(r.user_id ?? userId),
      preset,
      triggered_by_event: String(r.triggered_by_event ?? preset),
      triggered_at: String(r.triggered_at ?? ""),
    });
  }
  return out;
}

/**
 * Count per preset in the last `windowDays` (default 30) — used as a behavioral signal for resilience.
 */
export async function getAnimationStats(
  userId: string,
  supabase?: SupabaseClient,
  windowDays = 30,
): Promise<AnimationStats> {
  const client = resolveClient(supabase);
  if (!client) return { ...EMPTY_STATS };

  const days = Math.min(365, Math.max(1, Math.floor(Number(windowDays)) || 30));
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await client
    .from("avatar_animation_log")
    .select("preset")
    .eq("user_id", userId)
    .gte("triggered_at", since);

  if (error) {
    console.warn("[getAnimationStats]", error.message);
    return { ...EMPTY_STATS };
  }

  const stats: AnimationStats = { ...EMPTY_STATS };
  for (const row of data ?? []) {
    const p = (row as { preset?: string }).preset;
    if (typeof p === "string" && isPreset(p)) {
      stats[p] += 1;
    }
  }
  return stats;
}

/** Penalty points subtracted from raw resilience score before composite (capped). */
export function resiliencePenaltyFromIntegritySlipAnimations(
  stats: AnimationStats,
  opts?: { perSlip?: number; cap?: number },
): number {
  const per = opts?.perSlip ?? 2;
  const cap = opts?.cap ?? 18;
  return Math.min(cap, stats.INTEGRITY_SLIP * per);
}
