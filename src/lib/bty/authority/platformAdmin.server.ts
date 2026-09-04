import type { SupabaseClient } from "@supabase/supabase-js";
import { isActiveFoundryHost } from "@/lib/bty/foundry/events/foundryHostService";

/**
 * BTY platform-admin authority, and the capability inheritance that follows from it. SERVER ONLY.
 *
 * ★ THE ONLY INPUT IS A CANONICAL USER ID.
 *
 * Not an email, not `user_metadata`, not a Teams field, not a Microsoft directory role. A caller
 * reaches a canonical user id the same way every other authority in this product does — an
 * authenticated session, or the trusted Teams resolver (tenant_id + aad_object_id -> user id) —
 * and only then asks these functions anything. That ordering is the whole security model: this
 * file cannot be fooled by a claim, because it never reads one.
 *
 * WHAT THIS REPLACED, MEASURED (2026-09-02). Admin was `BTY_ADMIN_EMAILS`, an environment string
 * compared against `user.email` per request, guarding ~30 API routes and the admin layout — with
 * no audit trail, no revocation, and a fail-OPEN branch that allowed EVERY authenticated user when
 * the variable was unset. Nothing about it survives here.
 *
 * A Microsoft 365 or Entra directory administrator is NOT a BTY admin. Upstream directory roles are
 * never consulted: BTY authority is BTY's to grant, and conflating the two would hand the product's
 * admin surface to whoever happens to administer the tenant.
 */

/**
 * True only when the user holds an ACTIVE platform-admin grant.
 *
 * ★ FAILS CLOSED. A database error, a missing table (this ships before its migration is applied),
 * a network fault — every one of them returns false. An authority check that cannot reach its
 * source has not answered "yes"; it has not answered at all, and the only safe reading of silence
 * on an admin gate is "no".
 */
export async function isActivePlatformAdmin(
  admin: SupabaseClient,
  userId: string | null | undefined,
): Promise<boolean> {
  if (!userId) return false;
  try {
    const { data, error } = await admin
      .from("bty_platform_admin_grants")
      .select("status")
      .eq("user_id", userId)
      .maybeSingle<{ status: string }>();
    if (error) {
      // Code only. An authorization log must not become a way to read the roster.
      console.error("[platform-admin] lookup failed", { code: error.code ?? "unknown" });
      return false;
    }
    return data?.status === "active";
  } catch {
    console.error("[platform-admin] lookup threw");
    return false;
  }
}

/**
 * ★ THE INHERITANCE RULE, IN ONE PLACE.
 *
 *   host capability = active platform admin OR active Foundry Host grant
 *
 * Admin implies Host capability; it does not require a Host grant, a Microsoft manager
 * relationship, migration 20260903000000, or Graph credentials. Those are separate authority
 * sources with their own failure modes, and an admin must not be locked out by any of them.
 *
 * The OR is evaluated admin-first and short-circuits, so the ordinary Host path costs exactly what
 * it did before and an admin never touches the Host table at all.
 *
 * ★ WHAT THIS GRANTS IS FEATURE AVAILABILITY, AND ONLY THAT.
 *
 * It answers "may this person act as a Host at all", not "may they touch THIS record". Every
 * Foundry operation downstream still scopes to the caller's own rows -- there are 29 owner-scoped
 * reads and writes behind this gate -- so an admin who owns nothing sees nothing. Tenant
 * isolation, input validation, confirmation steps, audit writes and provider limits all sit
 * downstream and still apply in full. An admin gets to open the door, not to skip the room.
 */
export async function hasHostCapability(
  admin: SupabaseClient,
  userId: string | null | undefined,
): Promise<boolean> {
  if (!userId) return false;
  if (await isActivePlatformAdmin(admin, userId)) return true;
  return isActiveFoundryHost(admin, userId);
}

/*
 * `canTrackWithBty` USED TO LIVE HERE, AND IS DELIBERATELY GONE (2026-09-04).
 *
 * It aliased `hasHostCapability`, on the premise that Track with BTY is an act of organizational
 * authority. Measured against production, that premise cost the product a real demonstration:
 * 3 of 15 Microsoft-linked people held admin or Host, and a DSO employee found "Track with BTY"
 * in their Teams menu and was told it was not available on their account.
 *
 * Track, Save, receiving a Track and answering one are COLLABORATION, and their floor is now
 * `isCollaborationParticipant` in `src/domain/authority/collaborationParticipant.ts` — a resolved
 * Microsoft identity inside BTY's own tenant. The function is removed rather than left as a
 * deprecated alias, because an alias that still compiles is an invitation to re-gate collaboration
 * on organizational authority by accident.
 *
 * `hasHostCapability` above is unchanged and remains the ORGANIZATIONAL AUTHORING authority:
 * 31 Foundry manager routes, and Event creation.
 */
