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

/**
 * ★ ADMIN AUTHORITY IS A ROW, NOT AN ENVIRONMENT STRING (2026-09-02).
 *
 * This was `BTY_ADMIN_EMAILS`: a comma-separated env var compared against `user.email` on every
 * request, guarding ~30 API routes. It is gone from authorization entirely, for three measured
 * reasons.
 *
 *   1. IT FAILED OPEN. The old branch read "if the allowlist is empty, allow any authenticated
 *      user" — dev-friendly, and the single worst default available to the thing guarding the
 *      admin surface. One unset variable in one environment was full admin for everyone with a
 *      login.
 *   2. EMAIL IS NOT IDENTITY. Every other authority in this schema keys on the canonical
 *      `auth.users` id, and the Microsoft-first resolver exists precisely because email does not
 *      identify a person. Measured while replacing this: the allowlisted address resolved to a
 *      canonical user that was NOT the account actually operating BTY.
 *   3. IT COULD NOT BE AUDITED. No granter, no grant time, no revocation — nowhere in the system
 *      could answer "who made this person an admin, and when".
 *
 * Authority now comes from `bty_platform_admin_grants` via the canonical resolver, which fails
 * closed. There is deliberately NO email fallback: a transitional one would be the permanent one.
 */
export { isActivePlatformAdmin } from "@/lib/bty/authority/platformAdmin.server";

/**
 * Admin-only, by canonical platform-admin grant.
 *
 * Fails closed on every uncertainty: no session, no admin client, no grant, or a lookup that
 * errors — all 403 (401 for no session). Nothing about the request body, headers or email is
 * consulted.
 */
export async function requirePlatformAdmin(req: NextRequest) {
  const u = await requireUser(req);
  if (!u.ok) return u;

  const admin = getSupabaseAdmin();
  if (!admin) return { ok: false as const, status: 503, error: "Server not configured" };

  const { isActivePlatformAdmin } = await import("@/lib/bty/authority/platformAdmin.server");
  if (await isActivePlatformAdmin(admin, u.user.id)) return u;
  return { ok: false as const, status: 403, error: "Forbidden: Admin access required" };
}

/**
 * DEPRECATED NAME, CANONICAL BEHAVIOUR.
 *
 * ~30 route handlers import this. Rather than edit all of them in the same change that alters what
 * "admin" MEANS — which would make a security cutover indistinguishable from a rename in review —
 * the name is kept and now delegates. It no longer reads an email anywhere. Renaming the call
 * sites is a separate, mechanical change.
 */
export async function requireAdminEmail(req: NextRequest) {
  return requirePlatformAdmin(req);
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
