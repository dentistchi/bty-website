import type { SupabaseClient } from "@supabase/supabase-js";
import { syncAvatarStateAfterCoreXpChange } from "@/engine/avatar/avatar-state.service";
import { awardSharedXp } from "@/lib/bty/arena/sharedXp.server";

/**
 * Apply seasonal XP to user: add to core using 45:1 (Beginner) or 60:1, update buffer, tier, code_index, default sub_name.
 * One locked SQL update (bty_award_xp_v2): concurrent awards are added, never overwritten.
 * `supabase` is used only for the best-effort avatar refresh; the write uses the service writer.
 */
export async function applySeasonalXpToCore(
  supabase: SupabaseClient,
  userId: string,
  seasonalXp: number
): Promise<{ coreGain: number; newCoreTotal: number } | { error: string }> {
  if (seasonalXp <= 0) return { coreGain: 0, newCoreTotal: 0 };
  const result = await awardSharedXp({ userId, seasonalCoreXp: Math.floor(seasonalXp) });
  if (!result.ok) return { error: result.error };
  const { coreBefore, coreAfter, coreGain } = result.award;
  void syncAvatarStateAfterCoreXpChange(userId, supabase, coreBefore, coreAfter).catch((err) =>
    console.warn("[applySeasonalXpToCore] avatar state sync", err),
  );
  return { coreGain, newCoreTotal: coreAfter };
}

/**
 * Apply direct Core XP (e.g. Lab). No weekly XP, no seasonal conversion.
 * Per docs/spec/ARENA_LAB_XP_SPEC.md — Lab grants Core XP only.
 * One locked SQL update (bty_award_xp_v2): concurrent awards are added, never overwritten.
 */
export async function applyDirectCoreXp(
  supabase: SupabaseClient,
  userId: string,
  coreGain: number
): Promise<{ newCoreTotal: number } | { error: string }> {
  if (coreGain <= 0) return { newCoreTotal: 0 };
  const result = await awardSharedXp({ userId, directCoreXp: Math.floor(coreGain) });
  if (!result.ok) return { error: result.error };
  const { coreBefore, coreAfter } = result.award;
  void syncAvatarStateAfterCoreXpChange(userId, supabase, coreBefore, coreAfter).catch((err) =>
    console.warn("[applyDirectCoreXp] avatar state sync", err),
  );
  return { newCoreTotal: coreAfter };
}
