import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isPrimaryRoleKey,
  isJobFamilyKey,
  isFamilyRoleCompatible,
  validateIdentityCuration,
  type CurationValidationError,
} from "@/domain/arena/orgIdentity";

/**
 * Canonical organization-membership service (server-only, Slice 3.1A-1).
 *
 * Owns the bty_enterprises → bty_organizations → bty_org_memberships tables. Writes
 * happen ONLY through a service-role (admin) client — the tables are client-deny. This
 * slice deliberately does NOT read/write the legacy `memberships` table and does NOT
 * touch the Arena access gate.
 *
 * The approval write-through is NOT atomic with the arena_membership_requests approval
 * (two separate statements; supabase-js has no cross-statement transaction here). The
 * approve route therefore approves FIRST (access-authoritative), then calls
 * `ensureCanonicalMembershipFromApproval` best-effort; any miss is caught idempotently
 * by the migration backfill / `reconciliationStatus`. Failure is reported, never hidden.
 */

export const BTY_DSO_ENTERPRISE_KEY = "BTY_DSO";
export const BTY_LEGACY_ORG_KEY = "BTY_LEGACY";

export type BtyOrganizationRow = {
  id: string;
  enterprise_id: string;
  organization_key: string;
  display_name: string;
  status: string;
};

export type BtyMembershipRow = {
  id: string;
  user_id: string;
  organization_id: string;
  status: string;
  is_primary: boolean;
  joined_at: string | null;
  job_family_key: string | null;
  primary_role_key: string | null;
  identity_source: string;
};

const ORG_COLS = "id, enterprise_id, organization_key, display_name, status";
const MEMBERSHIP_COLS =
  "id, user_id, organization_id, status, is_primary, joined_at, job_family_key, primary_role_key, identity_source";

/** Resolve the bootstrap BTY_LEGACY organization (seeded by the migration), or null. */
export async function resolveBootstrapOrganization(
  admin: SupabaseClient,
): Promise<BtyOrganizationRow | null> {
  const { data: ent } = await admin
    .from("bty_enterprises")
    .select("id")
    .eq("enterprise_key", BTY_DSO_ENTERPRISE_KEY)
    .maybeSingle<{ id: string }>();
  if (!ent) return null;
  const { data: org } = await admin
    .from("bty_organizations")
    .select(ORG_COLS)
    .eq("enterprise_id", ent.id)
    .eq("organization_key", BTY_LEGACY_ORG_KEY)
    .maybeSingle<BtyOrganizationRow>();
  return org ?? null;
}

/** The user's active primary canonical membership, if any (any organization). */
export async function getActivePrimaryMembership(
  admin: SupabaseClient,
  userId: string,
): Promise<BtyMembershipRow | null> {
  const { data } = await admin
    .from("bty_org_memberships")
    .select(MEMBERSHIP_COLS)
    .eq("user_id", userId)
    .eq("status", "active")
    .eq("is_primary", true)
    .maybeSingle<BtyMembershipRow>();
  return data ?? null;
}

export type EnsureMembershipResult =
  | { ok: true; created: boolean; reason: "created" | "already_primary" | "already_in_legacy" }
  | { ok: false; reason: "bootstrap_org_missing" | "write_failed"; detail?: string };

/**
 * Ensure a canonical membership exists for a just-approved user. Idempotent and
 * curation-safe:
 *   - if the user already has ANY active primary membership → do nothing (never reassign
 *     a curated membership to BTY_LEGACY);
 *   - else if a BTY_LEGACY row already exists for the user → do nothing (preserve);
 *   - else insert one active primary BTY_LEGACY membership with UNKNOWN professional
 *     identity (roles/dates null) and identity_source='membership_approval'.
 * Never writes the legacy `memberships` table.
 */
export async function ensureCanonicalMembershipFromApproval(
  admin: SupabaseClient,
  input: { userId: string; joinedAt?: string | null; sourceRequestId?: number | null },
): Promise<EnsureMembershipResult> {
  const org = await resolveBootstrapOrganization(admin);
  if (!org) return { ok: false, reason: "bootstrap_org_missing" };

  // Do not create a second active primary (protects curated rows + the one-primary index).
  const existingPrimary = await getActivePrimaryMembership(admin, input.userId);
  if (existingPrimary) return { ok: true, created: false, reason: "already_primary" };

  // Preserve any pre-existing BTY_LEGACY row for this user, whatever its status.
  const { data: existingLegacy } = await admin
    .from("bty_org_memberships")
    .select("id")
    .eq("user_id", input.userId)
    .eq("organization_id", org.id)
    .maybeSingle<{ id: string }>();
  if (existingLegacy) return { ok: true, created: false, reason: "already_in_legacy" };

  const { error } = await admin.from("bty_org_memberships").insert({
    user_id: input.userId,
    organization_id: org.id,
    status: "active",
    is_primary: true,
    joined_at: input.joinedAt ?? null,
    job_family_key: null,
    primary_role_key: null,
    role_started_at: null,
    identity_source: "membership_approval",
    source_membership_request_id: input.sourceRequestId ?? null,
  });
  // A concurrent insert can race the unique(user_id, organization_id) constraint — treat
  // a duplicate as an idempotent success, not a failure.
  if (error) {
    const dup = /duplicate key|unique/i.test(error.message);
    if (dup) return { ok: true, created: false, reason: "already_in_legacy" };
    return { ok: false, reason: "write_failed", detail: error.message };
  }
  return { ok: true, created: true, reason: "created" };
}

/**
 * Aggregate reconciliation counts for authorized admin diagnostics only (no PII, no rows):
 * how many approved legacy members vs canonical active memberships currently exist.
 */
export async function reconciliationStatus(
  admin: SupabaseClient,
): Promise<{ approvedRequests: number; canonicalActive: number }> {
  const { count: approved } = await admin
    .from("arena_membership_requests")
    .select("id", { count: "exact", head: true })
    .eq("status", "approved");
  const { count: canonical } = await admin
    .from("bty_org_memberships")
    .select("id", { count: "exact", head: true })
    .eq("status", "active");
  return { approvedRequests: approved ?? 0, canonicalActive: canonical ?? 0 };
}

// ---------------------------------------------------------------------------
// Admin READ surface (Slice 3.1A-2) — observability only, zero writes.
// ---------------------------------------------------------------------------

/** One canonical membership row, admin-shaped. `userId` is internal (the route strips it). */
export type AdminCanonicalMembership = {
  membershipId: string;
  userId: string;
  organizationId: string;
  organizationKey: string | null;
  organizationName: string | null;
  status: string;
  isPrimary: boolean;
  jobFamilyKey: string | null;
  primaryRoleKey: string | null;
  identitySource: string;
  joinedAt: string | null;
  roleStartedOn: string | null; // canonical calendar DATE 'YYYY-MM-DD'
  createdAt: string;
  updatedAt: string;
};

export type AdminCanonicalSummary = {
  approvedRequests: number;
  activeCanonicalMemberships: number;
  approvedWithoutCanonical: number;
  canonicalWithoutApproved: number;
  unknownJobFamily: number;
  unknownPrimaryRole: number;
  fullyClassified: number;
  duplicateActivePrimary: number;
  duplicateUserOrg: number;
  unresolvedOrganization: number;
  reconciliationStatus: "aligned" | "drift";
};

type RawMembershipRow = {
  id: string;
  user_id: string;
  organization_id: string;
  status: string;
  is_primary: boolean;
  job_family_key: string | null;
  primary_role_key: string | null;
  role_started_on: string | null;
  identity_source: string;
  joined_at: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * List canonical memberships + a reconciliation summary for the admin observability
 * page (Slice 3.1A-2). READ-ONLY: no writes, and it NEVER queries the legacy
 * `memberships`/`organizations` tables. Ordering is deterministic: unresolved identity
 * (no job family) first, then oldest first, then membership id. `userId` is returned for
 * server-side name resolution; the route strips it before responding to the browser.
 */
export async function listCanonicalMembershipsForAdmin(
  admin: SupabaseClient,
): Promise<{ summary: AdminCanonicalSummary; memberships: AdminCanonicalMembership[] }> {
  const { data: memData } = await admin
    .from("bty_org_memberships")
    .select(
      "id, user_id, organization_id, status, is_primary, job_family_key, primary_role_key, role_started_on, identity_source, joined_at, created_at, updated_at",
    );
  const { data: orgData } = await admin
    .from("bty_organizations")
    .select("id, organization_key, display_name");
  const { data: approvedData } = await admin
    .from("arena_membership_requests")
    .select("user_id")
    .eq("status", "approved");

  const orgMap = new Map<string, { organization_key: string; display_name: string }>(
    ((orgData ?? []) as Array<{ id: string; organization_key: string; display_name: string }>).map((o) => [
      o.id,
      { organization_key: o.organization_key, display_name: o.display_name },
    ]),
  );
  const approvedSet = new Set(
    ((approvedData ?? []) as Array<{ user_id: string }>).map((r) => r.user_id),
  );

  const rows = (memData ?? []) as RawMembershipRow[];
  const memberships: AdminCanonicalMembership[] = rows.map((m) => {
    const org = orgMap.get(m.organization_id);
    return {
      membershipId: m.id,
      userId: m.user_id,
      organizationId: m.organization_id,
      organizationKey: org?.organization_key ?? null,
      organizationName: org?.display_name ?? null,
      status: m.status,
      isPrimary: m.is_primary,
      jobFamilyKey: m.job_family_key,
      primaryRoleKey: m.primary_role_key,
      identitySource: m.identity_source,
      joinedAt: m.joined_at,
      roleStartedOn: m.role_started_on,
      createdAt: m.created_at,
      updatedAt: m.updated_at,
    };
  });

  // Deterministic: unresolved identity first, then oldest, then id.
  memberships.sort((a, b) => {
    const au = a.jobFamilyKey == null ? 0 : 1;
    const bu = b.jobFamilyKey == null ? 0 : 1;
    if (au !== bu) return au - bu;
    if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1;
    return a.membershipId < b.membershipId ? -1 : a.membershipId > b.membershipId ? 1 : 0;
  });

  const activePrimary = memberships.filter((m) => m.status === "active" && m.isPrimary);
  const activePrimaryUsers = new Set(activePrimary.map((m) => m.userId));

  const approvedWithoutCanonical = Array.from(approvedSet).filter((u) => !activePrimaryUsers.has(u)).length;
  const canonicalWithoutApproved = activePrimary.filter((m) => !approvedSet.has(m.userId)).length;

  // duplicate active-primary per user
  const activePrimaryByUser = new Map<string, number>();
  for (const m of activePrimary) activePrimaryByUser.set(m.userId, (activePrimaryByUser.get(m.userId) ?? 0) + 1);
  const duplicateActivePrimary = Array.from(activePrimaryByUser.values()).filter((n) => n > 1).length;

  // duplicate (user, organization)
  const byUserOrg = new Map<string, number>();
  for (const m of memberships) {
    const k = `${m.userId}¦${m.organizationKey ?? ""}`;
    byUserOrg.set(k, (byUserOrg.get(k) ?? 0) + 1);
  }
  const duplicateUserOrg = Array.from(byUserOrg.values()).filter((n) => n > 1).length;

  const unresolvedOrganization = memberships.filter((m) => m.organizationKey == null).length;
  const unknownJobFamily = memberships.filter((m) => m.jobFamilyKey == null).length;
  const unknownPrimaryRole = memberships.filter((m) => m.primaryRoleKey == null).length;
  const fullyClassified = memberships.filter((m) => m.jobFamilyKey != null && m.primaryRoleKey != null).length;

  const aligned =
    approvedWithoutCanonical === 0 &&
    canonicalWithoutApproved === 0 &&
    duplicateActivePrimary === 0 &&
    duplicateUserOrg === 0 &&
    unresolvedOrganization === 0;

  const summary: AdminCanonicalSummary = {
    approvedRequests: approvedSet.size,
    activeCanonicalMemberships: activePrimary.length,
    approvedWithoutCanonical,
    canonicalWithoutApproved,
    unknownJobFamily,
    unknownPrimaryRole,
    fullyClassified,
    duplicateActivePrimary,
    duplicateUserOrg,
    unresolvedOrganization,
    reconciliationStatus: aligned ? "aligned" : "drift",
  };

  return { summary, memberships };
}

/**
 * Guard for a future admin-curation path: validate an optional (family, role) pair before
 * it is ever written. UNKNOWN on either side is allowed (this slice never guesses). Only a
 * fully-specified, incompatible pair is rejected. Not wired to any write in 3.1A-1.
 */
export function validateProfessionalIdentity(input: {
  jobFamilyKey?: string | null;
  primaryRoleKey?: string | null;
}): { ok: true } | { ok: false; reason: "invalid_family" | "invalid_role" | "incompatible" } {
  const fam = input.jobFamilyKey ?? null;
  const role = input.primaryRoleKey ?? null;
  if (fam !== null && !isJobFamilyKey(fam)) return { ok: false, reason: "invalid_family" };
  if (role !== null && !isPrimaryRoleKey(role)) return { ok: false, reason: "invalid_role" };
  if (!isFamilyRoleCompatible(fam as never, role as never)) return { ok: false, reason: "incompatible" };
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Admin CURATION write surface (Slice 3.1A-3).
//
// The one place manageable-organization scope is resolved. Today every
// BTY_ADMIN_EMAILS admin manages every active organization (the app is
// effectively single-tenant: one active BTY_LEGACY org). This is the seam where
// a future per-admin org scope slots in — every caller (selector options AND the
// write authorization) funnels through it, so tightening it later is a one-place
// change and cannot be bypassed.
// ---------------------------------------------------------------------------

export type ManageableOrganization = {
  id: string;
  organizationKey: string;
  displayName: string;
  enterpriseId: string;
};

/** Active organizations the given admin may manage. */
export async function resolveManageableOrganizations(
  admin: SupabaseClient,
  // _adminUserId is accepted now so the future per-admin scope needs no signature change.
  _adminUserId?: string,
): Promise<ManageableOrganization[]> {
  const { data } = await admin
    .from("bty_organizations")
    .select("id, organization_key, display_name, enterprise_id, status")
    .eq("status", "active")
    .order("organization_key", { ascending: true });
  return ((data ?? []) as Array<{
    id: string;
    organization_key: string;
    display_name: string;
    enterprise_id: string;
  }>).map((o) => ({
    id: o.id,
    organizationKey: o.organization_key,
    displayName: o.display_name,
    enterpriseId: o.enterprise_id,
  }));
}

export type CurateIdentityInput = {
  membershipId: string;
  organizationId: string;
  jobFamilyKey: string | null;
  primaryRoleKey: string | null;
  roleStartedOn: string | null; // YYYY-MM-DD or null (unknown)
  changedBy: string; // authenticated admin user id
  todayISO: string; // injected `YYYY-MM-DD` (domain purity: no Date.now in the rule core)
};

/** Reason keys for a rejected curation, each mapped to an HTTP status by the route. */
export type CurateIdentityFailReason =
  | CurationValidationError
  | "organization_not_manageable"
  | "membership_not_found"
  | "member_out_of_scope"
  | "organization_membership_missing"
  | "organization_membership_inactive"
  | "primary_membership_conflict"
  | "write_failed";

type IdentitySnapshot = {
  organizationId: string | null;
  jobFamilyKey: string | null;
  primaryRoleKey: string | null;
  roleStartedOn: string | null;
  isPrimary: boolean | null;
};

export type CurateIdentityResult =
  | { ok: true; before: IdentitySnapshot; after: IdentitySnapshot }
  | { ok: false; reason: CurateIdentityFailReason; detail?: string };

/**
 * Server-authoritative professional-identity curation. NOTHING is trusted because the UI
 * filtered it. Order of authority:
 *   1. domain validation (family/role validity + compatibility + role-requires-family +
 *      role date ≤ today)                                   → CurationValidationError
 *   2. the submitted organization must be in the admin's manageable scope
 *      (rejects cross-org id injection)                     → organization_not_manageable
 *   3. the anchor membership (the clicked row) must exist AND its organization must be in
 *      scope, resolving the target USER privately            → membership_not_found / member_out_of_scope
 *   4. the atomic RPC curates the user's EXISTING membership in the selected organization
 *      and (re)designates it primary — it never creates/moves/deletes a row. A user with no
 *      membership in the selected organization is rejected   → organization_membership_missing
 * Never touches organization_id, XP, access, Learning Path, or any other system.
 */
export async function curateMembershipIdentity(
  admin: SupabaseClient,
  input: CurateIdentityInput,
): Promise<CurateIdentityResult> {
  // 1. Pure domain rules.
  const validation = validateIdentityCuration(
    {
      jobFamilyKey: input.jobFamilyKey,
      primaryRoleKey: input.primaryRoleKey,
      roleStartedOn: input.roleStartedOn,
    },
    input.todayISO,
  );
  if (!validation.ok) return { ok: false, reason: validation.reason };

  // 2. Submitted organization must be manageable (in scope).
  const manageable = await resolveManageableOrganizations(admin, input.changedBy);
  const manageableIds = new Set(manageable.map((o) => o.id));
  if (!manageableIds.has(input.organizationId)) {
    return { ok: false, reason: "organization_not_manageable" };
  }

  // 3. Resolve the target USER privately from the clicked (anchor) membership, and confirm
  //    the admin manages that member. The raw user_id never reaches the browser.
  const { data: anchor } = await admin
    .from("bty_org_memberships")
    .select("id, user_id, organization_id")
    .eq("id", input.membershipId)
    .maybeSingle<{ id: string; user_id: string; organization_id: string }>();
  if (!anchor) return { ok: false, reason: "membership_not_found" };
  if (!manageableIds.has(anchor.organization_id)) {
    return { ok: false, reason: "member_out_of_scope" };
  }

  // 4. Atomic curation of the user's EXISTING membership in the selected org + primary
  //    (re)designation via the SECURITY DEFINER RPC. organization_id is never changed.
  const { data, error } = await admin.rpc("bty_curate_membership_identity", {
    p_user_id: anchor.user_id,
    p_organization_id: input.organizationId,
    p_job_family_key: input.jobFamilyKey,
    p_primary_role_key: input.primaryRoleKey,
    p_role_started_on: input.roleStartedOn,
    p_changed_by: input.changedBy,
  });

  if (error) {
    const msg = error.message ?? "";
    if (/organization_membership_missing/.test(msg)) return { ok: false, reason: "organization_membership_missing" };
    // Target exists but is not active — never curated, never promoted.
    if (/organization_membership_inactive/.test(msg)) return { ok: false, reason: "organization_membership_inactive" };
    // Lost a concurrent single-primary race (one-active-primary unique index). Nothing
    // was persisted by the losing transaction; the admin may simply retry.
    if (/primary_membership_conflict/.test(msg)) return { ok: false, reason: "primary_membership_conflict" };
    if (/role_date_future/.test(msg)) return { ok: false, reason: "role_date_in_future" };
    if (/family_role_compat/.test(msg)) return { ok: false, reason: "incompatible" };
    return { ok: false, reason: "write_failed", detail: msg };
  }

  const row = (Array.isArray(data) ? data[0] : data) as
    | {
        prev_organization_id: string | null;
        prev_job_family_key: string | null;
        prev_primary_role_key: string | null;
        prev_role_started_on: string | null;
        prev_is_primary: boolean | null;
        new_organization_id: string | null;
        new_job_family_key: string | null;
        new_primary_role_key: string | null;
        new_role_started_on: string | null;
        new_is_primary: boolean | null;
      }
    | undefined;
  if (!row) return { ok: false, reason: "write_failed", detail: "rpc returned no row" };

  return {
    ok: true,
    before: {
      organizationId: row.prev_organization_id,
      jobFamilyKey: row.prev_job_family_key,
      primaryRoleKey: row.prev_primary_role_key,
      roleStartedOn: row.prev_role_started_on,
      isPrimary: row.prev_is_primary,
    },
    after: {
      organizationId: row.new_organization_id,
      jobFamilyKey: row.new_job_family_key,
      primaryRoleKey: row.new_primary_role_key,
      roleStartedOn: row.new_role_started_on,
      isPrimary: row.new_is_primary,
    },
  };
}
