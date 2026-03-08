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
