import type { SupabaseClient } from "@supabase/supabase-js";
import {
  normalizeMicrosoftIdentity,
  resolutionFromRows,
  type MicrosoftIdentityResolution,
} from "@/domain/identity-link/microsoftIdentity";

/**
 * Microsoft identity resolver (Slice R1C-B-2R). SERVER ONLY.
 *
 * Answers one question: which BTY account owns this Microsoft identity. Under the Microsoft-first
 * cutover a BTY account IS a Microsoft account, so there is no merge, no link ceremony and no
 * challenge — an unresolved identity simply has not signed in yet.
 *
 * ACCESS STRATEGY, MEASURED. `auth.identities` is NOT reachable through PostgREST
 * (`/rest/v1/identities` → 404), so no client and no ordinary service query can read it. The
 * codebase's other option — `auth.admin.listUsers({perPage:1000})` — would pull EVERY user's
 * `identity_data` into memory to find one row. Instead this calls a narrowly scoped
 * SECURITY DEFINER RPC that takes only (tenant, object id) and returns only a status and a user
 * id: no claims, no email, no `sub`, no `provider_id` crosses the boundary.
 *
 * EMAIL IS NEVER IDENTITY. There is no email parameter, no email lookup and no email comparison
 * anywhere in this module.
 */

const RESOLVER_RPC = "bty_resolve_user_from_microsoft_identity";

/**
 * Resolve a TRUSTED Microsoft identity tuple to exactly one BTY user.
 *
 * `tenantId`/`aadObjectId` must already have been established by a validated Microsoft request —
 * this function does not authenticate anything, it only looks up what a trusted caller proved.
 */
export async function resolveBtyUserFromMicrosoftIdentity(
  admin: SupabaseClient,
  tenantId: string,
  aadObjectId: string,
): Promise<MicrosoftIdentityResolution> {
  const input = normalizeMicrosoftIdentity(tenantId, aadObjectId);
  if (!input.ok) return { status: "INVALID_INPUT", code: input.code };

  const { data, error } = await admin.rpc(RESOLVER_RPC, {
    p_tenant_id: input.tuple.tenantId,
    p_aad_object_id: input.tuple.aadObjectId,
  });
  if (error) {
    console.error("[microsoftIdentityLink] resolver rpc failed", { message: error.message });
    return { status: "LOOKUP_FAILED" };
  }

  const row = (Array.isArray(data) ? data[0] : data) as { status?: string; user_id?: string | null } | null;
  const status = typeof row?.status === "string" ? row.status : "";
  if (status === "NOT_LINKED") return { status: "NOT_LINKED" };
  if (status === "AMBIGUOUS_IDENTITY") return { status: "AMBIGUOUS_IDENTITY", matched: 2 };
  if (status === "INVALID_INPUT") return { status: "INVALID_INPUT", code: "invalid_tenant_id" };
  if (status === "RESOLVED" && typeof row?.user_id === "string") {
    // The pure mapper decides the verdict; this layer never invents a user id.
    return resolutionFromRows([{ userId: row.user_id }]);
  }
  return { status: "LOOKUP_FAILED" };
}
