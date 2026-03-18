/**
 * BTY_ARENA_SYSTEM_SPEC §4: 리더보드 scope(overall|role|office) 및 스코프별 노출 수치.
 * 순수 함수·상수만. API는 이 도메인을 호출하고 weekly_xp·nearMe 규칙은 기존대로 유지.
 */

export const LEADERBOARD_SCOPE_TYPES = ["overall", "role", "office"] as const;
export type LeaderboardScope = (typeof LEADERBOARD_SCOPE_TYPES)[number];

/** Query param → scope. Invalid/missing → overall. */
export function parseLeaderboardScope(param: string | null): LeaderboardScope {
  if (param === "role" || param === "office") return param;
  return "overall";
}

/** Monday `YYYY-MM-DD` (UTC) for the week containing `d`. */
export function mondayUTCDateString(d: Date): string {
  const day = d.getUTCDay();
  const off = day === 0 ? -6 : 1 - day;
  const m = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + off));
  const y = m.getUTCFullYear();
  const mo = String(m.getUTCMonth() + 1).padStart(2, "0");
  const da = String(m.getUTCDate()).padStart(2, "0");
  return `${y}-${mo}-${da}`;
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
  const s = scopeParam == null ? "" : scopeParam.trim();
  let scope: LeaderboardScope;
  if (s === "") {
    scope = "overall";
  } else if (s === "overall" || s === "role" || s === "office") {
    scope = s;
  } else {
    return {
      ok: false,
      error: "INVALID_SCOPE",
      message: "scope must be overall, role, or office",
    };
  }

  const w = weekParam == null ? "" : weekParam.trim();
  if (w === "" || w === "current") {
    return { ok: true, scope };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(w)) {
    return {
      ok: false,
      error: "INVALID_WEEK",
      message: "week must be current or YYYY-MM-DD (Monday UTC)",
    };
  }
  const d = new Date(`${w}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime()) || d.getUTCDay() !== 1) {
    return {
      ok: false,
      error: "INVALID_WEEK",
      message: "week must be a Monday UTC",
    };
  }
  const thisMonday = mondayUTCDateString(now);
  if (w !== thisMonday) {
    return {
      ok: false,
      error: "INVALID_WEEK",
      message: "only the current leaderboard week is supported",
    };
  }
  return { ok: true, scope };
}

/** scope=role 시 역할 코드 → UI 표시 라벨. API에서 scopeLabel 반환 시 사용. */
export function roleToScopeLabel(role: string): string {
  const r = (role ?? "").trim().toLowerCase();
  if (r === "doctor") return "Doctor";
  if (r === "office_manager" || r === "regional_manager") return "Manager";
  if (r === "staff") return "Staff";
  if (r === "dso") return "DSO";
  return role || "Role";
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
