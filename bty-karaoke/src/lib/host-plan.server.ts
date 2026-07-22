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
