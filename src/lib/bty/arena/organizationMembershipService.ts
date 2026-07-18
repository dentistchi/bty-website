import type { SupabaseClient } from "@supabase/supabase-js";
import { isPrimaryRoleKey, isJobFamilyKey, isFamilyRoleCompatible } from "@/domain/arena/orgIdentity";

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
