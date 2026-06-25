import type { SupabaseClient } from "@supabase/supabase-js";
import { syncAvatarStateAfterCoreXpChange } from "@/engine/avatar/avatar-state.service";
import {
  tierFromCoreXp,
  codeIndexFromTier,
  subTierGroupFromTier,
  SUB_NAMES,
  type CodeIndex,
} from "@/lib/bty/arena/codes";

type ProfileRow = {
  sub_name?: string | null;
  sub_name_renamed_in_code?: boolean;
};

/**
 * Project arena_profiles' derived fields from an ALREADY-updated core_xp_total.
 *
 * The Event scan RPC (`bty_event_scan_award`) commits the permanent
 * `core_xp_total` atomically with the participation insert. The downstream
 * fields — tier / code_index / sub_name / stage / code_hidden — and avatar
 * growth are pure projections of core_xp_total; banding + avatar live in the
 * domain/TS layer (the migrations rule forbids domain computation in SQL), so
 * they are recomputed here OUTSIDE the RPC transaction.
 *
 * This mirrors the recompute half of `applyDirectCoreXp` but does NOT add XP
 * (the RPC already did). It is therefore safe to run after the RPC and is a
 * best-effort no-op on failure — the permanent Core XP is already correct, so a
 * transient projection failure self-heals on the user's next Core XP event.
 *
 * @param newCoreTotal post-award core_xp_total returned by the RPC
 * @param deltaXp the XP just awarded (used to derive the previous total for the
 *                avatar tier-change diff)
 */
export async function reprojectCoreDerivedFields(
  supabase: SupabaseClient,
  userId: string,
  newCoreTotal: number,
  deltaXp: number,
): Promise<void> {
  const { data: prof } = await supabase
    .from("arena_profiles")
    .select("sub_name, sub_name_renamed_in_code")
    .eq("user_id", userId)
    .maybeSingle();

  const renamedInCode = Boolean((prof as ProfileRow | null)?.sub_name_renamed_in_code);
  const existingSubName = (prof as ProfileRow | null)?.sub_name ?? null;

  const tier = tierFromCoreXp(newCoreTotal);
  const codeIndex = codeIndexFromTier(tier) as CodeIndex;
  const subTierGroup = subTierGroupFromTier(tier);
  const defaults = SUB_NAMES[codeIndex];
  const newSubName =
    renamedInCode || defaults == null ? existingSubName : defaults[subTierGroup];

  const update: Record<string, unknown> = {
    tier,
    code_index: codeIndex,
    stage: Math.min(7, Math.floor(newCoreTotal / 100) + 1),
    code_hidden: newCoreTotal >= 700,
    updated_at: new Date().toISOString(),
  };
  if (defaults != null && !renamedInCode && newSubName != null) update.sub_name = newSubName;

  await supabase.from("arena_profiles").update(update).eq("user_id", userId);

  const previousCoreXp = Math.max(0, newCoreTotal - deltaXp);
  await syncAvatarStateAfterCoreXpChange(userId, supabase, previousCoreXp, newCoreTotal).catch(
    (err) => console.warn("[reprojectCoreDerivedFields] avatar state sync", err),
  );
}
