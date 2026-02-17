/**
 * 권한 모델 B: 조직 + region 스코프, role → permissions.
 */

export type MembershipRole =
  | "staff"
  | "doctor"
  | "office_manager"
  | "regional_manager";

export type Permission =
  | "manage_members"
  | "manage_users"
  | "view_kpi"
  | "compliance_review";

const ROLE_PERMS: Record<MembershipRole, Set<Permission>> = {
  staff: new Set([]),
  doctor: new Set(["view_kpi"]),
  office_manager: new Set(["view_kpi", "manage_members"]),
  regional_manager: new Set([
    "view_kpi",
    "manage_members",
    "manage_users",
    "compliance_review",
  ]),
};

export function can(
  role: MembershipRole | string | null | undefined,
  permission: Permission
): boolean {
  if (role == null || typeof role !== "string") return false;
  return ROLE_PERMS[role as MembershipRole]?.has(permission) ?? false;
}

export type MembershipRow = {
  id: string;
  user_id: string;
  organization_id: string;
  region_id: string;
  role: string;
  created_at?: string;
};
