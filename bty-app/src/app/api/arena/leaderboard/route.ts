/**
 * GET /api/arena/leaderboard
 * BTY_ARENA_SYSTEM_SPEC §4: scope=overall|role|office.
 *
 * --- API 계약 (Leaderboard status endpoint) ---
 * 요청:
 *   - Method: GET
 *   - Path: /api/arena/leaderboard
 *   - Query: scope? = "overall" | "role" | "office" (invalid/missing → overall, parseLeaderboardScope)
 *   - Auth: 세션 쿠키 필수 (Supabase getUser)
 * 응답:
 *   - 200: { leaderboard, nearMe, top10, champions, myRank, myXp, gapToAbove, count, scope, scopeLabel, scopeUnavailable, week_end, reset_at, season }
 *   - 401: { error: "UNAUTHENTICATED", message: "Sign in to see leaderboard" }
 *   - 500: { error: "WEEKLY_XP_QUERY_FAILED", detail: string }
 * Cache: no-store (ranking is user-specific; no public cache).
 * Invariant: rank order uses weekly XP (+ tie-break) only; season fields in JSON are display-only.
 * Thin handler: auth → service calls → response.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { writeSupabaseAuthCookies } from "@/lib/bty/cookies/authCookies";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getActiveLeague } from "@/lib/bty/arena/activeLeague";
import { parseLeaderboardScope } from "@/lib/bty/arena/leaderboardScope";
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
    const out = NextResponse.json(
      { error: "UNAUTHENTICATED", message: "Sign in to see leaderboard" },
      { status: 401 },
    );
    tmp.headers.forEach((v, k) => out.headers.set(k, v));
    return out;
  }

  // --- Parse scope & resolve filter ---
  const scope = parseLeaderboardScope(req.nextUrl.searchParams.get("scope"));
  const admin = getSupabaseAdmin();
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
