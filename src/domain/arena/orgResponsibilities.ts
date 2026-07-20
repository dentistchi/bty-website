/**
 * Leadership responsibility taxonomy — domain (pure, Slice 3.1B-1).
 *
 * A person has ONE primary role but may hold ZERO OR MORE leadership responsibilities
 * at the same time. Responsibilities are therefore a separate 0..n dimension and are
 * NEVER primary roles — see `orgIdentity.ts`, which deliberately excludes them.
 *
 * These are IDENTITY FACTS ONLY. This slice never derives access, audience, learning
 * routing, XP, AIR, readiness, or evaluation from them. Slice 3.1B-2 owns any resolver
 * that reads them; the seam is `listActiveResponsibilityKeys` in the service layer.
 *
 * NAMING — `TEAM_LEAD`, not `LEAD`: `office_assignments.is_lead` is a PRE-EXISTING,
 * office-scoped AUTHORIZATION flag (it narrows office_manager scope in
 * `src/lib/authz-utils.ts`). The two are unrelated concepts, so the canonical key is
 * distinct to make confusing them impossible. `is_lead` is NOT authoritative here, is
 * never read, and is never written by this slice.
 *
 * NOT authoritative for any responsibility (never inferred, never migrated):
 * `arena_membership_requests.leader_started_at` (tenure math),
 * `leadership_engine_state.is_leader_track` (training track),
 * legacy `memberships.job_function` ('leader'/'staff' free text),
 * `certified_leader_grants` (earned, time-boxed certification),
 * `office_assignments.is_lead` (authorization scoping).
 *
 * Display labels live OUTSIDE the domain (`lib/bty/arena/orgResponsibilityLabels`).
 * No DB, no I/O, no display strings.
 */

export type ResponsibilityKey =
  | "PARTNER"
  | "CLINICAL_DIRECTOR"
  | "TRAINER"
  | "TEAM_LEAD"
  | "PEOPLE_MANAGER";

export const RESPONSIBILITY_KEYS: readonly ResponsibilityKey[] = [
  "PARTNER",
  "CLINICAL_DIRECTOR",
  "TRAINER",
  "TEAM_LEAD",
  "PEOPLE_MANAGER",
];

export function isResponsibilityKey(value: unknown): value is ResponsibilityKey {
  return typeof value === "string" && (RESPONSIBILITY_KEYS as readonly string[]).includes(value);
}

/** Mutations an admin may perform on one (membership, responsibility) pair. */
export type ResponsibilityAction = "assign" | "revise_date" | "remove";

export const RESPONSIBILITY_ACTIONS: readonly ResponsibilityAction[] = [
  "assign",
  "revise_date",
  "remove",
];

export function isResponsibilityAction(value: unknown): value is ResponsibilityAction {
  return typeof value === "string" && (RESPONSIBILITY_ACTIONS as readonly string[]).includes(value);
}

/**
 * THE canonical leader definition (Slice 3.1B-2) — the ONLY place "is this member a
 * leader?" is decided. Deliberately lives beside the responsibility taxonomy that owns the
 * facts, so Foundry (or any future consumer) reads this rather than growing a second
 * leadership identity system.
 *
 * A member is a leader iff they hold AT LEAST ONE active canonical leadership
 * responsibility on the membership being asked about. Nothing else qualifies — not
 * primary_role, job_family, is_leader_track, leader_started_at, office_assignments.is_lead,
 * legacy job_function, Certified Leader grants, tenure, title text, XP, or activity.
 *
 * Scope is the caller's responsibility in the sense that the keys passed in MUST come from
 * ONE membership (one user in one organization). A responsibility held in Organization A
 * therefore cannot make the member a leader in Organization B, because those are different
 * memberships and produce different key sets.
 *
 * ELIGIBILITY, NOT AUTHORIZATION. Leader status never grants admin access, office scope,
 * Foundry Host rights, member-curation rights, or cross-organization reach.
 */
export type CanonicalLeaderStatus = {
  isLeader: boolean;
  matchedResponsibilityKeys: ResponsibilityKey[];
};

export function resolveCanonicalLeaderStatus(input: {
  activeResponsibilityKeys: readonly string[];
}): CanonicalLeaderStatus {
  // Only canonical keys count; anything unrecognized (legacy signal, free text, a removed
  // row's key that a caller passed by mistake) is ignored rather than trusted.
  const matched: ResponsibilityKey[] = [];
  for (const key of input.activeResponsibilityKeys) {
    if (isResponsibilityKey(key) && !matched.includes(key)) matched.push(key);
  }
  return { isLeader: matched.length > 0, matchedResponsibilityKeys: matched };
}

export type ResponsibilityValidationError =
  | "invalid_responsibility"
  | "invalid_action"
  | "start_date_not_a_date"
  | "start_date_in_future";

export type ResponsibilityValidationResult =
  | { ok: true }
  | { ok: false; reason: ResponsibilityValidationError };

/** Strict `YYYY-MM-DD` calendar date — no timezone, no time component. */
export function isCalendarDateString(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  // Round-trip guard rejects impossible calendar dates (e.g. 2025-02-30).
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/**
 * Start date rule: NULL is a first-class value meaning UNKNOWN and MUST stay NULL —
 * it is never back-filled or guessed. A known date may not be in the future.
 * `todayISO` is injected so this stays pure (no Date.now in the rule core).
 */
export function responsibilityStartDateError(
  startedOn: string | null,
  todayISO: string,
): ResponsibilityValidationError | null {
  if (startedOn === null) return null; // unknown stays unknown
  if (!isCalendarDateString(startedOn)) return "start_date_not_a_date";
  if (startedOn > todayISO) return "start_date_in_future";
  return null;
}

/**
 * Full pure validation for one responsibility mutation. Order is deliberate: an invalid
 * key or action is rejected before any date reasoning, so an unknown key never reaches
 * the service or the RPC.
 */
export function validateResponsibilityMutation(
  input: {
    responsibilityKey: string | null;
    action: string;
    startedOn: string | null;
  },
  todayISO: string,
): ResponsibilityValidationResult {
  if (!isResponsibilityKey(input.responsibilityKey)) {
    return { ok: false, reason: "invalid_responsibility" };
  }
  if (!isResponsibilityAction(input.action)) {
    return { ok: false, reason: "invalid_action" };
  }
  // A removal carries no date; only assign/revise_date validate one.
  if (input.action !== "remove") {
    const dateError = responsibilityStartDateError(input.startedOn, todayISO);
    if (dateError) return { ok: false, reason: dateError };
  }
  return { ok: true };
}
