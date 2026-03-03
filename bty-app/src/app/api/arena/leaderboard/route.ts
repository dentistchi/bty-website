/**
 * GET /api/arena/leaderboard
 * BTY_ARENA_SYSTEM_SPEC §4: scope=overall|role|office.
 * - overall: 전역 weekly_xp(league_id null) 기준.
 * - role: 동일 (org_id, region_id, role) 사용자만. scopeLabel 예: "Doctor", "Manager".
 * - office: 동일 office_id(내 대표 지점) 사용자만. scopeLabel = 지점명.
 * 스코프별 노출 수치: 동일. 행당 순위, Seasonal XP(weekly), Code·Sub Name, 아바타만. 지점·역할은 행별 미노출.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { writeSupabaseAuthCookies } from "@/lib/bty/cookies/authCookies";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getActiveLeague } from "@/lib/bty/arena/activeLeague";
import {
  CODE_NAMES,
  tierFromCoreXp,
  codeIndexFromTier,
  subTierGroupFromTier,
  resolveSubName,
  type CodeIndex,
} from "@/lib/bty/arena/codes";
import { tierToDisplayLevelId, resolveDisplayAvatarUrl, resolveDisplayAvatarLayers } from "@/lib/bty/arena/avatarOutfits";
import { calculateTier } from "@/lib/bty/arena/domain";
import type { SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const dynamic = "force-dynamic";

/** scope=role: same org_id, region_id, role. scope=office: same office_id (user's primary). Returns null for overall or when unavailable. */
async function getScopeFilter(
  admin: SupabaseClient | null,
  userId: string,
  scope: "overall" | "role" | "office"
): Promise<{ userIds: string[]; scopeLabel: string | null } | null> {
  if (scope === "overall" || !admin) return null;

  if (scope === "role") {
    const { data: myRows } = await admin
      .from("memberships")
      .select("org_id, region_id, role")
      .eq("user_id", userId)
      .eq("status", "active")
      .limit(1);
    const first = myRows?.[0] as { org_id?: string; region_id?: string; role?: string } | undefined;
    if (!first?.org_id || !first?.region_id || !first?.role)
      return { userIds: [], scopeLabel: null };
    const { data: peerRows } = await admin
      .from("memberships")
      .select("user_id")
      .eq("org_id", first.org_id)
      .eq("region_id", first.region_id)
      .eq("role", first.role)
      .eq("status", "active");
    const userIds = (peerRows ?? []).map((r: { user_id: string }) => r.user_id).filter(Boolean);
    const roleLabel =
      first.role === "doctor"
        ? "Doctor"
        : first.role === "office_manager" || first.role === "regional_manager"
          ? "Manager"
          : first.role === "staff"
            ? "Staff"
            : first.role === "dso"
              ? "DSO"
              : first.role;
    return { userIds, scopeLabel: roleLabel };
  }

  // scope === "office"
  const { data: myAssignments } = await admin
    .from("office_assignments")
    .select("office_id")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("is_primary", { ascending: false })
    .limit(1);
  const officeId = (myAssignments?.[0] as { office_id?: string } | undefined)?.office_id;
  if (!officeId) return { userIds: [], scopeLabel: null };
  const { data: officeRow } = await admin.from("offices").select("name").eq("id", officeId).maybeSingle();
  const scopeLabel = (officeRow as { name?: string } | null)?.name ?? null;
  const { data: officeUsers } = await admin
    .from("office_assignments")
    .select("user_id")
    .eq("office_id", officeId)
    .eq("status", "active");
  const userIds = [...new Set((officeUsers ?? []).map((r: { user_id: string }) => r.user_id).filter(Boolean))];
  return { userIds, scopeLabel };
}

export async function GET(req: NextRequest) {
  const baseHeaders = new Headers();
  baseHeaders.set("Cache-Control", "no-store");

  let didSetAll = false;
  const tmp = NextResponse.json({ ok: true }, { status: 200, headers: baseHeaders });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return req.cookies.getAll().map((c) => ({ name: c.name, value: c.value }));
      },
      setAll(cookies: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
        didSetAll = true;
        writeSupabaseAuthCookies(tmp, cookies);
      },
    },
  });

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (!user) {
    const body = {
      error: "UNAUTHENTICATED",
    };
    const out = NextResponse.json(body, { status: 401 });
    tmp.headers.forEach((v, k) => out.headers.set(k, v));
    return out;
  }

  const scopeParam = req.nextUrl.searchParams.get("scope");
  const scope: "overall" | "role" | "office" =
    scopeParam === "role" || scopeParam === "office" ? scopeParam : "overall";

  const league = await getActiveLeague(supabase, getSupabaseAdmin());
  const admin = getSupabaseAdmin();
  const db = admin ?? supabase;

  const scopeFilter =
    scope !== "overall"
      ? await getScopeFilter(admin, user.id, scope)
      : null;
  const filterUserIds = scopeFilter?.userIds ?? null;
  const scopeLabel = scopeFilter?.scopeLabel ?? null;

  let weeklyRows: { user_id: string; xp_total?: number }[] | null = null;
  let weeklyErr: { message: string } | null = null;

  if (filterUserIds !== null && filterUserIds.length === 0) {
    weeklyRows = [];
    weeklyErr = null;
  } else {
    let weeklyQuery = db
      .from("weekly_xp")
      .select("user_id, xp_total")
      .is("league_id", null)
      .order("xp_total", { ascending: false })
      .limit(100);
    if (filterUserIds != null && filterUserIds.length > 0) {
      weeklyQuery = weeklyQuery.in("user_id", filterUserIds);
    }
    const { data, error } = await weeklyQuery;
    weeklyRows = data;
    weeklyErr = error;
  }

  if (weeklyErr) {
    const out = NextResponse.json(
      { error: "WEEKLY_XP_QUERY_FAILED", detail: weeklyErr.message },
      { status: 500 }
    );
    tmp.headers.forEach((v, k) => out.headers.set(k, v));
    return out;
  }

  const rows = (weeklyRows ?? []).filter((r) => !!r.user_id) as { user_id: string; xp_total?: number }[];
  const userIds = rows.map((r) => r.user_id);

  type ProfileRow = {
    user_id: string;
    core_xp_total?: number;
    code_index?: number;
    sub_name?: string | null;
    avatar_url?: string | null;
    avatar_character_id?: string | null;
    avatar_outfit_theme?: "professional" | "fantasy" | null;
    avatar_selected_outfit_id?: string | null;
  };
  let profileMap = new Map<
    string,
    {
      core_xp_total: number;
      code_index: number;
      sub_name: string | null;
      avatar_url: string | null;
      avatar_character_id: string | null;
      avatar_outfit_theme: "professional" | "fantasy" | null;
      avatar_selected_outfit_id: string | null;
    }
  >();
  if (userIds.length > 0) {
    if (admin) {
      const { data: profiles } = await admin
        .from("arena_profiles")
        .select("user_id, core_xp_total, code_index, sub_name, avatar_url, avatar_character_id, avatar_outfit_theme, avatar_selected_outfit_id")
        .in("user_id", userIds);
      (profiles ?? []).forEach((p: ProfileRow) => {
        const theme = p.avatar_outfit_theme === "fantasy" || p.avatar_outfit_theme === "professional" ? p.avatar_outfit_theme : null;
        profileMap.set(p.user_id, {
          core_xp_total: Number(p.core_xp_total ?? 0),
          code_index: Math.min(6, Math.max(0, Number(p.code_index ?? 0))),
          sub_name: p.sub_name ?? null,
          avatar_url: p.avatar_url ?? null,
          avatar_character_id: p.avatar_character_id ?? null,
          avatar_outfit_theme: theme,
          avatar_selected_outfit_id: p.avatar_selected_outfit_id ?? null,
        });
      });
    } else {
      // RLS 시 anon은 본인만 조회됨 → get_leaderboard_profiles (SECURITY DEFINER) RPC로 전체 조회
      const { data: profiles } = await supabase.rpc("get_leaderboard_profiles", {
        p_user_ids: userIds,
      });
      (profiles ?? []).forEach((p: ProfileRow) => {
        const theme = p.avatar_outfit_theme === "fantasy" || p.avatar_outfit_theme === "professional" ? p.avatar_outfit_theme : null;
        profileMap.set(p.user_id, {
          core_xp_total: Number(p.core_xp_total ?? 0),
          code_index: Math.min(6, Math.max(0, Number(p.code_index ?? 0))),
          sub_name: p.sub_name ?? null,
          avatar_url: p.avatar_url ?? null,
          avatar_character_id: p.avatar_character_id ?? null,
          avatar_outfit_theme: theme,
          avatar_selected_outfit_id: p.avatar_selected_outfit_id ?? null,
        });
      });
    }
  }

  const leaderboard = rows.map((r, idx) => {
    // 각 행은 반드시 해당 r.user_id의 프로필만 사용. 타 유저 아바타가 섞이지 않도록 profileMap.get(r.user_id)만 사용.
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
    // 프로필이 없으면(admin 없을 때 RLS로 타 유저 미조회) 반드시 기본 아바타만 사용. 타 유저 아바타가 노출되지 않도록.
    let resolved: string | null = null;
    let avatarLayers: { characterImageUrl: string | null; outfitImageUrl: string | null } | undefined;
    if (prof) {
      const opts = {
        customAvatarUrl: prof.avatar_url ?? null,
        avatarCharacterId: prof.avatar_character_id ?? null,
        avatarOutfitTheme: prof.avatar_outfit_theme ?? null,
        levelId,
        avatarSelectedOutfitId: prof.avatar_selected_outfit_id ?? null,
      };
      resolved = resolveDisplayAvatarUrl(opts) ?? prof.avatar_url ?? null;
      avatarLayers = resolveDisplayAvatarLayers(opts);
    }
    // Use proxy URL for Storage avatars only; character/outfit paths use resolved URL so Mage etc. show on leaderboard.
    const isSupabaseStorageAvatar =
      resolved &&
      typeof resolved === "string" &&
      resolved.includes("supabase.co") &&
      resolved.includes("/storage/v1/object/public/avatars/");
    const avatarUrl = isSupabaseStorageAvatar
      ? `/api/arena/avatar?userId=${r.user_id}`
      : resolved ?? "/avatars/default-avatar.svg";
    return { rank: idx + 1, codeName, subName, xpTotal, avatarUrl, avatarLayers, tier: calculateTier(xpTotal) };
  });

  let myRank = rows.findIndex((r) => r.user_id === user.id) + 1 || 0;
  let myXp = rows.find((r) => r.user_id === user.id)?.xp_total ?? 0;

  // gapToAbove: XP difference to the person ranked directly above me (for motivation)
  let gapToAbove: number | null = null;
  if (myRank > 1) {
    const personAbove = leaderboard[myRank - 2]; // 0-indexed: rank 2 → index 0
    if (personAbove && typeof personAbove.xpTotal === "number") {
      gapToAbove = Math.max(0, personAbove.xpTotal - myXp);
    }
  }

  // If not in top 100 (or not in scoped list), fetch own weekly_xp and compute rank within same scope
  if (myRank === 0) {
    let rankQuery = db
      .from("weekly_xp")
      .select("xp_total")
      .eq("user_id", user.id)
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
      myRank = (rankAbove ?? 0) + 1;
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
        if (aboveRow && typeof (aboveRow as { xp_total?: number }).xp_total === "number") {
          gapToAbove = Math.max(0, (aboveRow as { xp_total: number }).xp_total - myXp);
        }
      }
    }
  }

  // 내 위 5명 + 나 + 내 아래 5명 (총 최대 11명)
  const nearMe = leaderboard.slice(Math.max(0, myRank - 6), Math.min(leaderboard.length, myRank + 6));
  const top10 = leaderboard.slice(0, 10);
  // 챔피언십: 주간 상위 1~3명 (1위 Champion, 2~3위 Runner-up) — PHASE_4_ELITE_5_PERCENT_SPEC §4-4, NEXT_TASKS_2 §1-4
  const champions = leaderboard.slice(0, 3);

  const out = NextResponse.json(
    {
      leaderboard,
      nearMe,
      top10,
      champions,
      myRank: myRank > 0 ? myRank : null,
      myXp,
      gapToAbove,
      count: leaderboard.length,
      /** overall | role | office. When role/office, pool is restricted to same role or same office. */
      scope,
      /** Display label for scope (e.g. "Doctor", "Seoul Branch"). Null for overall or when unavailable. */
      scopeLabel: scope === "overall" ? null : scopeLabel,
      /** True when scope=role|office was requested but no membership/office context (empty pool). */
      scopeUnavailable:
        scope !== "overall" && filterUserIds !== null && filterUserIds.length === 0,
      season: league
        ? { league_id: league.league_id, start_at: league.start_at, end_at: league.end_at, name: league.name ?? null }
        : null,
    },
    { status: 200 }
  );
  tmp.headers.forEach((v, k) => out.headers.set(k, v));
  for (const c of tmp.cookies.getAll()) {
    out.cookies.set(c.name, c.value, {
      path: "/",
      sameSite: "lax",
      secure: true,
      httpOnly: true,
    });
  }
  return out;
}
