/**
 * Leadership responsibility assignments — service layer (Slice 3.1B-1).
 *
 * Server-authoritative curation of the 0..n responsibility dimension on a canonical
 * membership. Mirrors the 3.1A-3 identity-curation authority order and REUSES its scope
 * seam (`resolveManageableOrganizations`) rather than inventing a parallel one.
 *
 * IDENTITY FACTS ONLY — nothing here reads or writes XP, AIR, Arena access, Foundry,
 * Learning Paths, readiness, or evaluation. `listActiveResponsibilityKeys` is the single
 * READ seam left for Slice 3.1B-2 (Leaders audience routing); no routing exists yet.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  validateResponsibilityMutation,
  type ResponsibilityAction,
  type ResponsibilityKey,
  type ResponsibilityValidationError,
} from "@/domain/arena/orgResponsibilities";
import { resolveManageableOrganizations } from "./organizationMembershipService";

export type MembershipResponsibility = {
  id: string;
  responsibilityKey: ResponsibilityKey;
  startedOn: string | null; // YYYY-MM-DD, or null = unknown
};

/**
 * Active responsibilities for one membership, oldest assignment first.
 * Read-only; never used for access decisions in this slice.
 */
export async function listMembershipResponsibilities(
  admin: SupabaseClient,
  membershipId: string,
): Promise<MembershipResponsibility[]> {
  const { data, error } = await admin
    .from("bty_org_membership_responsibilities")
    .select("id, responsibility_key, started_on")
    .eq("membership_id", membershipId)
    .eq("status", "active")
    .order("created_at", { ascending: true });

  if (error || !data) return [];
  return (data as Array<{ id: string; responsibility_key: string; started_on: string | null }>).map(
    (r) => ({
      id: r.id,
      responsibilityKey: r.responsibility_key as ResponsibilityKey,
      startedOn: r.started_on,
    }),
  );
}

/**
 * SLICE 3.1B-2 SEAM — the one intended read point for future Leaders audience routing.
 * Returns only the canonical keys currently ACTIVE on a membership. Deliberately a pure
 * read with no access/audience semantics attached: 3.1B-2 decides what, if anything,
 * these keys route. Nothing in 3.1B-1 calls this for authorization.
 */
export async function listActiveResponsibilityKeys(
  admin: SupabaseClient,
  membershipId: string,
): Promise<ResponsibilityKey[]> {
  const rows = await listMembershipResponsibilities(admin, membershipId);
  return rows.map((r) => r.responsibilityKey);
}

/** Bulk variant for an admin list view — active responsibilities keyed by membership id. */
export async function listResponsibilitiesForMemberships(
  admin: SupabaseClient,
  membershipIds: string[],
): Promise<Record<string, MembershipResponsibility[]>> {
  if (membershipIds.length === 0) return {};
  const { data, error } = await admin
    .from("bty_org_membership_responsibilities")
    .select("id, membership_id, responsibility_key, started_on")
    .in("membership_id", membershipIds)
    .eq("status", "active")
    .order("created_at", { ascending: true });

  const out: Record<string, MembershipResponsibility[]> = {};
  if (error || !data) return out;
  for (const r of data as Array<{
    id: string;
    membership_id: string;
    responsibility_key: string;
    started_on: string | null;
  }>) {
    (out[r.membership_id] ??= []).push({
      id: r.id,
      responsibilityKey: r.responsibility_key as ResponsibilityKey,
      startedOn: r.started_on,
    });
  }
  return out;
}

export type CurateResponsibilityInput = {
  membershipId: string;
  responsibilityKey: string | null;
  action: string;
  startedOn: string | null;
  changedBy: string; // authenticated admin user id — never from the client
  todayISO: string;
};

export type CurateResponsibilityFailReason =
  | ResponsibilityValidationError
  | "membership_not_found"
  | "member_out_of_scope"
  | "organization_membership_missing"
  | "organization_membership_inactive"
  | "responsibility_already_active"
  | "responsibility_not_active"
  | "write_failed";

export type CurateResponsibilityResult =
  | {
      ok: true;
      responsibilityKey: ResponsibilityKey;
      action: ResponsibilityAction;
      before: { startedOn: string | null; status: string | null };
      after: { startedOn: string | null; status: string | null };
    }
  | { ok: false; reason: CurateResponsibilityFailReason; detail?: string };

/**
 * Authority order (never trusts the UI):
 *   1. pure domain validation (valid key + action, date not future / well-formed)
 *   2. the anchor membership must exist, resolving its organization privately
 *   3. that organization must be in the admin's manageable scope (blocks
 *      cross-organization injection)
 *   4. the atomic RPC applies state + history in ONE transaction
 *
 * The target USER is never accepted from the client: the browser addresses a MEMBERSHIP,
 * and `changedBy` comes from the authenticated server session.
 */
export async function curateMembershipResponsibility(
  admin: SupabaseClient,
  input: CurateResponsibilityInput,
): Promise<CurateResponsibilityResult> {
  // 1. Pure domain rules.
  const validation = validateResponsibilityMutation(
    {
      responsibilityKey: input.responsibilityKey,
      action: input.action,
      startedOn: input.startedOn,
    },
    input.todayISO,
  );
  if (!validation.ok) return { ok: false, reason: validation.reason };

  // 2. Resolve the anchor membership privately (organization is never client-supplied).
  const { data: anchor } = await admin
    .from("bty_org_memberships")
    .select("id, organization_id")
    .eq("id", input.membershipId)
    .maybeSingle<{ id: string; organization_id: string }>();
  if (!anchor) return { ok: false, reason: "membership_not_found" };

  // 3. Cross-organization injection guard — reuses the single 3.1A-3 scope seam.
  const manageable = await resolveManageableOrganizations(admin, input.changedBy);
  const manageableIds = new Set(manageable.map((o) => o.id));
  if (!manageableIds.has(anchor.organization_id)) {
    return { ok: false, reason: "member_out_of_scope" };
  }

  // 4. Atomic state + history.
  const { data, error } = await admin.rpc("bty_curate_membership_responsibility", {
    p_membership_id: input.membershipId,
    p_responsibility_key: input.responsibilityKey,
    p_action: input.action,
    p_started_on: input.action === "remove" ? null : input.startedOn,
    p_changed_by: input.changedBy,
  });

  if (error) {
    const msg = error.message ?? "";
    if (/organization_membership_missing/.test(msg)) {
      return { ok: false, reason: "organization_membership_missing" };
    }
    if (/organization_membership_inactive/.test(msg)) {
      return { ok: false, reason: "organization_membership_inactive" };
    }
    if (/responsibility_already_active/.test(msg)) {
      return { ok: false, reason: "responsibility_already_active" };
    }
    if (/responsibility_not_active/.test(msg)) {
      return { ok: false, reason: "responsibility_not_active" };
    }
    if (/responsibility_date_future/.test(msg)) {
      return { ok: false, reason: "start_date_in_future" };
    }
    if (/invalid_responsibility_action/.test(msg)) return { ok: false, reason: "invalid_action" };
    if (/responsibility_key_check/.test(msg)) {
      return { ok: false, reason: "invalid_responsibility" };
    }
    return { ok: false, reason: "write_failed", detail: msg };
  }

  const row = (Array.isArray(data) ? data[0] : data) as
    | {
        responsibility_key: string;
        action: string;
        prev_started_on: string | null;
        prev_status: string | null;
        new_started_on: string | null;
        new_status: string | null;
      }
    | undefined;
  if (!row) return { ok: false, reason: "write_failed", detail: "rpc returned no row" };

  return {
    ok: true,
    responsibilityKey: row.responsibility_key as ResponsibilityKey,
    action: row.action as ResponsibilityAction,
    before: { startedOn: row.prev_started_on, status: row.prev_status },
    after: { startedOn: row.new_started_on, status: row.new_status },
  };
}
