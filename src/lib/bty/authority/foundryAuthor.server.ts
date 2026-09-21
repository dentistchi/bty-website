import type { SupabaseClient } from "@supabase/supabase-js";
import { isActivePlatformAdmin } from "@/lib/bty/authority/platformAdmin.server";
import { isActiveExplicitFoundryHost } from "@/lib/bty/foundry/events/foundryHostService";
import { refreshMicrosoftAuthorityForCanonicalUser } from "@/lib/bty/foundry/events/microsoftManagerSync.server";

/**
 * Server-only Foundry authoring capability.
 *
 * This answers only whether a canonical BTY user may create and operate their
 * own Foundry training/event content. Record ownership and organization scope
 * are enforced by the routes and services behind this gate.
 *
 * Platform admin and explicit Host are exceptions. All automatic authority is a
 * successfully-synced Microsoft snapshot keyed by verified tenant + object ID.
 */

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
    if (await isActiveExplicitFoundryHost(admin, userId)) return true;

    let snapshot = await single(
      (db.from("bty_microsoft_directory_authority").select("is_provider, is_manager, sync_status, account_enabled, user_type").eq("linked_user_id", userId) as {
        maybeSingle: () => Promise<Lookup>;
      }),
    );
    if (!snapshot.error && !snapshot.data) {
      await refreshMicrosoftAuthorityForCanonicalUser(admin, userId);
      snapshot = await single(
        (db.from("bty_microsoft_directory_authority").select("is_provider, is_manager, sync_status, account_enabled, user_type").eq("linked_user_id", userId) as {
          maybeSingle: () => Promise<Lookup>;
        }),
      );
    }
    if (snapshot.error || snapshot.data?.sync_status !== "success") return false;
    if (snapshot.data?.account_enabled !== true || String(snapshot.data?.user_type).toLowerCase() !== "member") return false;
    return snapshot.data?.is_provider === true || snapshot.data?.is_manager === true;
  } catch {
    // Do not log a user id or roster detail from an authorization failure.
    console.error("[foundry-author] authority lookup failed");
    return false;
  }
}

export const FOUNDRY_AUTHOR_ERROR = "foundry_author_required";
