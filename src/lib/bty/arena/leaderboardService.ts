/**
 * Leaderboard service layer.
 * Extracts scope filtering, profile fetch, row building, and rank computation
 * from the /api/arena/leaderboard route into reusable, testable functions.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CODE_NAMES,
  tierFromCoreXp,
  codeIndexFromTier,
  subTierGroupFromTier,
  resolveSubName,
  type CodeIndex,
} from "@/lib/bty/arena/codes";
import {
  tierToDisplayLevelId,
  resolveDisplayAvatarUrl,
  resolveDisplayAvatarLayers,
  profileToAvatarCompositeKeys,
} from "@/lib/bty/arena/avatarOutfits";
import type { LevelId } from "@/lib/bty/arena/tenure";
import { roleToScopeLabel } from "@/lib/bty/arena/leaderboardScope";
import { calculateTier, type WeeklyTierName } from "@/lib/bty/arena/domain";
import { rankFromCountAbove } from "@/domain/rules/leaderboard";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type WeeklyXpRow = {
  user_id: string;
  xp_total?: number;
  updated_at?: string | null;
};

export type NormalizedProfile = {
  core_xp_total: number;
  code_index: number;
  sub_name: string | null;
  avatar_url: string | null;
  avatar_character_id: string | null;
  avatar_outfit_theme: "professional" | "fantasy" | null;
  avatar_selected_outfit_id: string | null;
  avatar_accessory_ids: string[];
};

export type LeaderboardRow = {
  /** Arena user id — for highlighting current viewer (weekly rank only; no extra rules in UI). */
  userId: string;
  /** Lifetime Core XP from profile (display only; not used for weekly ordering). */
  coreXpTotal: number;
  rank: number;
  codeName: string;
  subName: string;
  xpTotal: number;
  avatarUrl: string;
  avatarLayers?: { characterImageUrl: string | null; outfitImageUrl: string | null };
  avatar: {
    characterKey: string;
    theme: "professional" | "fantasy";
    outfitKey: string | null;
    accessoryKeys: string[];
  };
  tier: WeeklyTierName;
};

export type ScopeFilterResult = {
  userIds: string[];
  scopeLabel: string | null;
};

export type MyRankInfo = {
  myRank: number;
  myXp: number;
  gapToAbove: number | null;
};

// ---------------------------------------------------------------------------
// getScopeFilter
// ---------------------------------------------------------------------------

export async function getScopeFilter(
  admin: SupabaseClient | null,
  userId: string,
  scope: "overall" | "role" | "office",
): Promise<ScopeFilterResult | null> {
  if (scope === "overall" || !admin) return null;

  if (scope === "role") {
    const { data: myRows } = await admin
      .from("memberships")
      .select("org_id, region_id, role")
      .eq("user_id", userId)
      .eq("status", "active")
      .limit(1);
    const first = myRows?.[0] as
      | { org_id?: string; region_id?: string; role?: string }
      | undefined;
    if (!first?.org_id || !first?.region_id || !first?.role)
      return { userIds: [], scopeLabel: null };
    const { data: peerRows } = await admin
      .from("memberships")
      .select("user_id")
      .eq("org_id", first.org_id)
      .eq("region_id", first.region_id)
      .eq("role", first.role)
      .eq("status", "active");
    const userIds = (peerRows ?? [])
      .map((r: { user_id: string }) => r.user_id)
      .filter(Boolean);
    const scopeLabel = roleToScopeLabel(first.role);
    return { userIds, scopeLabel };
  }

  // scope === "office"
  const { data: myAssignments } = await admin
    .from("office_assignments")
    .select("office_id")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("is_primary", { ascending: false })
    .limit(1);
  const officeId = (myAssignments?.[0] as { office_id?: string } | undefined)
    ?.office_id;
  if (!officeId) return { userIds: [], scopeLabel: null };
  const { data: officeRow } = await admin
    .from("offices")
    .select("name")
    .eq("id", officeId)
    .maybeSingle();
  const scopeLabel = (officeRow as { name?: string } | null)?.name ?? null;
  const { data: officeUsers } = await admin
    .from("office_assignments")
    .select("user_id")
    .eq("office_id", officeId)
    .eq("status", "active");
  const userIds = [
    ...new Set(
      (officeUsers ?? [])
        .map((r: { user_id: string }) => r.user_id)
        .filter(Boolean),
    ),
  ];
  return { userIds, scopeLabel };
}

// ---------------------------------------------------------------------------
// fetchWeeklyXpRows
// ---------------------------------------------------------------------------

export async function fetchWeeklyXpRows(
  db: SupabaseClient,
  filterUserIds: string[] | null,
  limit = 100,
): Promise<{ rows: WeeklyXpRow[] | null; error: string | null }> {
  if (filterUserIds !== null && filterUserIds.length === 0) {
    return { rows: [], error: null };
  }

  let query = db
    .from("weekly_xp")
    .select("user_id, xp_total, updated_at")
    .is("league_id", null)
    .order("xp_total", { ascending: false })
    .order("updated_at", { ascending: true })
    .order("user_id", { ascending: true })
    .limit(limit);

  if (filterUserIds != null && filterUserIds.length > 0) {
    query = query.in("user_id", filterUserIds);
  }

  const { data, error } = await query;
  return {
    rows: data as WeeklyXpRow[] | null,
    error: error ? error.message : null,
  };
}

// ---------------------------------------------------------------------------
// fetchProfileMap
// ---------------------------------------------------------------------------

type ProfileRow = {
  user_id: string;
  core_xp_total?: number;
  code_index?: number;
  sub_name?: string | null;
  avatar_url?: string | null;
  avatar_character_id?: string | null;
  avatar_outfit_theme?: "professional" | "fantasy" | null;
  avatar_selected_outfit_id?: string | null;
  avatar_accessory_ids?: string[] | null;
};

const PROFILE_SELECT =
  "user_id, core_xp_total, code_index, sub_name, avatar_url, avatar_character_id, avatar_outfit_theme, avatar_selected_outfit_id, avatar_accessory_ids";
const PROFILE_SELECT_LEGACY =
  "user_id, core_xp_total, code_index, sub_name, avatar_url, avatar_character_id, avatar_outfit_theme, avatar_selected_outfit_id";

function normalizeProfile(p: ProfileRow): NormalizedProfile {
  const theme =
    p.avatar_outfit_theme === "fantasy" || p.avatar_outfit_theme === "professional"
      ? p.avatar_outfit_theme
      : null;
  const accessoryIds = Array.isArray(p.avatar_accessory_ids)
    ? p.avatar_accessory_ids.filter((x): x is string => typeof x === "string")
    : [];
  return {
    core_xp_total: Number(p.core_xp_total ?? 0),
    code_index: Math.min(6, Math.max(0, Number(p.code_index ?? 0))),
    sub_name: p.sub_name ?? null,
    avatar_url: p.avatar_url ?? null,
    avatar_character_id: p.avatar_character_id ?? null,
    avatar_outfit_theme: theme,
    avatar_selected_outfit_id: p.avatar_selected_outfit_id ?? null,
    avatar_accessory_ids: accessoryIds,
  };
}

export async function fetchProfileMap(
  admin: SupabaseClient | null,
  supabase: SupabaseClient,
  userIds: string[],
): Promise<Map<string, NormalizedProfile>> {
  const map = new Map<string, NormalizedProfile>();
  if (userIds.length === 0) return map;

  if (admin) {
    let profiles: ProfileRow[] | null = null;
    const { data, error: selErr } = await admin
      .from("arena_profiles")
      .select(PROFILE_SELECT)
      .in("user_id", userIds);
    if (
      selErr &&
      typeof selErr.message === "string" &&
      (selErr.message.includes("does not exist") || selErr.message.includes("column"))
    ) {
      const { data: legacy } = await admin
        .from("arena_profiles")
        .select(PROFILE_SELECT_LEGACY)
        .in("user_id", userIds);
      profiles = (legacy ?? []).map((p: ProfileRow) => ({
        ...p,
        avatar_accessory_ids: [],
      }));
    } else {
      profiles = data;
    }
    (profiles ?? []).forEach((p: ProfileRow) => {
      map.set(p.user_id, normalizeProfile(p));
    });
  } else {
    const { data: profiles } = await supabase.rpc("get_leaderboard_profiles", {
      p_user_ids: userIds,
    });
    (profiles ?? []).forEach((p: ProfileRow) => {
      map.set(p.user_id, normalizeProfile(p));
    });
  }

  return map;
}

// ---------------------------------------------------------------------------
// buildLeaderboardRows
// ---------------------------------------------------------------------------

function resolveAvatarUrl(
  userId: string,
  prof: NormalizedProfile | undefined,
  levelId: LevelId,
): { avatarUrl: string; avatarLayers?: { characterImageUrl: string | null; outfitImageUrl: string | null } } {
  if (!prof) return { avatarUrl: "/avatars/default-avatar.svg" };

  const opts = {
    customAvatarUrl: prof.avatar_url,
    avatarCharacterId: prof.avatar_character_id,
    avatarOutfitTheme: prof.avatar_outfit_theme,
    levelId,
    avatarSelectedOutfitId: prof.avatar_selected_outfit_id,
  };
  const resolved = resolveDisplayAvatarUrl(opts) ?? prof.avatar_url ?? null;
  const avatarLayers = resolveDisplayAvatarLayers(opts);

  const isSupabaseStorageAvatar =
    resolved &&
    typeof resolved === "string" &&
    resolved.includes("supabase.co") &&
    resolved.includes("/storage/v1/object/public/avatars/");
  const avatarUrl = isSupabaseStorageAvatar
    ? `/api/arena/avatar?userId=${userId}`
    : resolved ?? "/avatars/default-avatar.svg";

  return { avatarUrl, avatarLayers };
}

export function buildLeaderboardRows(
  rows: WeeklyXpRow[],
  profileMap: Map<string, NormalizedProfile>,
): LeaderboardRow[] {
  return rows.map((r, idx) => {
    const xpTotal = Number(r.xp_total ?? 0);
    const prof = profileMap.get(r.user_id);
    const coreXp = prof?.core_xp_total ?? 0;
    const tier = tierFromCoreXp(coreXp);
    const codeIndex = (prof?.code_index ?? codeIndexFromTier(tier)) as CodeIndex;
    const subTierGroup = subTierGroupFromTier(tier);
    const customSubName = prof?.sub_name ?? null;
    const codeName = CODE_NAMES[codeIndex];
    const subName = resolveSubName(codeIndex, subTierGroup, customSubName);
    const levelId = tierToDisplayLevelId(tier);

    const { avatarUrl, avatarLayers } = resolveAvatarUrl(r.user_id, prof, levelId);

    const avatarKeys = profileToAvatarCompositeKeys({
      avatarCharacterId: prof?.avatar_character_id ?? null,
      avatarOutfitTheme: prof?.avatar_outfit_theme ?? "professional",
      avatarSelectedOutfitId: prof?.avatar_selected_outfit_id ?? null,
      avatarAccessoryIds: prof?.avatar_accessory_ids ?? [],
      displayLevelId: levelId,
    });

    return {
      userId: r.user_id,
      coreXpTotal: coreXp,
      rank: idx + 1,
      codeName,
      subName,
      xpTotal,
      avatarUrl,
      avatarLayers,
      avatar: avatarKeys,
      tier: calculateTier(xpTotal),
    };
  });
}

// ---------------------------------------------------------------------------
// resolveMyRank
// ---------------------------------------------------------------------------

export async function resolveMyRank(
  db: SupabaseClient,
  userId: string,
  leaderboard: LeaderboardRow[],
  rows: WeeklyXpRow[],
  filterUserIds: string[] | null,
): Promise<MyRankInfo> {
  let myRank = rows.findIndex((r) => r.user_id === userId) + 1 || 0;
  let myXp: number = Number(rows.find((r) => r.user_id === userId)?.xp_total ?? 0);
  let gapToAbove: number | null = null;

  if (myRank > 1) {
    const personAbove = leaderboard[myRank - 2];
    if (personAbove && typeof personAbove.xpTotal === "number") {
      gapToAbove = Math.max(0, personAbove.xpTotal - myXp);
    }
  }

  if (myRank === 0) {
    const rankQuery = db
      .from("weekly_xp")
      .select("xp_total")
      .eq("user_id", userId)
      .is("league_id", null);
    const { data: myRow } = await rankQuery.maybeSingle();
    if (myRow && typeof (myRow as { xp_total?: number }).xp_total === "number") {
      myXp = (myRow as { xp_total: number }).xp_total;

      let countQuery = db
        .from("weekly_xp")
        .select("user_id", { count: "exact", head: true })
        .is("league_id", null)
        .gt("xp_total", myXp);
      if (filterUserIds != null && filterUserIds.length > 0) {
        countQuery = countQuery.in("user_id", filterUserIds);
      }
      const { count: rankAbove } = await countQuery;

      let totalCountQuery = db
        .from("weekly_xp")
        .select("user_id", { count: "exact", head: true })
        .is("league_id", null);
      if (filterUserIds != null && filterUserIds.length > 0) {
        totalCountQuery = totalCountQuery.in("user_id", filterUserIds);
      }
      const { count: totalCount } = await totalCountQuery;

      myRank = rankFromCountAbove(totalCount ?? 0, rankAbove ?? 0);

      if (myRank > 1) {
        let aboveQuery = db
          .from("weekly_xp")
          .select("xp_total")
          .is("league_id", null)
          .gt("xp_total", myXp)
          .order("xp_total", { ascending: true })
          .limit(1);
        if (filterUserIds != null && filterUserIds.length > 0) {
          aboveQuery = aboveQuery.in("user_id", filterUserIds);
        }
        const { data: aboveRow } = await aboveQuery.maybeSingle();
        if (
          aboveRow &&
          typeof (aboveRow as { xp_total?: number }).xp_total === "number"
        ) {
          gapToAbove = Math.max(
            0,
            (aboveRow as { xp_total: number }).xp_total - myXp,
          );
        }
      }
    }
  }

  return { myRank, myXp, gapToAbove };
}
