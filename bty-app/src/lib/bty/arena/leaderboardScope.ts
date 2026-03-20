/**
 * BTY_ARENA_SYSTEM_SPEC §4: 리더보드 scope(overall|role|office) 및 스코프별 노출 수치.
 * 순수 함수·상수만. API는 이 도메인을 호출하고 weekly_xp·nearMe 규칙은 기존대로 유지.
 */
import { arenaLeaderboardMondayUtcFromDate } from "@/domain/rules/arenaLeaderboardMondayUtcFromDate";
import { arenaLeaderboardScopeFromParam } from "@/domain/rules/arenaLeaderboardScopeFromParam";
import { arenaLeaderboardScopeRoleLabel } from "@/domain/rules/arenaLeaderboardScopeRoleLabel";
import { arenaLeaderboardWeekParamValid } from "@/domain/rules/arenaLeaderboardWeekParamValid";

export const LEADERBOARD_SCOPE_TYPES = ["overall", "role", "office"] as const;
export type LeaderboardScope = (typeof LEADERBOARD_SCOPE_TYPES)[number];

/** Query param → scope. Invalid/missing → overall. */
export function parseLeaderboardScope(param: string | null): LeaderboardScope {
  const scope = arenaLeaderboardScopeFromParam(param);
  return scope ?? "overall";
}

/** Monday `YYYY-MM-DD` (UTC) for the week containing `d` (domain: `arenaLeaderboardMondayUtcFromDate`). */
export function mondayUTCDateString(d: Date): string {
  return arenaLeaderboardMondayUtcFromDate(d);
}

/**
 * Strict leaderboard query: invalid `scope`/`week` → API returns 400.
 * - **scope:** omit/empty → overall; else must be `overall`|`role`|`office` (trimmed).
 * - **week:** omit, empty, or `current` → live week; else `YYYY-MM-DD` must be **this week’s Monday UTC** (historical weeks not supported yet).
 */
export type LeaderboardQueryResult =
  | { ok: true; scope: LeaderboardScope }
  | { ok: false; error: "INVALID_SCOPE" | "INVALID_WEEK"; message: string };

export function parseLeaderboardQuery(
  scopeParam: string | null,
  weekParam: string | null,
  now: Date = new Date(),
): LeaderboardQueryResult {
  const scope = arenaLeaderboardScopeFromParam(scopeParam);
  if (scope === null) {
    return {
      ok: false,
      error: "INVALID_SCOPE",
      message: "scope must be overall, role, or office",
    };
  }

  const weekResult = arenaLeaderboardWeekParamValid(
    weekParam,
    mondayUTCDateString(now),
  );
  if (!weekResult.ok) {
    return {
      ok: false,
      error: weekResult.error,
      message: weekResult.message,
    };
  }
  return { ok: true, scope };
}

/** scope=role 시 역할 코드 → UI 표시 라벨 (domain: `arenaLeaderboardScopeRoleLabel`). */
export function roleToScopeLabel(role: string): string {
  return arenaLeaderboardScopeRoleLabel(role);
}

/** 스코프별 노출 수치: 모든 스코프에서 동일. 행당 공개 필드만. 지점·역할은 행별 미노출. */
export const LEADERBOARD_EXPOSED_FIELDS = [
  "rank",
  "seasonalXp",
  "coreXp",
  "codeName",
  "subName",
  "avatar",
] as const;

export type LeaderboardExposedField = (typeof LEADERBOARD_EXPOSED_FIELDS)[number];
