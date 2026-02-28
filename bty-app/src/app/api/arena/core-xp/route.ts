import { NextRequest, NextResponse } from "next/server";
import { requireUser, unauthenticated, copyCookiesAndDebug } from "@/lib/supabase/route-client";
import {
  CODE_NAMES,
  tierFromCoreXp,
  codeIndexFromTier,
  subTierGroupFromTier,
  resolveSubName,
  type CodeIndex,
} from "@/lib/bty/arena/codes";
import { getEffectiveTrack } from "@/lib/bty/arena/program";
import { getUnlockedContentWindow } from "@/lib/bty/arena/unlock";
import type { Track, LevelId } from "@/lib/bty/arena/tenure";
import { getOutfitForLevel, getCharacterOutfitImageUrl } from "@/lib/bty/arena/avatarOutfits";
import { getAvatarCharacter } from "@/lib/bty/arena/avatarCharacters";

export async function GET(req: NextRequest) {
  const { user, supabase, base } = await requireUser(req);
  if (!user) return unauthenticated(req, base);

  const { data: row, error } = await supabase
    .from("arena_profiles")
    .select("user_id, core_xp_total, code_index, sub_name, sub_name_renamed_in_code, code_hidden, avatar_url, avatar_character_id, avatar_outfit_theme, l4_access")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    const out = NextResponse.json({ error: "DB_ERROR", detail: error.message }, { status: 500 });
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }

  const coreXpTotal =
    row && typeof (row as { core_xp_total?: number }).core_xp_total === "number"
      ? (row as { core_xp_total: number }).core_xp_total
      : 0;
  const tier = tierFromCoreXp(coreXpTotal);
  const codeIndex = (row && typeof (row as { code_index?: number }).code_index === "number"
    ? (row as { code_index: number }).code_index
    : codeIndexFromTier(tier)) as CodeIndex;
  const subTierGroup = subTierGroupFromTier(tier);
  const customSubName = row ? (row as { sub_name?: string | null }).sub_name ?? null : null;
  const codeName = CODE_NAMES[Math.min(6, Math.max(0, codeIndex))];
  const subName = resolveSubName(codeIndex, subTierGroup, customSubName);
  let seasonalXpTotal = 0;
  const { data: wRow } = await supabase
    .from("weekly_xp")
    .select("xp_total")
    .eq("user_id", user.id)
    .is("league_id", null)
    .maybeSingle();
  if (wRow && typeof (wRow as { xp_total?: number }).xp_total === "number") {
    seasonalXpTotal = (wRow as { xp_total: number }).xp_total;
  }

  const myXp = seasonalXpTotal;
  const { count: totalCount } = await supabase
    .from("weekly_xp")
    .select("user_id", { count: "exact", head: true })
    .is("league_id", null);
  const { count: rankAbove } = await supabase
    .from("weekly_xp")
    .select("user_id", { count: "exact", head: true })
    .is("league_id", null)
    .gt("xp_total", myXp);
  const total = totalCount ?? 0;
  const rank = total > 0 ? (rankAbove ?? 0) + 1 : 0;
  const isTop5Percent = total > 0 && rank > 0 && rank <= Math.ceil(0.05 * total);

  const subNameRenameAvailable =
    row &&
    tier >= 25 &&
    !(row as { sub_name_renamed_in_code?: boolean }).sub_name_renamed_in_code &&
    codeIndex < 6 &&
    isTop5Percent;

  if (!row) {
    const defaultOutfit = getOutfitForLevel(null, "S1");
    const out = NextResponse.json({
      coreXpTotal: 0,
      tier: 0,
      codeName: CODE_NAMES[0],
      subName: "Spark",
      seasonalXpTotal: 0,
      codeHidden: false,
      subNameRenameAvailable: false,
      avatarUrl: null,
      avatarCharacterId: null,
      avatarOutfitTheme: null,
      currentOutfit: {
        outfitId: defaultOutfit.outfitId,
        outfitLabel: defaultOutfit.outfitLabel,
        accessoryIds: defaultOutfit.accessoryIds,
        accessoryLabels: defaultOutfit.accessoryLabels,
      },
    });
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }

  const customAvatarUrl = (row as { avatar_url?: string | null }).avatar_url ?? null;
  const avatarCharacterId = (row as { avatar_character_id?: string | null }).avatar_character_id ?? null;
  const avatarOutfitTheme = (row as { avatar_outfit_theme?: "professional" | "fantasy" | null }).avatar_outfit_theme ?? null;
  const l4Access = (row as { l4_access?: boolean }).l4_access === true;

  let maxUnlockedLevel: LevelId = "S1";
  const { data: membershipRequest } = await supabase
    .from("arena_membership_requests")
    .select("job_function, joined_at, leader_started_at, status")
    .eq("user_id", user.id)
    .maybeSingle();
  if (membershipRequest?.status === "approved") {
    const joinedAt = membershipRequest.joined_at
      ? new Date(membershipRequest.joined_at).toISOString()
      : new Date().toISOString();
    const leaderStartedAt = membershipRequest.leader_started_at
      ? new Date(membershipRequest.leader_started_at).toISOString()
      : null;
    const track = getEffectiveTrack({
      jobFunction: membershipRequest.job_function ?? undefined,
      membershipRole: undefined,
      joinedAt,
    }) as Track;
    const window = getUnlockedContentWindow({
      track,
      user: { joinedAt, leaderStartedAt },
      now: new Date(),
      l4Granted: l4Access,
      jobFunction: membershipRequest.job_function ?? undefined,
    });
    maxUnlockedLevel = window.maxUnlockedLevel;
  }

  const outfit = getOutfitForLevel(avatarOutfitTheme, maxUnlockedLevel);

  let avatarUrl: string | null = customAvatarUrl;
  if (!avatarUrl) {
    const characterOutfitUrl =
      avatarOutfitTheme === "fantasy"
        ? getCharacterOutfitImageUrl(avatarCharacterId)
        : null;
    if (characterOutfitUrl) {
      avatarUrl = characterOutfitUrl;
    } else if (outfit.imageUrl) {
      avatarUrl = outfit.imageUrl;
    } else if (avatarCharacterId) {
      const character = getAvatarCharacter(avatarCharacterId);
      if (character?.imageUrl) avatarUrl = character.imageUrl;
    }
  }

  const out = NextResponse.json({
    coreXpTotal,
    tier,
    codeName,
    subName,
    seasonalXpTotal,
    codeHidden: coreXpTotal >= 700,
    subNameRenameAvailable: Boolean(subNameRenameAvailable),
    avatarUrl,
    avatarCharacterId,
    avatarOutfitTheme,
    currentOutfit: {
      outfitId: outfit.outfitId,
      outfitLabel: outfit.outfitLabel,
      accessoryIds: outfit.accessoryIds,
      accessoryLabels: outfit.accessoryLabels,
    },
  });
  copyCookiesAndDebug(base, out, req, true);
  return out;
}
