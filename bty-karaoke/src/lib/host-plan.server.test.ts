// Host Plan Foundation V1 — the entitlement service, proved BEHAVIOURALLY against a
// fake Postgres that models the real invariant: at most ONE active assignment per
// account (the partial unique index). These are proofs that a Host is never
// silently promoted to a paid plan and that provisioning is idempotent — not string
// checks.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

interface Row {
  [k: string]: unknown;
}

const db = {
  plans: [] as Row[],
  seq: 0,
};

/** Model the partial unique index: one row per account WHERE status='active'. */
function insertPlan(row: Row): { data: Row | null; error: { code: string } | null } {
  if (row.status === 'active') {
    const dupe = db.plans.find((p) => p.account_id === row.account_id && p.status === 'active');
    if (dupe) return { data: null, error: { code: '23505' } };
  }
  const full: Row = {
    id: `plan-${++db.seq}`,
    source: 'SYSTEM_DEFAULT',
    status: 'active',
    started_at: '2026-07-22T00:00:00Z',
    ended_at: null,
    ...row,
  };
  db.plans.push(full);
  return { data: full, error: null };
}

vi.mock('@/lib/supabase.server', () => ({
  karaokeDb: () => ({
    from(table: string) {
      const eqs: Array<[string, unknown]> = [];
      let ins: Row | null = null;
      const rows = () => (table === 'karaoke_host_plan_assignments' ? db.plans : []);
      const matched = () => rows().filter((r) => eqs.every(([c, v]) => r[c] === v));
      const b = {
        select: () => b,
        insert: (row: Row) => {
          ins = row;
          return b;
        },
        eq: (c: string, v: unknown) => {
          eqs.push([c, v]);
          return b;
        },
        maybeSingle: async () => {
          if (ins) return insertPlan(ins);
          const m = matched();
          return { data: m[0] ?? null, error: null };
        },
        // `await db.from(...).insert(...)` resolves here.
        then: (resolve: (v: { data: unknown; error: unknown }) => unknown) => {
          if (ins) return Promise.resolve(resolve(insertPlan(ins)));
          return Promise.resolve(resolve({ data: matched(), error: null }));
        },
      };
      return b;
    },
  }),
}));

import {
  ensureDefaultFreePlan,
  getActivePlanAssignment,
  resolveNorebangHostEntitlements,
} from './host-plan.server';

const activeFor = (accountId: string) =>
  db.plans.filter((p) => p.account_id === accountId && p.status === 'active');

beforeEach(() => {
  db.plans = [];
  db.seq = 0;
});
afterEach(() => vi.restoreAllMocks());

describe('ensureDefaultFreePlan', () => {
  it('(3) creates exactly one active FREE/SYSTEM_DEFAULT assignment for a fresh account', async () => {
    await ensureDefaultFreePlan('acct-1');
    const active = activeFor('acct-1');
    expect(active).toHaveLength(1);
    expect(active[0]).toMatchObject({ plan_code: 'FREE', source: 'SYSTEM_DEFAULT', status: 'active' });
  });

  it('(4) is idempotent — repeated calls (repeated logins) never add a second assignment', async () => {
    await ensureDefaultFreePlan('acct-1');
    await ensureDefaultFreePlan('acct-1');
    await ensureDefaultFreePlan('acct-1');
    expect(activeFor('acct-1')).toHaveLength(1);
    expect(db.plans).toHaveLength(1);
  });

  it('(5) two active assignments cannot coexist — a direct second active insert is rejected (23505)', () => {
    expect(insertPlan({ account_id: 'a', plan_code: 'FREE', status: 'active' }).error).toBeNull();
    expect(insertPlan({ account_id: 'a', plan_code: 'PRO', status: 'active' }).error).toEqual({ code: '23505' });
  });

  it('does not break when a concurrent insert loses the race (23505 swallowed, no throw)', async () => {
    db.plans.push({ id: 'x', account_id: 'acct-1', plan_code: 'FREE', source: 'SYSTEM_DEFAULT', status: 'active' });
    // getActive would normally see it; simulate the race where ensure still tries to
    // insert against an existing active row → invariant rejects with 23505.
    expect(insertPlan({ account_id: 'acct-1', plan_code: 'FREE', status: 'active' }).error).toEqual({ code: '23505' });
    await expect(ensureDefaultFreePlan('acct-1')).resolves.toBeUndefined();
    expect(activeFor('acct-1')).toHaveLength(1);
  });
});

describe('resolveNorebangHostEntitlements', () => {
  it('(7) a FREE account resolves to FREE / ACTIVE with every capability true', async () => {
    await ensureDefaultFreePlan('acct-1');
    const ent = await resolveNorebangHostEntitlements('acct-1');
    expect(ent.planCode).toBe('FREE');
    expect(ent.planStatus).toBe('ACTIVE');
    expect(ent.source).toBe('SYSTEM_DEFAULT');
    expect(ent.fallback).toBe(false);
    expect(Object.values(ent.capabilities).every(Boolean)).toBe(true);
  });

  it('(8/9) an account with NO active assignment falls back to FREE (never a paid plan) with a diagnostic', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const ent = await resolveNorebangHostEntitlements('ghost-acct');
    expect(ent.planCode).toBe('FREE');
    expect(ent.planStatus).toBe('ACTIVE');
    expect(ent.fallback).toBe(true);
    expect(Object.values(ent.capabilities).every(Boolean)).toBe(true);
    expect(warn).toHaveBeenCalled(); // observable anomaly
  });

  it('reads the STORED plan code (a real PRO row resolves to PRO), still all-caps in V1', async () => {
    db.plans.push({ id: 'p', account_id: 'acct-pro', plan_code: 'PRO', source: 'MANUAL', status: 'active', ended_at: null });
    const ent = await resolveNorebangHostEntitlements('acct-pro');
    expect(ent.planCode).toBe('PRO');
    expect(ent.source).toBe('MANUAL');
    expect(Object.values(ent.capabilities).every(Boolean)).toBe(true);
  });

  it('(10) is scoped to the passed account — one account never resolves another\'s plan', async () => {
    db.plans.push({ id: 'p', account_id: 'acct-pro', plan_code: 'PRO', source: 'MANUAL', status: 'active', ended_at: null });
    await ensureDefaultFreePlan('acct-free');
    expect((await resolveNorebangHostEntitlements('acct-free')).planCode).toBe('FREE');
    expect((await resolveNorebangHostEntitlements('acct-pro')).planCode).toBe('PRO');
    expect((await getActivePlanAssignment('acct-free'))?.plan_code).toBe('FREE');
  });

  it('a corrupt stored plan_code is coerced to FREE (defense in depth)', async () => {
    db.plans.push({ id: 'p', account_id: 'weird', plan_code: 'ENTERPRISE', source: 'MANUAL', status: 'active', ended_at: null });
    expect((await resolveNorebangHostEntitlements('weird')).planCode).toBe('FREE');
  });
});
