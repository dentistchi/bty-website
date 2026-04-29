/**
 * Role code → display label for leaderboard `scope=role` (`scopeLabel` in API).
 * Trims/lowercases only for known codes; unknown non-empty values keep original `role` string.
 */

export function arenaLeaderboardScopeRoleLabel(role: string | null | undefined): string {
  const raw = role == null ? "" : String(role);
  const r = raw.trim().toLowerCase();
  if (r === "doctor") return "Doctor";
  if (r === "office_manager" || r === "regional_manager") return "Manager";
  if (r === "staff") return "Staff";
  if (r === "dso") return "DSO";
  return raw || "Role";
}
