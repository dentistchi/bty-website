// Manager Plan Console + Audit Read View V1 — the PURE vocabulary for the read-only
// operational view. No I/O. This module owns provider summarization, privacy-safe
// masking, and integrity/anomaly classification, so the service and UI never
// re-implement (or disagree on) these rules.
//
// It deliberately does NOT decide plan → capabilities: that stays in `host-plan`
// (the single entitlement authority). Here we only OBSERVE and LABEL persisted state.

import { PLAN_CODES } from './host-plan';

/** Which external login methods a canonical account has verified. */
export type ProviderSummary = 'apple' | 'google' | 'apple+google' | 'none';

/**
 * COUNTED integrity anomalies — genuine data problems an operator must see. An
 * ownership-less Host (a real Host who simply hasn't created a Room yet) is NOT here:
 * it is a benign informational state, surfaced separately so it never inflates the
 * anomaly count.
 */
export const ANOMALY_FLAGS = [
  'no_active_assignment', // resolver falls back to FREE, but nothing is persisted
  'multiple_active_assignments', // >1 active — violates the one-active invariant
  'unknown_plan_code', // a stored plan_code outside the FREE/PRO allowlist
  'assignment_without_account', // an assignment whose account_id has no account row
  'audit_unlinked', // an audit row referencing an assignment id that doesn't exist
] as const;
export type AnomalyFlag = (typeof ANOMALY_FLAGS)[number];

/** Collapse a set of provider strings into the four presentable states. */
export function providerSummary(providers: readonly string[]): ProviderSummary {
  const has = (p: string) => providers.includes(p);
  const apple = has('apple');
  const google = has('google');
  if (apple && google) return 'apple+google';
  if (apple) return 'apple';
  if (google) return 'google';
  return 'none';
}

/**
 * Privacy-safe short reference for a UUID — never the full id in the default list.
 * Keeps the head (enough to correlate) and a short tail, e.g.
 * `1a0be5e8…9a8c`. Non-UUID / short inputs pass through unchanged-ish.
 */
export function maskId(id: string | null | undefined): string {
  if (!id) return '—';
  if (id.length <= 14) return id;
  return `${id.slice(0, 8)}…${id.slice(-4)}`;
}

/** Mask an idempotency key: show the descriptive head + short tail only. */
export function maskIdempotencyKey(key: string | null | undefined): string {
  if (!key) return '—';
  if (key.length <= 18) return key;
  return `${key.slice(0, 14)}…${key.slice(-4)}`;
}

/** The actor behind an audit change, privacy-safe: masked id, or "system" when null. */
export function changedByRef(accountId: string | null | undefined): string {
  return accountId ? maskId(accountId) : 'system';
}

/** True iff a stored plan_code is outside the closed FREE/PRO allowlist. */
export function isUnknownPlanCode(code: string): boolean {
  return !(PLAN_CODES as readonly string[]).includes(code);
}

export interface AccountIntegrityInput {
  /** Whether the canonical account row actually exists. */
  accountExists: boolean;
  /** Plan codes of this account's ACTIVE assignments (length = active count). */
  activePlanCodes: string[];
  /** Plan codes across ALL of this account's assignments (active + ended). */
  allPlanCodes: string[];
  /** How many of this account's audit rows reference a missing assignment id. */
  auditLinkIssues: number;
}

/**
 * Classify an account's persisted plan state into the counted anomaly flags. Pure and
 * total — an integrity-clean account returns `[]`. Ownership is intentionally not an
 * input here (see ANOMALY_FLAGS note).
 */
export function detectAnomalies(input: AccountIntegrityInput): AnomalyFlag[] {
  const flags: AnomalyFlag[] = [];
  if (!input.accountExists) flags.push('assignment_without_account');
  if (input.activePlanCodes.length === 0) flags.push('no_active_assignment');
  if (input.activePlanCodes.length > 1) flags.push('multiple_active_assignments');
  if (input.allPlanCodes.some(isUnknownPlanCode)) flags.push('unknown_plan_code');
  if (input.auditLinkIssues > 0) flags.push('audit_unlinked');
  return flags;
}

/**
 * BUILD R4-R1 — the lifecycle state of the canonical account row.
 *
 * An UNKNOWN or ABSENT value normalizes to `active`, deliberately. The console's job is to show
 * an operator every account that might need them; defaulting an unreadable status to `deleted`
 * would HIDE a row, and a hidden row is the one failure mode this surface must not have.
 */
export type AccountStatus = 'active' | 'deleted';

export function normalizeAccountStatus(raw: unknown): AccountStatus {
  return raw === 'deleted' ? 'deleted' : 'active';
}

/**
 * Narrow the observed anomalies to the ones an operator can actually ACT on.
 *
 * `no_active_assignment` on a DELETED account is not a defect — it is the deletion contract
 * working: BUILD 26E ends the active assignment when it tombstones the account. Counting it as an
 * anomaly is what made production report "13 anomalies" when 12 of them were correct behaviour,
 * and a number that cries wolf twelve times out of thirteen trains an operator to ignore it.
 *
 * EVERY OTHER FLAG SURVIVES DELETION, because each is a genuine integrity fault that a tombstone
 * does not explain: two active assignments, a plan code outside the allowlist, an assignment with
 * no account row, an audit row pointing at an assignment that does not exist. Those stay visible
 * on a deleted row too — this function removes an expected state, never an actionable one.
 */
export function actionableAnomalies(
  status: AccountStatus,
  anomalies: readonly AnomalyFlag[],
): AnomalyFlag[] {
  if (status !== 'deleted') return [...anomalies];
  return anomalies.filter((a) => a !== 'no_active_assignment');
}

/** Human-facing anomaly labels (English admin surface). */
export const ANOMALY_LABEL: Record<AnomalyFlag, string> = {
  no_active_assignment: 'No persisted active assignment',
  multiple_active_assignments: 'Multiple active assignments',
  unknown_plan_code: 'Unknown plan code',
  assignment_without_account: 'Assignment without account',
  audit_unlinked: 'Audit not linked to an assignment',
};
