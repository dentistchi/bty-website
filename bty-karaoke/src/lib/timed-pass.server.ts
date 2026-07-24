// Timed Access Pass Foundation V1 (BUILD 17) — the service layer over
// timed_access_pass_grants. This is the ONE place the app reads/writes passes; routes call
// these helpers, never the table or RPCs directly. Every mutation goes through an atomic,
// idempotency-keyed, audited RPC.
//
// Invariants honored here (all DB-enforced):
//   * a pass belongs to the canonical account; issuance/selection/revocation never touch
//     karaoke_host_plan_assignments (no second plan authority);
//   * at most one SELECTED and one ACTIVE pass per account (partial unique indexes);
//   * ACTIVATION is NOT here — it happens only inside karaoke_begin_song when the first
//     song's lifecycle transition commits;
//   * effective entitlement (PRO > TIMED_ACCESS > FREE) is computed by the server
//     (karaoke_timed_pass_state_at) and projected by the pure domain module.
//
// Privacy: nothing here returns an email, provider subject, OAuth/session token, or
// billing id. Manager labels are derived from Room names (or a masked id) by the caller.

import { karaokeDb } from './supabase.server';
import { parseTimedPassState, type PassType, type PassStatus, type TimedPassState } from '@/domain/timed-pass';

// ── State read (effective entitlement + active/selected projection) ──────────

/** Server-truth pass state for an account (base plan + effective entitlement + passes). */
export async function readTimedPassState(accountId: string): Promise<TimedPassState | null> {
  const { data, error } = await karaokeDb().rpc('karaoke_timed_pass_state', { p_account_id: accountId });
  if (error) throw error;
  return parseTimedPassState(data);
}

// ── Inventory / history (read-only) ──────────────────────────────────────────

export interface TimedPassGrantView {
  id: string;
  passType: PassType;
  durationSeconds: number;
  status: PassStatus;
  issueReason: string | null;
  selectedAt: string | null;
  activatedAt: string | null;
  expiresAt: string | null;
  expiredAt: string | null;
  revokedAt: string | null;
  revokeReason: string | null;
  createdAt: string;
}

export interface TimedPassAuditView {
  action: string;
  actorType: string;
  fromStatus: string | null;
  toStatus: string | null;
  reason: string | null;
  createdAt: string;
}

const GRANT_COLS =
  'id, account_id, pass_type, duration_seconds, status, issue_reason, selected_at, activated_at, expires_at, expired_at, revoked_at, revoke_reason, created_at';
const AUDIT_COLS = 'action, actor_type, from_status, to_status, reason, created_at';

interface GrantRow {
  id: string;
  account_id: string;
  pass_type: string;
  duration_seconds: number;
  status: string;
  issue_reason: string | null;
  selected_at: string | null;
  activated_at: string | null;
  expires_at: string | null;
  expired_at: string | null;
  revoked_at: string | null;
  revoke_reason: string | null;
  created_at: string;
}

function toGrantView(r: GrantRow): TimedPassGrantView {
  return {
    id: r.id,
    passType: r.pass_type as PassType,
    durationSeconds: r.duration_seconds,
    status: r.status as PassStatus,
    issueReason: r.issue_reason,
    selectedAt: r.selected_at,
    activatedAt: r.activated_at,
    expiresAt: r.expires_at,
    expiredAt: r.expired_at,
    revokedAt: r.revoked_at,
    revokeReason: r.revoke_reason,
    createdAt: r.created_at,
  };
}

/** All of an account's pass grants, newest first (Host inventory + Manager account view). */
export async function listAccountTimedPasses(accountId: string): Promise<TimedPassGrantView[]> {
  const { data, error } = await karaokeDb()
    .from('timed_access_pass_grants')
    .select(GRANT_COLS)
    .eq('account_id', accountId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as GrantRow[]).map(toGrantView);
}

/** An account's pass audit history, newest first (Manager audit view). */
export async function listAccountTimedPassAudit(accountId: string): Promise<TimedPassAuditView[]> {
  const { data, error } = await karaokeDb()
    .from('timed_access_pass_audit')
    .select(AUDIT_COLS)
    .eq('account_id', accountId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
    action: String(r.action),
    actorType: String(r.actor_type),
    fromStatus: r.from_status == null ? null : String(r.from_status),
    toStatus: r.to_status == null ? null : String(r.to_status),
    reason: r.reason == null ? null : String(r.reason),
    createdAt: String(r.created_at),
  }));
}

/** The Host's own view: effective state + full inventory (for GET my timed pass inventory). */
export async function getHostTimedPassInventory(
  accountId: string,
): Promise<{ state: TimedPassState | null; passes: TimedPassGrantView[] }> {
  const [state, passes] = await Promise.all([readTimedPassState(accountId), listAccountTimedPasses(accountId)]);
  return { state, passes };
}

// ── Mutations (atomic, idempotent, audited RPCs) ─────────────────────────────

export type IssueTimedPassError =
  | 'invalid_pass_type'
  | 'idempotency_key_required'
  | 'account_not_found'
  | 'account_is_pro';
export type IssueTimedPassOutcome =
  | { ok: true; passGrantId: string; passType: PassType; status: PassStatus; reused: boolean }
  | { ok: false; error: IssueTimedPassError };

/** Manager issues a fixed-duration pass to a canonical account. Never changes the plan. */
export async function issueTimedPass(input: {
  accountId: string;
  passType: PassType;
  reason: string | null;
  idempotencyKey: string;
  managerActor?: string;
}): Promise<IssueTimedPassOutcome> {
  const { data, error } = await karaokeDb().rpc('issue_timed_access_pass', {
    p_account_id: input.accountId,
    p_pass_type: input.passType,
    p_reason: input.reason,
    p_idempotency_key: input.idempotencyKey,
    p_manager_actor: input.managerActor ?? 'bty_mgr',
  });
  if (error) throw error;
  const row = (data ?? {}) as Record<string, unknown>;
  if (row.ok === false) {
    return { ok: false, error: String(row.error ?? 'account_not_found') as IssueTimedPassError };
  }
  return {
    ok: true,
    passGrantId: String(row.passGrantId),
    passType: String(row.passType) as PassType,
    status: String(row.status) as PassStatus,
    reused: row.reused === true,
  };
}

export type SelectTimedPassError = 'pass_not_found' | 'not_selectable';
export type SelectTimedPassOutcome =
  | { ok: true; passGrantId: string; status: PassStatus; changed: boolean }
  | { ok: false; error: SelectTimedPassError; status?: PassStatus };

/**
 * Host selects an AVAILABLE pass (any prior SELECTED reverts to AVAILABLE). Selection sets
 * NO activated_at — the clock starts only at the first successful start.
 */
export async function selectTimedPass(input: {
  accountId: string;
  passGrantId: string;
  idempotencyKey?: string | null;
}): Promise<SelectTimedPassOutcome> {
  const { data, error } = await karaokeDb().rpc('select_timed_access_pass', {
    p_account_id: input.accountId,
    p_pass_grant_id: input.passGrantId,
    p_idempotency_key: input.idempotencyKey ?? null,
  });
  if (error) throw error;
  const row = (data ?? {}) as Record<string, unknown>;
  if (row.ok === false) {
    return {
      ok: false,
      error: String(row.error ?? 'pass_not_found') as SelectTimedPassError,
      status: row.status ? (String(row.status) as PassStatus) : undefined,
    };
  }
  return { ok: true, passGrantId: String(row.passGrantId), status: String(row.status) as PassStatus, changed: row.changed === true };
}

export type RevokeTimedPassError = 'pass_not_found' | 'not_revocable' | 'idempotency_key_required';
export type RevokeTimedPassOutcome =
  | { ok: true; passGrantId: string; status: PassStatus; replayed: boolean }
  | { ok: false; error: RevokeTimedPassError; status?: PassStatus };

/** Manager revokes an UNUSED (AVAILABLE/SELECTED) pass. Never an ACTIVE one in V1. */
export async function revokeTimedPass(input: {
  passGrantId: string;
  reason: string | null;
  idempotencyKey: string;
  managerActor?: string;
}): Promise<RevokeTimedPassOutcome> {
  const { data, error } = await karaokeDb().rpc('revoke_timed_access_pass', {
    p_pass_grant_id: input.passGrantId,
    p_reason: input.reason,
    p_idempotency_key: input.idempotencyKey,
    p_manager_actor: input.managerActor ?? 'bty_mgr',
  });
  if (error) throw error;
  const row = (data ?? {}) as Record<string, unknown>;
  if (row.ok === false) {
    return {
      ok: false,
      error: String(row.error ?? 'pass_not_found') as RevokeTimedPassError,
      status: row.status ? (String(row.status) as PassStatus) : undefined,
    };
  }
  return { ok: true, passGrantId: String(row.passGrantId), status: String(row.status) as PassStatus, replayed: row.replayed === true };
}
