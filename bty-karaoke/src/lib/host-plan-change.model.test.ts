// PRO Pilot Assignment + Plan Lifecycle V1 — the change_karaoke_host_plan RPC
// semantics proved BEHAVIOURALLY against a faithful in-memory model of the real
// transaction. There is no live Postgres in unit tests, so this reducer mirrors the
// RPC step for step (advisory lock → account check → idempotency replay → lock active
// → no-op guard → end+insert+audit atomically) and the migration schema test
// (host-plan-change-migration.schema.test.ts) pins that the SQL actually implements
// each rule. Together they cover the data/transaction requirements (1–12).

import { describe, it, expect, beforeEach } from 'vitest';
import { decidePlanChange } from '@/domain/host-plan';

type PlanCode = 'FREE' | 'PRO';

interface Assignment {
  id: string;
  account_id: string;
  plan_code: PlanCode;
  source: string;
  status: 'active' | 'ended';
  ended_at: string | null;
}
interface AuditRow {
  id: string;
  account_id: string;
  previous_plan: PlanCode | null;
  new_plan: PlanCode;
  previous_assignment_id: string | null;
  new_assignment_id: string;
  source: string;
  reason: string;
  idempotency_key: string;
}

// A faithful model of the DB + the RPC. `failBeforeAudit` injects a failure AFTER the
// end+insert but BEFORE the audit write to prove the whole change rolls back.
class PlanDb {
  accounts = new Set<string>();
  assignments: Assignment[] = [];
  audit: AuditRow[] = [];
  private seq = 0;

  seedAccount(id: string, plan: PlanCode = 'FREE') {
    this.accounts.add(id);
    this.assignments.push({
      id: `a${++this.seq}`,
      account_id: id,
      plan_code: plan,
      source: 'SYSTEM_DEFAULT',
      status: 'active',
      ended_at: null,
    });
  }

  activeFor(accountId: string) {
    return this.assignments.filter((a) => a.account_id === accountId && a.status === 'active');
  }

  // Mirrors change_karaoke_host_plan(...). Throws on rejection/invariant breach; the
  // caller's try/catch models the transaction boundary (all-or-nothing).
  change(
    accountId: string,
    planCode: PlanCode,
    opts: { reason: string; key: string; source?: string; failBeforeAudit?: boolean },
  ): { ok: false; error: string } | { ok: true; changed: boolean; replayed?: boolean; previousPlan: PlanCode | null; currentPlan: PlanCode } {
    const source = opts.source ?? 'MANUAL';
    // vocabulary validation (defense in depth)
    if (planCode !== 'FREE' && planCode !== 'PRO') return { ok: false, error: 'invalid_plan_code' };
    if (!['SYSTEM_DEFAULT', 'MANUAL', 'BILLING'].includes(source)) return { ok: false, error: 'invalid_source' };
    if (!opts.reason.trim()) return { ok: false, error: 'reason_required' };
    if (!opts.key.trim()) return { ok: false, error: 'idempotency_key_required' };

    // account existence
    if (!this.accounts.has(accountId)) return { ok: false, error: 'account_not_found' };

    // replay safety: a processed key returns its recorded outcome, writes nothing
    const prior = this.audit.find((r) => r.idempotency_key === opts.key.trim());
    if (prior) {
      return { ok: true, changed: true, replayed: true, previousPlan: prior.previous_plan, currentPlan: prior.new_plan };
    }

    const active = this.activeFor(accountId)[0] ?? null;
    const decision = decidePlanChange(active ? active.plan_code : null, planCode);
    if (decision.kind === 'noop') {
      return { ok: true, changed: false, previousPlan: active!.plan_code, currentPlan: planCode };
    }

    // --- transaction begins: snapshot for rollback ---
    const snapAssign = this.assignments.map((a) => ({ ...a }));
    const snapAudit = this.audit.map((r) => ({ ...r }));
    try {
      if (active) {
        active.status = 'ended';
        active.ended_at = '2026-07-23T00:00:00Z';
      }
      const newRow: Assignment = {
        id: `a${++this.seq}`,
        account_id: accountId,
        plan_code: planCode,
        source,
        status: 'active',
        ended_at: null,
      };
      // enforce the partial unique index (one active per account)
      if (this.activeFor(accountId).length > 0) throw Object.assign(new Error('dup'), { code: '23505' });
      this.assignments.push(newRow);

      if (opts.failBeforeAudit) throw new Error('injected failure before audit');

      // enforce the unique idempotency key
      if (this.audit.some((r) => r.idempotency_key === opts.key.trim())) {
        throw Object.assign(new Error('dup key'), { code: '23505' });
      }
      this.audit.push({
        id: `u${++this.seq}`,
        account_id: accountId,
        previous_plan: active ? active.plan_code : null,
        new_plan: planCode,
        previous_assignment_id: active ? active.id : null,
        new_assignment_id: newRow.id,
        source,
        reason: opts.reason.trim(),
        idempotency_key: opts.key.trim(),
      });
      return { ok: true, changed: true, previousPlan: active ? active.plan_code : null, currentPlan: planCode };
    } catch (e) {
      // rollback the whole transaction
      this.assignments = snapAssign;
      this.audit = snapAudit;
      throw e;
    }
  }
}

let db: PlanDb;
beforeEach(() => {
  db = new PlanDb();
});

describe('change_karaoke_host_plan — transaction semantics (1–12)', () => {
  it('(1/2) FREE → PRO ends the FREE row and creates exactly one active PRO row', () => {
    db.seedAccount('acct', 'FREE');
    const res = db.change('acct', 'PRO', { reason: 'pilot', key: 'k1' });
    expect(res).toMatchObject({ ok: true, changed: true, previousPlan: 'FREE', currentPlan: 'PRO' });
    const active = db.activeFor('acct');
    expect(active).toHaveLength(1);
    expect(active[0].plan_code).toBe('PRO');
    const free = db.assignments.find((a) => a.plan_code === 'FREE')!;
    expect(free.status).toBe('ended');
    expect(free.ended_at).not.toBeNull();
  });

  it('(3) PRO → FREE downgrade works the same way', () => {
    db.seedAccount('acct', 'FREE');
    db.change('acct', 'PRO', { reason: 'up', key: 'k1' });
    const res = db.change('acct', 'FREE', { reason: 'down', key: 'k2' });
    expect(res).toMatchObject({ ok: true, changed: true, previousPlan: 'PRO', currentPlan: 'FREE' });
    expect(db.activeFor('acct')).toHaveLength(1);
    expect(db.activeFor('acct')[0].plan_code).toBe('FREE');
  });

  it('(4) there is always exactly one active assignment through a full lifecycle', () => {
    db.seedAccount('acct', 'FREE');
    expect(db.activeFor('acct')).toHaveLength(1);
    db.change('acct', 'PRO', { reason: 'a', key: 'k1' });
    expect(db.activeFor('acct')).toHaveLength(1);
    db.change('acct', 'FREE', { reason: 'b', key: 'k2' });
    expect(db.activeFor('acct')).toHaveLength(1);
  });

  it('(5) a mid-change failure rolls the WHOLE transaction back (no 0/2 active, no audit)', () => {
    db.seedAccount('acct', 'FREE');
    expect(() => db.change('acct', 'PRO', { reason: 'x', key: 'k1', failBeforeAudit: true })).toThrow();
    const active = db.activeFor('acct');
    expect(active).toHaveLength(1); // still exactly one
    expect(active[0].plan_code).toBe('FREE'); // still FREE — nothing partial survived
    expect(db.audit).toHaveLength(0);
  });

  it('(6) a same-plan re-request is a no-op', () => {
    db.seedAccount('acct', 'FREE');
    const res = db.change('acct', 'FREE', { reason: 'noop', key: 'k1' });
    expect(res).toMatchObject({ ok: true, changed: false, currentPlan: 'FREE' });
    expect(db.activeFor('acct')).toHaveLength(1);
  });

  it('(7) a no-op writes NO audit row', () => {
    db.seedAccount('acct', 'FREE');
    db.change('acct', 'FREE', { reason: 'noop', key: 'k1' });
    expect(db.audit).toHaveLength(0);
  });

  it('(8) a real change writes exactly one audit row with full before/after', () => {
    db.seedAccount('acct', 'FREE');
    db.change('acct', 'PRO', { reason: 'commander pilot', key: 'k1' });
    expect(db.audit).toHaveLength(1);
    expect(db.audit[0]).toMatchObject({
      account_id: 'acct',
      previous_plan: 'FREE',
      new_plan: 'PRO',
      source: 'MANUAL',
      reason: 'commander pilot',
      idempotency_key: 'k1',
    });
    expect(db.audit[0].previous_assignment_id).not.toBeNull();
    expect(db.audit[0].new_assignment_id).toBeTruthy();
  });

  it('(9) an invalid plan code is rejected', () => {
    db.seedAccount('acct', 'FREE');
    // @ts-expect-error — deliberately invalid
    expect(db.change('acct', 'ENTERPRISE', { reason: 'x', key: 'k1' })).toEqual({ ok: false, error: 'invalid_plan_code' });
    expect(db.audit).toHaveLength(0);
  });

  it('(10) a non-existent account is rejected (no assignment/audit created)', () => {
    expect(db.change('ghost', 'PRO', { reason: 'x', key: 'k1' })).toEqual({ ok: false, error: 'account_not_found' });
    expect(db.assignments).toHaveLength(0);
    expect(db.audit).toHaveLength(0);
  });

  it('(11) audit is append-only: existing rows are never rewritten by later changes', () => {
    db.seedAccount('acct', 'FREE');
    db.change('acct', 'PRO', { reason: 'up', key: 'k1' });
    const firstAudit = { ...db.audit[0] };
    db.change('acct', 'FREE', { reason: 'down', key: 'k2' });
    expect(db.audit).toHaveLength(2);
    expect(db.audit[0]).toEqual(firstAudit); // untouched — append, never update
  });

  it('(12) a replayed idempotency key never creates a second active plan or audit row', () => {
    db.seedAccount('acct', 'FREE');
    const first = db.change('acct', 'PRO', { reason: 'once', key: 'same' });
    const replay = db.change('acct', 'PRO', { reason: 'once', key: 'same' });
    expect(first).toMatchObject({ changed: true, currentPlan: 'PRO' });
    expect(replay).toMatchObject({ ok: true, changed: true, replayed: true, previousPlan: 'FREE', currentPlan: 'PRO' });
    expect(db.activeFor('acct')).toHaveLength(1);
    expect(db.audit).toHaveLength(1); // exactly one — the replay wrote nothing
  });
});
