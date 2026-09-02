import type { SupabaseClient } from "@supabase/supabase-js";
import { effectiveHostStatus, type HostGrantState } from "@/domain/foundry/hostAuthority";

/**
 * Foundry Host capability — server authorization.
 *
 * "Foundry Host" = permission to create and operate Foundry Training Events. It
 * is a product capability, not an org role. Authentication does NOT make someone
 * a Host; an ACTIVE row in `foundry_host_grants` does. All access is service-role
 * (the table is client-deny). Revocation removes operations without deleting any
 * event/participant/XP history.
 *
 * TWO SOURCES OF AUTHORITY, ONE ROW (Microsoft Manager Authority V1). A grant may be held
 * manually, or derived from Microsoft Entra manager status, or BOTH. `status` stays the single
 * effective answer every reader already consults — 31 API routes through `requireManager`, plus
 * two SQL-layer checks — so nothing downstream had to learn about provenance.
 *
 * The reason provenance exists at all: without it, a manager sync cannot tell a grant it created
 * from the Founder's standing grant, and the first complete run would revoke the Founder for the
 * crime of having no direct report.
 */

/** True only when the user holds an ACTIVE Foundry Host grant, from any source. */
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

type ProvenanceRow = {
  user_id: string;
  manual_granted: boolean | null;
  microsoft_manager_granted: boolean | null;
  microsoft_manager_synced_at?: string | null;
};

function toState(row: ProvenanceRow | null, userId: string): HostGrantState {
  return {
    userId: row?.user_id ?? userId,
    manualGranted: row?.manual_granted === true,
    microsoftManagerGranted: row?.microsoft_manager_granted === true,
  };
}

/** One user's provenance, as the pure layer wants it. Absent row = holds nothing. */
export async function readHostGrantState(
  admin: SupabaseClient,
  userId: string,
): Promise<HostGrantState & { microsoftSyncedAt: string | null }> {
  const { data } = await admin
    .from("foundry_host_grants")
    .select("user_id, manual_granted, microsoft_manager_granted, microsoft_manager_synced_at")
    .eq("user_id", userId)
    .maybeSingle<ProvenanceRow>();
  return { ...toState(data ?? null, userId), microsoftSyncedAt: data?.microsoft_manager_synced_at ?? null };
}

/** Every grant row's provenance — the sync's "before" picture. */
export async function listHostGrantStates(admin: SupabaseClient): Promise<HostGrantState[]> {
  const { data, error } = await admin
    .from("foundry_host_grants")
    .select("user_id, manual_granted, microsoft_manager_granted")
    .returns<ProvenanceRow[]>();
  if (error) {
    console.error("[foundry-host] list grants failed", { code: error.code ?? "unknown" });
    return [];
  }
  return (data ?? []).map((r) => toState(r, r.user_id));
}

/**
 * Grant MANUAL authority (idempotent).
 *
 * `microsoft_manager_granted` is deliberately absent from the payload: PostgREST only writes the
 * columns it is given, so an existing Microsoft-derived flag survives a manual grant untouched.
 */
export async function grantFoundryHost(
  admin: SupabaseClient,
  userId: string,
  grantedByUserId: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await admin.from("foundry_host_grants").upsert(
    {
      user_id: userId,
      status: "active",
      manual_granted: true,
      granted_by_user_id: grantedByUserId,
      granted_at: new Date().toISOString(),
      revoked_at: null,
    },
    { onConflict: "user_id" },
  );
  return error ? { ok: false, error: error.message } : { ok: true };
}

/**
 * Revoke MANUAL authority (idempotent). Never deletes history.
 *
 * If the person independently holds Microsoft manager entitlement they REMAIN an active Host, and
 * the result says so rather than reporting a revocation that did not take effect. Removing a
 * genuine manager's Host is a Microsoft hierarchy change, not a BTY one.
 */
export async function revokeFoundryHost(
  admin: SupabaseClient,
  userId: string,
): Promise<{ ok: true; changed: boolean; stillActiveViaMicrosoft: boolean } | { ok: false; error: string }> {
  const state = await readHostGrantState(admin, userId);
  const existing = await getFoundryHostStatus(admin, userId);
  if (existing === "none") return { ok: true, changed: false, stillActiveViaMicrosoft: false };
  if (!state.manualGranted && existing === "revoked") {
    return { ok: true, changed: false, stillActiveViaMicrosoft: false };
  }

  const next: HostGrantState = { ...state, manualGranted: false };
  const status = effectiveHostStatus(next);
  const { error } = await admin
    .from("foundry_host_grants")
    .update({
      manual_granted: false,
      status,
      revoked_at: status === "revoked" ? new Date().toISOString() : null,
    })
    .eq("user_id", userId);
  if (error) return { ok: false, error: error.message };
  return { ok: true, changed: state.manualGranted, stillActiveViaMicrosoft: status === "active" };
}

/**
 * Set or clear MICROSOFT-DERIVED authority (idempotent). The sync's only write.
 *
 * `manual_granted` is read and carried forward, never overwritten — so clearing Microsoft
 * entitlement from someone who also holds a manual grant leaves them an active Host. That is the
 * Founder-preservation rule, expressed where the write happens rather than as a special case.
 *
 * A user with NO row who is not a manager gets no row: the sync does not manufacture revoked
 * rows for the entire organisation.
 */
export async function setMicrosoftManagerGrant(
  admin: SupabaseClient,
  userId: string,
  granted: boolean,
): Promise<{ ok: true; changed: boolean } | { ok: false; error: string }> {
  const state = await readHostGrantState(admin, userId);
  if (state.microsoftManagerGranted === granted && (granted || state.manualGranted)) {
    // Already in the wanted shape — stamp freshness only.
    const { error } = await admin
      .from("foundry_host_grants")
      .update({ microsoft_manager_synced_at: new Date().toISOString() })
      .eq("user_id", userId);
    return error ? { ok: false, error: error.message } : { ok: true, changed: false };
  }
  if (!granted && !state.microsoftManagerGranted) return { ok: true, changed: false };

  const next: HostGrantState = { ...state, microsoftManagerGranted: granted };
  const status = effectiveHostStatus(next);
  const now = new Date().toISOString();

  const { error } = await admin.from("foundry_host_grants").upsert(
    {
      user_id: userId,
      status,
      microsoft_manager_granted: granted,
      microsoft_manager_synced_at: now,
      revoked_at: status === "revoked" ? now : null,
    },
    { onConflict: "user_id" },
  );
  return error ? { ok: false, error: error.message } : { ok: true, changed: true };
}
