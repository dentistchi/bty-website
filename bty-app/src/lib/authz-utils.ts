import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { hasRoleAtLeast, type MembershipRole } from "@/lib/authz";

export type OfficeAssignment = {
  id: string;
  user_id: string;
  office_id: string;
  job_function: string;
  is_lead: boolean;
  status: string;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
};

/**
 * user_id가 org_id/region_id에 minRole 이상의 접근 권한이 있는지 확인.
 * 실패 시 Error throw (API route에서 try/catch로 403 반환).
 */
export async function assertRegionAccess(
  userId: string,
  orgId: string,
  regionId: string,
  minRole: MembershipRole
): Promise<void> {
  const admin = getSupabaseAdmin();
  if (!admin) throw new Error("Server not configured");

  const { data: membership, error } = await admin
    .from("memberships")
    .select("role, status")
    .eq("user_id", userId)
    .eq("org_id", orgId)
    .eq("region_id", regionId)
    .eq("status", "active")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!membership) {
    // SSO 체크
    const { data: profile } = await admin
      .from("workforce_profiles")
      .select("team, sso_level")
      .eq("user_id", userId)
      .maybeSingle();

    if (profile?.team === "sso") {
      const ssoLevel = profile.sso_level ?? "staff";
      const effectiveRole: MembershipRole = ssoLevel === "manager" ? "office_manager" : "staff";
      if (!hasRoleAtLeast(effectiveRole, minRole)) {
        throw new Error("Forbidden");
      }
      return;
    }
    throw new Error("Forbidden");
  }

  const role = membership.role as MembershipRole;
  if (!hasRoleAtLeast(role, minRole)) {
    throw new Error("Forbidden");
  }
}

/**
 * user_id가 접근 가능한 office 목록 반환 (office_assignments + region 기반).
 * office_manager는 is_lead=true인 office만, regional_manager는 region 전체 office.
 */
export async function listAccessibleOffices(
  userId: string,
  orgId: string,
  regionId: string
): Promise<OfficeAssignment[]> {
  const admin = getSupabaseAdmin();
  if (!admin) return [];

  // 1) membership role 확인
  const { data: membership } = await admin
    .from("memberships")
    .select("role")
    .eq("user_id", userId)
    .eq("org_id", orgId)
    .eq("region_id", regionId)
    .eq("status", "active")
    .maybeSingle();

  const role = (membership?.role ?? "staff") as MembershipRole;

  // 2) region의 office 목록 조회
  const { data: offices } = await admin
    .from("offices")
    .select("id")
    .eq("region_id", regionId);

  if (!offices || offices.length === 0) return [];

  const officeIds = offices.map((o) => o.id);

  // 3) office_assignments 조회 (role에 따라 필터)
  let query = admin
    .from("office_assignments")
    .select("id, user_id, office_id, job_function, is_lead, status, is_primary, created_at, updated_at")
    .eq("user_id", userId)
    .in("office_id", officeIds)
    .eq("status", "active");

  // office_manager는 is_lead=true인 office만, regional_manager는 전체
  if (role === "office_manager") {
    query = query.eq("is_lead", true);
  }
  // regional_manager, staff, doctor는 필터 없음 (region 내 모든 office)

  const { data, error } = await query;
  if (error) return [];

  return (data ?? []) as OfficeAssignment[];
}
