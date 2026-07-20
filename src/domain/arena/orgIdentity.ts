/**
 * Canonical organization-membership identity taxonomy — domain (pure, Slice 3.1A-1).
 *
 * Stable UPPER_SNAKE authorization keys + the job-family ↔ primary-role compatibility
 * rule. These keys are the AUTHORIZATION identifiers, mirrored by the DB CHECK
 * constraints in `20260718000000_bty_org_membership_foundation_v1.sql`. NULL means
 * UNKNOWN — there is deliberately no `UNKNOWN` key.
 *
 * Display labels live OUTSIDE the domain (see `lib/bty/arena/orgIdentityLabels`), so a
 * harmless label change never touches this authorization surface and never becomes a key.
 *
 * Partner / Clinical Director / Trainer / Lead are NOT primary roles — they are future
 * authority assignments and are intentionally absent here.
 *
 * No DB, no I/O, no providers, no display strings.
 */

// ---------------------------------------------------------------------------
// Job families
// ---------------------------------------------------------------------------

export type JobFamilyKey =
  | "CLINICAL_PROVIDER"
  | "CLINICAL_SUPPORT"
  | "FRONT_OFFICE_ADMIN"
  | "OFFICE_MANAGEMENT"
  | "REGIONAL_OPERATIONS"
  | "ENTERPRISE_OPERATIONS"
  | "SHARED_SERVICES";

export const JOB_FAMILY_KEYS: readonly JobFamilyKey[] = [
  "CLINICAL_PROVIDER",
  "CLINICAL_SUPPORT",
  "FRONT_OFFICE_ADMIN",
  "OFFICE_MANAGEMENT",
  "REGIONAL_OPERATIONS",
  "ENTERPRISE_OPERATIONS",
  "SHARED_SERVICES",
];

// ---------------------------------------------------------------------------
// Primary roles (exactly one per membership)
// ---------------------------------------------------------------------------

export type PrimaryRoleKey =
  | "GENERAL_DENTIST"
  | "ORTHODONTIST"
  | "DENTAL_ASSISTANT"
  | "OFFICE_ADMIN"
  | "OFFICE_MANAGER"
  | "AREA_MANAGER"
  | "STATE_REGIONAL_DIRECTOR"
  | "DSO_OPERATIONS_MEMBER"
  | "SSO_SUPPORT_SPECIALIST"
  | "SSO_IT"
  | "SSO_HR";

export const PRIMARY_ROLE_KEYS: readonly PrimaryRoleKey[] = [
  "GENERAL_DENTIST",
  "ORTHODONTIST",
  "DENTAL_ASSISTANT",
  "OFFICE_ADMIN",
  "OFFICE_MANAGER",
  "AREA_MANAGER",
  "STATE_REGIONAL_DIRECTOR",
  "DSO_OPERATIONS_MEMBER",
  "SSO_SUPPORT_SPECIALIST",
  "SSO_IT",
  "SSO_HR",
];

/**
 * The single allowed job family for each primary role. A role belongs to exactly one
 * family; a membership whose (family, role) pair disagrees with this map is invalid.
 */
export const ROLE_TO_FAMILY: Readonly<Record<PrimaryRoleKey, JobFamilyKey>> = {
  GENERAL_DENTIST: "CLINICAL_PROVIDER",
  ORTHODONTIST: "CLINICAL_PROVIDER",
  DENTAL_ASSISTANT: "CLINICAL_SUPPORT",
  OFFICE_ADMIN: "FRONT_OFFICE_ADMIN",
  OFFICE_MANAGER: "OFFICE_MANAGEMENT",
  AREA_MANAGER: "REGIONAL_OPERATIONS",
  STATE_REGIONAL_DIRECTOR: "REGIONAL_OPERATIONS",
  DSO_OPERATIONS_MEMBER: "ENTERPRISE_OPERATIONS",
  SSO_SUPPORT_SPECIALIST: "SHARED_SERVICES",
  SSO_IT: "SHARED_SERVICES",
  SSO_HR: "SHARED_SERVICES",
};

// ---------------------------------------------------------------------------
// Membership status + identity provenance
// ---------------------------------------------------------------------------

export type MembershipStatus = "active" | "inactive";
export const MEMBERSHIP_STATUSES: readonly MembershipStatus[] = ["active", "inactive"];

/** How a canonical membership row came to exist. Bounded, stable keys. */
export type IdentitySource = "legacy_approved_request" | "membership_approval" | "admin_curated";
export const IDENTITY_SOURCES: readonly IdentitySource[] = [
  "legacy_approved_request",
  "membership_approval",
  "admin_curated",
];

// ---------------------------------------------------------------------------
// Validators
// ---------------------------------------------------------------------------

export function isJobFamilyKey(v: unknown): v is JobFamilyKey {
  return typeof v === "string" && (JOB_FAMILY_KEYS as readonly string[]).includes(v);
}

export function isPrimaryRoleKey(v: unknown): v is PrimaryRoleKey {
  return typeof v === "string" && (PRIMARY_ROLE_KEYS as readonly string[]).includes(v);
}

export function isIdentitySource(v: unknown): v is IdentitySource {
  return typeof v === "string" && (IDENTITY_SOURCES as readonly string[]).includes(v);
}

export function isMembershipStatus(v: unknown): v is MembershipStatus {
  return typeof v === "string" && (MEMBERSHIP_STATUSES as readonly string[]).includes(v);
}

/** The canonical family for a role, or null if the role is unknown. */
export function familyForRole(role: unknown): JobFamilyKey | null {
  return isPrimaryRoleKey(role) ? ROLE_TO_FAMILY[role] : null;
}

/**
 * Whether a (job_family, primary_role) pair is coherent. UNKNOWN (null/undefined) on
 * EITHER side is permitted — this slice never guesses identity, so a partially-known
 * pair is valid. Only a fully-specified pair that disagrees with ROLE_TO_FAMILY is
 * rejected. This is the application-level rule the DB CHECK cannot express (the DB
 * validates key membership; this validates the cross-field relationship).
 */
export function isFamilyRoleCompatible(
  family: JobFamilyKey | null | undefined,
  role: PrimaryRoleKey | null | undefined,
): boolean {
  if (family == null || role == null) return true; // unknown side → not a conflict
  if (!isJobFamilyKey(family) || !isPrimaryRoleKey(role)) return false;
  return ROLE_TO_FAMILY[role] === family;
}

// ---------------------------------------------------------------------------
// Curation validation (Slice 3.1A-3) — pure. No Date.now(): "today" is injected
// so the domain stays deterministic and side-effect-free.
// ---------------------------------------------------------------------------

/** A role date is unknown (null) or a real calendar date not later than today. */
export type RoleStartDateError = "not_a_date" | "in_future";

/** A strict `YYYY-MM-DD` string that names a real calendar date. */
export function isCalendarDateString(v: unknown): v is string {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const [y, m, d] = v.split("-").map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  // Reject impossible days (e.g. 2026-02-30) by round-tripping through UTC.
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/**
 * Validate a role start date against an injected `todayISO` (`YYYY-MM-DD`). NULL/undefined
 * (unknown) is always valid — the date is never inferred. Returns null when acceptable,
 * else the specific error. Comparison is lexical, which is correct for zero-padded ISO.
 */
export function roleStartDateError(
  roleStartedOn: string | null | undefined,
  todayISO: string,
): RoleStartDateError | null {
  if (roleStartedOn == null) return null; // unknown stays unknown
  if (!isCalendarDateString(roleStartedOn)) return "not_a_date";
  if (roleStartedOn > todayISO) return "in_future";
  return null;
}

export type CurationValidationError =
  | "invalid_family"
  | "invalid_role"
  | "role_requires_family"
  | "incompatible"
  | "role_date_not_a_date"
  | "role_date_in_future";

/**
 * Full server-authoritative validation of a professional-identity curation payload
 * (pure). Rules:
 *   - job family, if provided, must be a known active key (else invalid_family)
 *   - role, if provided, must be a known active key (else invalid_role)
 *   - a role may not be set without its family (else role_requires_family) — this slice
 *     never derives a family from a role
 *   - a fully-specified (family, role) pair must agree (else incompatible)
 *   - role date is unknown or a real date ≤ today (else role_date_*)
 * Unknown family/role/date are all permitted. Organization scope + existence are checked
 * in the service/RPC (they need DB access); this function is the pure rule core.
 */
export function validateIdentityCuration(
  input: {
    jobFamilyKey?: string | null;
    primaryRoleKey?: string | null;
    roleStartedOn?: string | null;
  },
  todayISO: string,
): { ok: true } | { ok: false; reason: CurationValidationError } {
  const fam = input.jobFamilyKey ?? null;
  const role = input.primaryRoleKey ?? null;

  if (fam !== null && !isJobFamilyKey(fam)) return { ok: false, reason: "invalid_family" };
  if (role !== null && !isPrimaryRoleKey(role)) return { ok: false, reason: "invalid_role" };
  if (role !== null && fam === null) return { ok: false, reason: "role_requires_family" };
  if (!isFamilyRoleCompatible(fam as never, role as never)) return { ok: false, reason: "incompatible" };

  const dateErr = roleStartDateError(input.roleStartedOn, todayISO);
  if (dateErr === "not_a_date") return { ok: false, reason: "role_date_not_a_date" };
  if (dateErr === "in_future") return { ok: false, reason: "role_date_in_future" };

  return { ok: true };
}
