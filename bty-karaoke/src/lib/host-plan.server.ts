// Host Plan + Entitlement Foundation V1 — the service layer over
// karaoke_host_plan_assignments. This is the ONE place the app reads a Host's plan;
// routes and components must call resolveNorebangHostEntitlements(), never query the
// table or re-derive plan rules themselves.
//
// Invariants honored here (DB-enforced by the partial unique index on active rows):
//   * at most one ACTIVE assignment per account;
//   * a missing active assignment is a safe FREE fallback (never a paid promotion),
//     left observable via a privacy-safe diagnostic (opaque account id only);
//   * default provisioning is idempotent — it creates the single FREE row once and
//     is a no-op forever after, so repeated logins never accumulate assignments.

import { karaokeDb } from './supabase.server';
import {
  capabilitiesForPlan,
  normalizePlanCode,
  isPlanSource,
  DEFAULT_PLAN_CODE,
  type HostEntitlements,
  type PlanCode,
  type PlanSource,
} from '@/domain/host-plan';

const ASSIGNMENT_COLS = 'id, account_id, plan_code, source, status, started_at, ended_at';

interface PlanAssignmentRow {
  id: string;
  account_id: string;
  plan_code: string;
  source: string;
  status: string;
  started_at: string;
  ended_at: string | null;
}

/** The account's single ACTIVE assignment, or null when none exists. */
export async function getActivePlanAssignment(accountId: string): Promise<PlanAssignmentRow | null> {
  const { data, error } = await karaokeDb()
    .from('karaoke_host_plan_assignments')
    .select(ASSIGNMENT_COLS)
    .eq('account_id', accountId)
    .eq('status', 'active')
    .maybeSingle();
  if (error) throw error;
  return (data as PlanAssignmentRow | null) ?? null;
}

/**
 * Guarantee this account has exactly one active FREE assignment. Idempotent: does
 * nothing if an active assignment already exists, so it is safe to call on every
 * account creation without ever accumulating duplicates (the partial unique index
 * is the backstop under concurrency).
 *
 * NON-FATAL by design: plan provisioning must never break sign-in. On any failure
 * it logs a privacy-safe diagnostic and returns — the resolver's FREE fallback keeps
 * the Host fully functional, and the next login retries.
 */
export async function ensureDefaultFreePlan(accountId: string): Promise<void> {
  try {
    const existing = await getActivePlanAssignment(accountId);
    if (existing) return;

    const { error } = await karaokeDb()
      .from('karaoke_host_plan_assignments')
      .insert({ account_id: accountId, plan_code: 'FREE', source: 'SYSTEM_DEFAULT', status: 'active' });
    if (error) {
      // 23505 = a concurrent login/backfill already created the one active row.
      // That is success, not failure — the invariant holds.
      if ((error as { code?: string }).code === '23505') return;
      throw error;
    }
  } catch (e) {
    console.warn('[host-plan] ensureDefaultFreePlan failed; login proceeds, resolver falls back to FREE', {
      accountId,
      code: (e as { code?: string })?.code ?? null,
    });
  }
}

/**
 * THE entitlement resolver. Given a canonical account id, return its plan and the
 * capability map the app renders/enforces from. An account with no active
 * assignment resolves to FREE (safe default) — NEVER to a paid plan — with a
 * diagnostic so the anomaly is observable.
 *
 * Callers pass an account id derived server-side from the authenticated session;
 * one account can never read another's plan because it can never present another's
 * session.
 */
export async function resolveNorebangHostEntitlements(accountId: string): Promise<HostEntitlements> {
  const active = await getActivePlanAssignment(accountId);

  if (!active) {
    console.warn('[host-plan] no active plan assignment; defaulting to FREE (no paid promotion)', {
      accountId,
    });
    return {
      planCode: DEFAULT_PLAN_CODE,
      planStatus: 'ACTIVE',
      source: 'SYSTEM_DEFAULT',
      capabilities: capabilitiesForPlan(DEFAULT_PLAN_CODE),
      fallback: true,
    };
  }

  const planCode = normalizePlanCode(active.plan_code);
  return {
    planCode,
    planStatus: 'ACTIVE',
    source: isPlanSource(active.source) ? active.source : 'SYSTEM_DEFAULT',
    capabilities: capabilitiesForPlan(planCode),
    fallback: false,
  };
}

/** A known, non-exceptional rejection the RPC returns as data (never leaks details). */
export type PlanChangeError =
  | 'account_not_found'
  | 'invalid_plan_code'
  | 'invalid_source'
  | 'reason_required'
  | 'idempotency_key_required';

export type PlanChangeOutcome =
  | { ok: true; changed: boolean; replayed: boolean; previousPlan: PlanCode | null; currentPlan: PlanCode }
  | { ok: false; error: PlanChangeError };

export interface ChangeHostPlanInput {
  accountId: string;
  planCode: PlanCode;
  reason: string;
  idempotencyKey: string;
  /** Only MANUAL is used this slice; defaults to MANUAL. */
  source?: PlanSource;
  /** The operator account effecting the change; null for system/service. */
  actorAccountId?: string | null;
}

/**
 * Move a canonical Host account between FREE and PRO through the ATOMIC
 * change_karaoke_host_plan RPC — the single sanctioned mutation path. There is NO
 * client-side table write: end-current + insert-new + append-one-audit happen in one
 * server transaction, so the account is never left with 0 or 2 active assignments.
 *
 * Same-plan requests are a no-op (changed=false, no audit); a replayed idempotency
 * key returns the recorded outcome and writes nothing. Known rejections
 * (unknown account, bad plan/source, empty reason/key) come back as { ok:false } and
 * never expose an email, provider subject, or any credential.
 */
export async function changeNorebangHostPlan(input: ChangeHostPlanInput): Promise<PlanChangeOutcome> {
  const { data, error } = await karaokeDb().rpc('change_karaoke_host_plan', {
    p_account_id: input.accountId,
    p_plan_code: input.planCode,
    p_reason: input.reason,
    p_idempotency_key: input.idempotencyKey,
    p_source: input.source ?? 'MANUAL',
    p_actor_account: input.actorAccountId ?? null,
  });
  if (error) throw error;

  const row = (data ?? {}) as Record<string, unknown>;
  if (row.ok === false) {
    return { ok: false, error: String(row.error ?? 'invalid_plan_code') as PlanChangeError };
  }
  return {
    ok: true,
    changed: row.changed === true,
    replayed: row.replayed === true,
    previousPlan: row.previousPlan == null ? null : normalizePlanCode(row.previousPlan),
    currentPlan: normalizePlanCode(row.currentPlan),
  };
}
