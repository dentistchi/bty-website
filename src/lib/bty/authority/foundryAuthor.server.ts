import type { SupabaseClient } from "@supabase/supabase-js";
import { isActivePlatformAdmin } from "@/lib/bty/authority/platformAdmin.server";
import { isActiveFoundryHost } from "@/lib/bty/foundry/events/foundryHostService";

/**
 * Server-only Foundry authoring capability.
 *
 * This answers only whether a canonical BTY user may create and operate their
 * own Foundry training/event content. Record ownership and organization scope
 * are enforced by the routes and services behind this gate.
 *
 * Precedence is intentional: platform admin, explicit Host exception, canonical
 * professional identity, then structured transitional identity only when the
 * canonical primary role is unknown. No email, display name, directory title, or
 * user metadata is an input to this decision.
 */

const CANONICAL_AUTHOR_ROLES = new Set([
  "GENERAL_DENTIST",
  "ORTHODONTIST",
  "OFFICE_MANAGER",
  "AREA_MANAGER",
  "STATE_REGIONAL_DIRECTOR",
]);

const TRANSITIONAL_AUTHOR_ROLES = new Set(["doctor", "office_manager", "regional_manager"]);

type Row = Record<string, unknown> | null;
type Lookup = { data: Row; error: { code?: string } | null };
type FilterQuery = { eq: (column: string, value: unknown) => FilterQuery; maybeSingle: () => Promise<Lookup> };

async function single(query: { maybeSingle: () => Promise<Lookup> }): Promise<Lookup> {
  return query.maybeSingle();
}

/**
 * Resolve the sole Foundry create/operate capability. Every source failure
 * denies the request rather than treating an unavailable authority source as
 * absence. This is deliberately separate from content ownership checks.
 */
export async function hasFoundryAuthorCapability(
  admin: SupabaseClient,
  userId: string | null | undefined,
): Promise<boolean> {
  if (!userId) return false;

  try {
    const db = admin as unknown as {
      from: (table: string) => {
        select: (columns: string) => {
          eq: (column: string, value: unknown) => unknown;
        };
      };
    };

    // Preserve the established, tested exception sources. Both helpers fail
    // closed themselves; keeping them here also keeps existing route seams
    // stable while the eligible-role rule is added beneath them.
    if (await isActivePlatformAdmin(admin, userId)) return true;
    if (await isActiveFoundryHost(admin, userId)) return true;

    const canonicalQuery = db
      .from("bty_org_memberships")
      .select("primary_role_key")
      .eq("user_id", userId) as unknown as FilterQuery;
    const canonical = await single(canonicalQuery.eq("status", "active").eq("is_primary", true));
    if (canonical.error) return false;
    const primaryRole = canonical.data?.primary_role_key;
    // A non-null canonical role is authoritative, including a known non-author
    // role. Stale legacy data never overrides a curated professional identity.
    if (typeof primaryRole === "string") return CANONICAL_AUTHOR_ROLES.has(primaryRole);

    const legacyQuery = db
      .from("memberships")
      .select("role")
      .eq("user_id", userId) as unknown as FilterQuery;
    const legacy = await single(legacyQuery.eq("status", "active"));
    if (legacy.error) return false;
    if (typeof legacy.data?.role === "string" && TRANSITIONAL_AUTHOR_ROLES.has(legacy.data.role)) return true;

    const sso = await single(
      (db.from("workforce_profiles").select("team, sso_level").eq("user_id", userId) as {
        maybeSingle: () => Promise<Lookup>;
      }),
    );
    if (sso.error) return false;
    return sso.data?.team === "sso" && sso.data?.sso_level === "manager";
  } catch {
    // Do not log a user id or roster detail from an authorization failure.
    console.error("[foundry-author] authority lookup failed");
    return false;
  }
}

export const FOUNDRY_AUTHOR_ERROR = "foundry_author_required";
