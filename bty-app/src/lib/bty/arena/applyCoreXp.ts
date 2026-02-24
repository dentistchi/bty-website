import type { SupabaseClient } from "@supabase/supabase-js";
import {
  tierFromCoreXp,
  codeIndexFromTier,
  subTierGroupFromTier,
  seasonalToCoreConversion,
  SUB_NAMES,
  type CodeIndex,
} from "./codes";

type ProfileRow = {
  core_xp_total?: number;
  core_xp_buffer?: number;
  sub_name?: string | null;
  sub_name_renamed_in_code?: boolean;
};

/**
 * Apply seasonal XP to user: add to core using 45:1 (Beginner) or 60:1, update buffer, tier, code_index, default sub_name.
 * Call after adding seasonal XP to weekly_xp (or seasonal table). Idempotent per run via RUN_COMPLETED_APPLIED.
 */
export async function applySeasonalXpToCore(
  supabase: SupabaseClient,
  userId: string,
  seasonalXp: number
): Promise<{ coreGain: number; newCoreTotal: number } | { error: string }> {
  if (seasonalXp <= 0) return { coreGain: 0, newCoreTotal: 0 };

  const { data: prof, error: e0 } = await supabase
    .from("arena_profiles")
    .select("core_xp_total, core_xp_buffer, sub_name, sub_name_renamed_in_code")
    .eq("user_id", userId)
    .maybeSingle();

  if (e0) return { error: e0.message };

  if (!prof) {
    const { error: insErr } = await supabase.from("arena_profiles").insert({
      user_id: userId,
      core_xp_total: 0,
      core_xp_buffer: 0,
      tier: 0,
      code_index: 0,
      sub_name: "Spark",
      sub_name_renamed_in_code: false,
      stage: 1,
      code_hidden: false,
    });
    if (insErr) return { error: insErr.message };
  }

  const currentCore = Math.max(0, Number((prof as ProfileRow)?.core_xp_total ?? 0));
  const currentBuffer = Math.max(0, Number((prof as ProfileRow)?.core_xp_buffer ?? 0));
  const renamedInCode = Boolean((prof as ProfileRow)?.sub_name_renamed_in_code);
  const existingSubName = (prof as ProfileRow)?.sub_name ?? null;

  const { coreGain, fractionalBuffer } = seasonalToCoreConversion(seasonalXp, currentCore);
  let newBuffer = currentBuffer + fractionalBuffer;
  let coreFromBuffer = Math.floor(newBuffer);
  newBuffer = newBuffer - coreFromBuffer;
  const totalCoreGain = coreGain + coreFromBuffer;
  const newCoreTotal = currentCore + totalCoreGain;

  const tier = tierFromCoreXp(newCoreTotal);
  const codeIndex = codeIndexFromTier(tier) as CodeIndex;
  const subTierGroup = subTierGroupFromTier(tier);
  const defaults = SUB_NAMES[codeIndex];
  const newSubName =
    renamedInCode || defaults == null ? existingSubName : defaults[subTierGroup];

  const update: Record<string, unknown> = {
    core_xp_total: newCoreTotal,
    core_xp_buffer: newBuffer,
    tier,
    code_index: codeIndex,
    stage: Math.min(7, Math.floor(newCoreTotal / 100) + 1),
    code_hidden: newCoreTotal >= 700,
  };
  if (defaults != null && !renamedInCode && newSubName != null) update.sub_name = newSubName;

  const { error: e1 } = await supabase
    .from("arena_profiles")
    .update(update)
    .eq("user_id", userId);

  if (e1) return { error: e1.message };
  return { coreGain: totalCoreGain, newCoreTotal };
}
