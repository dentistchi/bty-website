import { NextRequest } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export type MembershipRole = "staff" | "doctor" | "office_manager" | "regional_manager";
export type MembershipStatus = "active" | "invited" | "disabled";
export type SSOLevel = "staff" | "manager";

const ROLE_RANK: Record<MembershipRole, number> = {
  staff: 10,
  doctor: 20,
  office_manager: 30,
  regional_manager: 40,
};

export function hasRoleAtLeast(userRole: MembershipRole, required: MembershipRole) {
  return ROLE_RANK[userRole] >= ROLE_RANK[required];
}

export function canGrantRole(granter: MembershipRole, target: MembershipRole) {
  if (granter === "office_manager") return target === "staff" || target === "doctor";
  if (granter === "regional_manager") return target !== "regional_manager";
  return false;
}

export async function requireUser(req: NextRequest) {
  const supabase = await getSupabaseServer();

  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    return { ok: false as const, status: 401, error: "Unauthorized" };
  }

  return { ok: true as const, user: data.user };
}

const ADMIN_EMAILS_RAW = process.env.BTY_ADMIN_EMAILS ?? "";
const ADMIN_EMAIL_SET = new Set(
  ADMIN_EMAILS_RAW.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean)
);

/**
 * Admin-only by email allowlist (BTY_ADMIN_EMAILS).
 * If BTY_ADMIN_EMAILS is not set, any authenticated user is allowed (dev-friendly).
 */
export async function requireAdminEmail(req: NextRequest) {
  const u = await requireUser(req);
  if (!u.ok) return u;

  if (ADMIN_EMAIL_SET.size === 0) return u;
  const email = (u.user.email ?? "").toLowerCase();
  if (email && ADMIN_EMAIL_SET.has(email)) return u;
  return { ok: false as const, status: 403, error: "Forbidden: Admin access required" };
}

function parseScope(request: NextRequest) {
  const orgId = request.nextUrl.searchParams.get("orgId");
  const regionId = request.nextUrl.searchParams.get("regionId");
  return { orgId, regionId };
}

export async function requireRegionAccess(
  request: NextRequest,
  opts: { minRole: MembershipRole }
) {
  const u = await requireUser(request);
  if (!u.ok) return u;

  const { orgId, regionId } = parseScope(request);
  if (!orgId || !regionId) {
    return { ok: false as const, status: 400, error: "Missing orgId or regionId" };
  }

  const admin = getSupabaseAdmin();
  if (!admin) return { ok: false as const, status: 503, error: "Server not configured" };

  // 1) memberships 조회
  const { data: membership, error: memError } = await admin
    .from("memberships")
    .select("id, user_id, org_id, region_id, role, status, job_function")
    .eq("user_id", u.user.id)
    .eq("org_id", orgId)
    .eq("region_id", regionId)
    .eq("status", "active")
    .maybeSingle();

  // 2) SSO 체크: workforce_profiles.team='sso'면 sso_level로 권한 분기
  if (memError || !membership) {
    const { data: profile } = await admin
      .from("workforce_profiles")
      .select("team, sso_level")
      .eq("user_id", u.user.id)
      .maybeSingle();

    if (profile?.team === "sso") {
      const ssoLevel = (profile.sso_level ?? "staff") as SSOLevel;
      // SSO 'manager'는 office_manager 수준, 'staff'는 staff 수준으로 간주
      const effectiveRole: MembershipRole = ssoLevel === "manager" ? "office_manager" : "staff";
      if (!hasRoleAtLeast(effectiveRole, opts.minRole)) {
        return { ok: false as const, status: 403, error: "Forbidden" };
      }
      // SSO는 region override 훅 포인트 (현재는 orgId/regionId 그대로 사용)
      return {
        ok: true as const,
        user: u.user,
        membership: null,
        sso: { level: ssoLevel, effectiveRole },
        scope: { orgId, regionId },
      };
    }
    return { ok: false as const, status: 403, error: "Forbidden" };
  }

  const role = membership.role as MembershipRole;
  if (!hasRoleAtLeast(role, opts.minRole)) {
    return { ok: false as const, status: 403, error: "Forbidden" };
  }

  return {
    ok: true as const,
    user: u.user,
    membership: { ...membership, role },
    scope: { orgId, regionId },
  };
}

export async function requireAdmin(
  request: NextRequest,
  opts?: { minRole?: MembershipRole }
) {
  return requireRegionAccess(request, { minRole: opts?.minRole ?? "office_manager" });
}
