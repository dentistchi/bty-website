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

  let profileMap = new Map<
    string,
    { core_xp_total: number; code_index: number; sub_name: string | null; avatar_url: string | null }
  >();
  if (userIds.length > 0) {
    const { data: profiles } = await db
      .from("arena_profiles")
      .select("user_id, core_xp_total, code_index, sub_name, avatar_url")
      .in("user_id", userIds);

    (profiles ?? []).forEach(
      (p: {
        user_id: string;
        core_xp_total?: number;
        code_index?: number;
        sub_name?: string | null;
        avatar_url?: string | null;
      }) => {
        profileMap.set(p.user_id, {
          core_xp_total: Number(p.core_xp_total ?? 0),
          code_index: Math.min(6, Math.max(0, Number(p.code_index ?? 0))),
          sub_name: p.sub_name ?? null,
          avatar_url: p.avatar_url ?? null,
        });
      }
    );
  }

  const leaderboard = rows.map((r, idx) => {
    const xpTotal = Number(r.xp_total ?? 0);
    const prof = profileMap.get(r.user_id);
    const coreXp = prof?.core_xp_total ?? 0;
    const tier = tierFromCoreXp(coreXp);
    const codeIndex = (prof?.code_index ?? codeIndexFromTier(tier)) as CodeIndex;
    const subTierGroup = subTierGroupFromTier(tier);
    const customSubName = prof?.sub_name ?? null;
    const codeName = CODE_NAMES[codeIndex];
    const subName = resolveSubName(codeIndex, subTierGroup, customSubName);
    const avatarUrl = prof?.avatar_url ?? null;
    return { rank: idx + 1, codeName, subName, xpTotal, avatarUrl };
  });

  const myRank =
    rows.findIndex((r) => r.user_id === user.id) + 1 || 0;
  const nearMe = leaderboard.slice(Math.max(0, myRank - 6), Math.min(leaderboard.length, myRank + 5));
  const top10 = leaderboard.slice(0, 10);

  const myXp = rows.find((r) => r.user_id === user.id)?.xp_total ?? 0;
  const out = NextResponse.json(
    {
      leaderboard,
      nearMe,
      top10,
      myRank: myRank || null,
      myXp,
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
