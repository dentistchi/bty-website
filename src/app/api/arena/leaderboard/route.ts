/**
 * GET /api/arena/leaderboard — **라이브 주간 랭킹** (Weekly XP + tie-break만; 시즌 필드 표시 전용).
 *
 * @contract
 * - **Query `scope`:** omit/empty → `overall`. Else **`overall`|`role`|`office`** only (trim). 잘못된 값 → **400** `{ error: "INVALID_SCOPE", message }`.
 * - **Query `week`:** omit, empty, or **`current`** → 라이브 주간. Else **`YYYY-MM-DD`** = **이번 주 월요일 UTC**만 허용; 그 외 형식·과거·미래 주 → **400** `{ error: "INVALID_WEEK", message }`.
 * - **200:** `leaderboard`·`count`·`nearMe`·`myRank` 등. 빈 주간 → `leaderboard: []`, `count: 0`.
 * - **401:** `{ error: "UNAUTHENTICATED", message: "Sign in to see leaderboard" }` — **모든 미로그인 요청**(scope 무관). 리더보드는 인증 표면이다 (Slice 3.2R-R9C; ARENA_DOMAIN_SPEC §4-4). 이전의 `viewerAnonymous` 무세션 공개 분기는 제거되었다.
 * - **250:** 401 응답 **키는 `error`·`message`만**(문자열).
 * - **500:** `{ error: "WEEKLY_XP_QUERY_FAILED", detail }`.
 * - **캐시:** `Cache-Control: no-store`.
 *
 * @see docs/spec/ARENA_DOMAIN_SPEC.md §4-4
 */
import { NextRequest, NextResponse } from "next/server";
import { consentRequiredResponse, isConsentCurrent } from "@/lib/legal/activeConsent";
import { createServerClient } from "@supabase/ssr";
import { authCookieSecureForRequest, writeSupabaseAuthCookies } from "@/lib/bty/cookies/authCookies";
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
  const cookieSecure = authCookieSecureForRequest(req);

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return req.cookies.getAll().map((c) => ({ name: c.name, value: c.value }));
      },
      setAll(cookies: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
        didSetAll = true;
        writeSupabaseAuthCookies(tmp, cookies, { secure: cookieSecure });
      },
    },
  });

  const { data: userData } = await supabase.auth.getUser();
  let user = userData.user;

  const admin = getSupabaseAdmin();

  /*
    NO ANONYMOUS ROSTER (Slice 3.2R-R9C).

    A branch here answered unauthenticated callers with the full leaderboard — every ranked
    learner's real display name, user UUID, XP and avatar — whenever a service role was
    configured. That condition is true in exactly one environment: production.

    It was never authorised. `docs/spec/ARENA_DOMAIN_SPEC.md` §4-4 documents this route's
    signed-out behaviour as `401 UNAUTHENTICATED`; no document anywhere mentions
    `viewerAnonymous` for the leaderboard; the `/[locale]/bty/leaderboard` page is
    middleware-protected and 307s to login when signed out, so no product surface could reach it;
    and the sibling anonymous convention on `/api/arena/runs` deliberately returns an EMPTY list.

    The existing suite asserted the 401 and passed, because it mocks the service role to null and
    the branch was skipped — the test could only ever describe the environment it was not run in.

    Signing in is the whole requirement, so the fall-through below is the entire rule.
  */
  if (!user) {
    const out = NextResponse.json(
      { error: "UNAUTHENTICATED", message: "Sign in to see leaderboard" },
      { status: 401 },
    );
    tmp.headers.forEach((v, k) => out.headers.set(k, v));
    mergeAuthCookiesFromResponse(tmp, out, req);
    return out;
  }
  if (!(await isConsentCurrent(supabase, user.id))) return consentRequiredResponse();

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
      secure: cookieSecure,
      httpOnly: true,
    });
  }
  return out;
}
