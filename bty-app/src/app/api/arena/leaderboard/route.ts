/**
 * GET /api/arena/leaderboard — **라이브 주간 랭킹** (Weekly XP + tie-break만; 시즌 필드 표시 전용).
 *
 * @contract
 * - **Query `scope`:** omit/empty → `overall`. Else **`overall`|`role`|`office`** only (trim). 잘못된 값 → **400** `{ error: "INVALID_SCOPE", message }`.
 * - **Query `week`:** omit, empty, or **`current`** → 라이브 주간. Else **`YYYY-MM-DD`** = **이번 주 월요일 UTC**만 허용; 그 외 형식·과거·미래 주 → **400** `{ error: "INVALID_WEEK", message }`.
 * - **200:** `leaderboard`·`count`·`nearMe`·`myRank` 등. 빈 주간 → `leaderboard: []`, `count: 0`.
 * - **200 (무세션·overall):** service role 가능 시 상위 랭크 공개; `viewerAnonymous: true`.
 * - **401:** `{ error: "UNAUTHENTICATED", message: "Sign in to see leaderboard" }` — `scope=role|office` 미로그인, 또는 overall 공개(service role) 폴백 불가 시.
 * - **250:** 401 응답 **키는 `error`·`message`만**(문자열).
 * - **500:** `{ error: "WEEKLY_XP_QUERY_FAILED", detail }`.
 * - **캐시:** `Cache-Control: no-store`.
 *
 * @see docs/spec/ARENA_DOMAIN_SPEC.md §4-4
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { writeSupabaseAuthCookies } from "@/lib/bty/cookies/authCookies";
import { mergeAuthCookiesFromResponse } from "@/lib/supabase/route-client";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getActiveLeague } from "@/lib/bty/arena/activeLeague";
import { parseLeaderboardQuery } from "@/lib/bty/arena/leaderboardScope";
import { getLeaderboardWeekBoundary } from "@/lib/bty/arena/leaderboardWeekBoundary";
import {
  getScopeFilter,
  fetchWeeklyXpRows,
  fetchProfileMap,
  buildLeaderboardRows,
  resolveMyRank,
} from "@/lib/bty/arena/leaderboardService";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const baseHeaders = new Headers();
  baseHeaders.set("Cache-Control", "no-store");

  const parsed = parseLeaderboardQuery(
    req.nextUrl.searchParams.get("scope"),
    req.nextUrl.searchParams.get("week"),
  );
  if (!parsed.ok) {
    return NextResponse.json(
      { error: parsed.error, message: parsed.message },
      { status: 400, headers: baseHeaders },
    );
  }
  const scope = parsed.scope;

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
  let user = userData.user;

  const admin = getSupabaseAdmin();

  if (!user && scope === "overall" && admin) {
    const { rows: weeklyRows, error: weeklyErr } = await fetchWeeklyXpRows(
      admin,
      null,
      500,
    );
    if (!weeklyErr) {
      const rows = (weeklyRows ?? []).filter((r) => !!r.user_id);
      const userIds = rows.map((r) => r.user_id);
      const profileMap =
        userIds.length > 0 ? await fetchProfileMap(admin, admin, userIds) : new Map();
      const leaderboard = buildLeaderboardRows(rows, profileMap);
      const top10 = leaderboard.slice(0, 10);
      const champions = leaderboard.slice(0, 3);
      const weekBoundary = getLeaderboardWeekBoundary();
      const league = await getActiveLeague(admin, admin);
      const out = NextResponse.json(
        {
          leaderboard,
          nearMe: top10.length ? top10 : leaderboard,
          top10,
          champions,
          myRank: null,
          myXp: 0,
          gapToAbove: null,
          count: leaderboard.length,
          scope,
          scopeLabel: null,
          scopeUnavailable: false,
          week_end: weekBoundary.week_end,
          reset_at: weekBoundary.reset_at,
          season: league
            ? {
                league_id: league.league_id,
                start_at: league.start_at,
                end_at: league.end_at,
                name: league.name ?? null,
              }
            : null,
          viewerAnonymous: true,
        },
        { status: 200 },
      );
      tmp.headers.forEach((v, k) => out.headers.set(k, v));
      mergeAuthCookiesFromResponse(tmp, out);
      return out;
    }
  }

  if (!user) {
    const out = NextResponse.json(
      { error: "UNAUTHENTICATED", message: "Sign in to see leaderboard" },
      { status: 401 },
    );
    tmp.headers.forEach((v, k) => out.headers.set(k, v));
    mergeAuthCookiesFromResponse(tmp, out);
    return out;
  }

  const db = admin ?? supabase;

  const scopeFilter =
    scope !== "overall" ? await getScopeFilter(admin, user.id, scope) : null;
  const filterUserIds = scopeFilter?.userIds ?? null;
  const scopeLabel = scopeFilter?.scopeLabel ?? null;

  // --- Fetch weekly XP rows ---
  const { rows: weeklyRows, error: weeklyErr } = await fetchWeeklyXpRows(
    db,
    filterUserIds,
  );

  if (weeklyErr) {
    const out = NextResponse.json(
      { error: "WEEKLY_XP_QUERY_FAILED", detail: weeklyErr },
      { status: 500 },
    );
    tmp.headers.forEach((v, k) => out.headers.set(k, v));
    return out;
  }

  const rows = (weeklyRows ?? []).filter((r) => !!r.user_id);
  const userIds = rows.map((r) => r.user_id);

  // --- Fetch profiles & build leaderboard ---
  const profileMap = await fetchProfileMap(admin, supabase, userIds);
  const leaderboard = buildLeaderboardRows(rows, profileMap);

  // --- My rank, gap ---
  const { myRank, myXp, gapToAbove } = await resolveMyRank(
    db,
    user.id,
    leaderboard,
    rows,
    filterUserIds,
  );

  // --- Slices ---
  const nearMe = leaderboard.slice(
    Math.max(0, myRank - 6),
    Math.min(leaderboard.length, myRank + 6),
  );
  const top10 = leaderboard.slice(0, 10);
  const champions = leaderboard.slice(0, 3);

  // --- League & week boundary ---
  const league = await getActiveLeague(supabase, getSupabaseAdmin());
  const weekBoundary = getLeaderboardWeekBoundary();

  // --- Response ---
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
      scope,
      scopeLabel: scope === "overall" ? null : scopeLabel,
      scopeUnavailable:
        scope !== "overall" && filterUserIds !== null && filterUserIds.length === 0,
      week_end: weekBoundary.week_end,
      reset_at: weekBoundary.reset_at,
      season: league
        ? {
            league_id: league.league_id,
            start_at: league.start_at,
            end_at: league.end_at,
            name: league.name ?? null,
          }
        : null,
    },
    { status: 200 },
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
