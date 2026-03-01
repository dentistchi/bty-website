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
import { tierToDisplayLevelId, resolveDisplayAvatarUrl } from "@/lib/bty/arena/avatarOutfits";
import { calculateTier } from "@/lib/bty/arena/domain";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const dynamic = "force-dynamic";

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

  const league = await getActiveLeague(supabase, getSupabaseAdmin());
  // MVP: ranking always from global pool (league_id IS NULL). run/complete and activity XP only write to league_id null.
  // League is used for display (season name, dates) only.
  const admin = getSupabaseAdmin();
  const db = admin ?? supabase;
  const { data: weeklyRows, error: weeklyErr } = await db
    .from("weekly_xp")
    .select("user_id, xp_total")
    .is("league_id", null)
    .order("xp_total", { ascending: false })
    .limit(100);

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
    }
  >();
  if (userIds.length > 0) {
    // 반드시 admin으로 조회: RLS 시 anon이면 본인 프로필만 반환되어 다른 유저 행에 같은 아바타가 노출되는 버그 방지.
    const profileClient = admin ?? supabase;
    const { data: profiles } = await profileClient
      .from("arena_profiles")
      .select("user_id, core_xp_total, code_index, sub_name, avatar_url, avatar_character_id, avatar_outfit_theme")
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
      });
    });
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
    if (prof) {
      resolved =
        resolveDisplayAvatarUrl({
          customAvatarUrl: prof.avatar_url ?? null,
          avatarCharacterId: prof.avatar_character_id ?? null,
          avatarOutfitTheme: prof.avatar_outfit_theme ?? null,
          levelId,
        }) ?? prof.avatar_url ?? null;
    }
    // Use proxy URL for our Storage avatars so leaderboard works cross-origin (no CORS on Storage).
    // Match any Supabase storage avatar URL (env may have trailing slash; stored URL format can vary).
    const isSupabaseStorageAvatar =
      resolved &&
      typeof resolved === "string" &&
      resolved.includes("supabase.co") &&
      resolved.includes("/storage/v1/object/public/avatars/");
    // Relative paths: use default only for /avatars/outfits/... (often missing). Keep /avatars/*.png (character images).
    const isOutfitPath =
      resolved && typeof resolved === "string" && resolved.startsWith("/avatars/outfits/");
    const useDefaultForRelative =
      resolved && typeof resolved === "string" && resolved.startsWith("/") && isOutfitPath;
    const avatarUrl = isSupabaseStorageAvatar
      ? `/api/arena/avatar?userId=${r.user_id}`
      : useDefaultForRelative
        ? "/avatars/default-avatar.svg"
        : resolved ?? "/avatars/default-avatar.svg";
    return { rank: idx + 1, codeName, subName, xpTotal, avatarUrl, tier: calculateTier(xpTotal) };
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

  // If not in top 100, fetch own weekly_xp and compute rank so UI can show "내 순위: #105" instead of "아직 리더보드에 없어요"
  if (myRank === 0) {
    const { data: myRow } = await db
      .from("weekly_xp")
      .select("xp_total")
      .eq("user_id", user.id)
      .is("league_id", null)
      .maybeSingle();
    if (myRow && typeof (myRow as { xp_total?: number }).xp_total === "number") {
      myXp = (myRow as { xp_total: number }).xp_total;
      const { count: rankAbove } = await db
        .from("weekly_xp")
        .select("user_id", { count: "exact", head: true })
        .is("league_id", null)
        .gt("xp_total", myXp);
      myRank = (rankAbove ?? 0) + 1;
      // gapToAbove for users outside top 100: one row with next higher xp_total
      if (myRank > 1) {
        const { data: aboveRow } = await db
          .from("weekly_xp")
          .select("xp_total")
          .is("league_id", null)
          .gt("xp_total", myXp)
          .order("xp_total", { ascending: true })
          .limit(1)
          .maybeSingle();
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
      /** XP gap to the person ranked directly above me (null if rank 1 or not in top 100). For motivation. */
      gapToAbove,
      count: leaderboard.length,
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
