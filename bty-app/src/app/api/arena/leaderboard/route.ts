import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { writeSupabaseAuthCookies } from "@/lib/bty/cookies/authCookies";
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
  const cookieHeader = req.headers.get("cookie") ?? "";
  const hasCookieHeader = cookieHeader.length > 0;
  const cookieNames = req.cookies.getAll().map((c) => c.name);

  const baseHeaders = new Headers();
  baseHeaders.set("Cache-Control", "no-store");
  baseHeaders.set("x-auth-debug-cookie-header", hasCookieHeader ? "1" : "0");
  baseHeaders.set("x-auth-debug-cookie-len", String(cookieHeader.length));
  baseHeaders.set("x-auth-debug-cookie-count", String(cookieNames.length));
  baseHeaders.set("x-auth-debug-cookie-names", cookieNames.slice(0, 10).join(","));

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

  tmp.headers.set("x-auth-debug-setall", didSetAll ? "1" : "0");
  tmp.headers.set("x-auth-debug-user", user ? "1" : "0");

  if (!user) {
    const body = {
      error: "UNAUTHENTICATED",
      debug: {
        cookieHeader: hasCookieHeader,
        cookieLen: cookieHeader.length,
        cookieCount: cookieNames.length,
        cookieNames: cookieNames.slice(0, 20),
        setAllCalled: didSetAll,
      },
    };
    const out = NextResponse.json(body, { status: 401 });
    tmp.headers.forEach((v, k) => out.headers.set(k, v));
    return out;
  }

  const { data: weeklyRows, error: weeklyErr } = await supabase
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
    { core_xp_total: number; code_index: number; sub_name: string | null }
  >();
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from("arena_profiles")
      .select("user_id, core_xp_total, code_index, sub_name")
      .in("user_id", userIds);

    (profiles ?? []).forEach(
      (p: { user_id: string; core_xp_total?: number; code_index?: number; sub_name?: string | null }) => {
        profileMap.set(p.user_id, {
          core_xp_total: Number(p.core_xp_total ?? 0),
          code_index: Math.min(6, Math.max(0, Number(p.code_index ?? 0))),
          sub_name: p.sub_name ?? null,
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
    return { rank: idx + 1, codeName, subName, xpTotal };
  });

  const myRank =
    rows.findIndex((r) => r.user_id === user.id) + 1 || 0;
  const nearMe = leaderboard.slice(Math.max(0, myRank - 6), Math.min(leaderboard.length, myRank + 5));
  const top10 = leaderboard.slice(0, 10);

  const myXp = rows.find((r) => r.user_id === user.id)?.xp_total ?? 0;
  const out = NextResponse.json(
    { leaderboard, nearMe, top10, myRank: myRank || null, myXp, count: leaderboard.length },
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
