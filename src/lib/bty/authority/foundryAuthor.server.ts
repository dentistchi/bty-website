import type { SupabaseClient } from "@supabase/supabase-js";
import { isActivePlatformAdmin } from "@/lib/bty/authority/platformAdmin.server";
import { isActiveExplicitFoundryHost } from "@/lib/bty/foundry/events/foundryHostService";
import { refreshMicrosoftAuthorityForCanonicalUser, refreshMicrosoftAuthorityForUser } from "@/lib/bty/foundry/events/microsoftManagerSync.server";

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
      (db.from("bty_microsoft_authority_snapshots").select("is_provider, is_manager, sync_status, synced_at, tenant_id, aad_object_id").eq("user_id", userId) as {
        maybeSingle: () => Promise<Lookup>;
      }),
    );
    if (!snapshot.error && !snapshot.data) {
      await refreshMicrosoftAuthorityForCanonicalUser(admin, userId);
      snapshot = await single(
        (db.from("bty_microsoft_authority_snapshots").select("is_provider, is_manager, sync_status, synced_at, tenant_id, aad_object_id").eq("user_id", userId) as {
          maybeSingle: () => Promise<Lookup>;
        }),
      );
    }
    if (snapshot.error || snapshot.data?.sync_status !== "success") return false;
    const syncedAt = typeof snapshot.data.synced_at === "string" ? Date.parse(snapshot.data.synced_at) : NaN;
    const stale = !Number.isFinite(syncedAt) || Date.now() - syncedAt >= 60 * 60 * 1000;
    if (stale && typeof snapshot.data.tenant_id === "string" && typeof snapshot.data.aad_object_id === "string") {
      await refreshMicrosoftAuthorityForUser(admin, {
        user_id: userId, tenant_id: snapshot.data.tenant_id, aad_object_id: snapshot.data.aad_object_id,
      });
      snapshot = await single(
        (db.from("bty_microsoft_authority_snapshots").select("is_provider, is_manager, sync_status").eq("user_id", userId) as {
          maybeSingle: () => Promise<Lookup>;
        }),
      );
      if (snapshot.error || snapshot.data?.sync_status !== "success") return false;
    }
    return snapshot.data?.is_provider === true || snapshot.data?.is_manager === true;
  } catch {
    // Do not log a user id or roster detail from an authorization failure.
    console.error("[foundry-author] authority lookup failed");
    return false;
  }
}

export const FOUNDRY_AUTHOR_ERROR = "foundry_author_required";
