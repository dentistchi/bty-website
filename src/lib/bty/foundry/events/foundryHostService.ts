import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Foundry Host capability — server authorization.
 *
 * "Foundry Host" = permission to create and operate Foundry Training Events. It
 * is a product capability, not an org role. Authentication does NOT make someone
 * a Host; an ACTIVE row in `foundry_host_grants` does. All access is service-role
 * (the table is client-deny). Revocation removes operations without deleting any
 * event/participant/XP history.
 *
 * These functions encapsulate the exact idempotent grant/revoke/status semantics
 * the operational script (`scripts/manage-foundry-host.mjs`) mirrors.
 */

type GrantRow = {
  user_id: string;
  status: "active" | "revoked";
  granted_by_user_id: string | null;
  granted_at: string;
  revoked_at: string | null;
};

/** True only when the user holds an ACTIVE Foundry Host grant. */
export async function isActiveFoundryHost(admin: SupabaseClient, userId: string): Promise<boolean> {
  const { data } = await admin
    .from("foundry_host_grants")
    .select("status")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle<{ status: string }>();
  return data?.status === "active";
}

export type HostStatus = "active" | "revoked" | "none";

/** Read a user's Host status (no secrets, grant state only). */
export async function getFoundryHostStatus(admin: SupabaseClient, userId: string): Promise<HostStatus> {
  const { data } = await admin
    .from("foundry_host_grants")
    .select("status")
    .eq("user_id", userId)
    .maybeSingle<{ status: string }>();
  if (!data) return "none";
  return data.status === "active" ? "active" : "revoked";
}

/** Grant (idempotent): upsert an ACTIVE grant, clearing any prior revocation. */
export async function grantFoundryHost(
  admin: SupabaseClient,
  userId: string,
  grantedByUserId: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const row: GrantRow = {
    user_id: userId,
    status: "active",
    granted_by_user_id: grantedByUserId,
    granted_at: new Date().toISOString(),
    revoked_at: null,
  };
  const { error } = await admin.from("foundry_host_grants").upsert(row, { onConflict: "user_id" });
  return error ? { ok: false, error: error.message } : { ok: true };
}

/** Revoke (idempotent): mark revoked + stamp revoked_at. Never deletes history. */
export async function revokeFoundryHost(
  admin: SupabaseClient,
  userId: string,
): Promise<{ ok: true; changed: boolean } | { ok: false; error: string }> {
  const existing = await getFoundryHostStatus(admin, userId);
  if (existing === "none") return { ok: true, changed: false };
  if (existing === "revoked") return { ok: true, changed: false };
  const { error } = await admin
    .from("foundry_host_grants")
    .update({ status: "revoked", revoked_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("status", "active");
  return error ? { ok: false, error: error.message } : { ok: true, changed: true };
}
