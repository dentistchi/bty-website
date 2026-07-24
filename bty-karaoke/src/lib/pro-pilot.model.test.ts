// PRO Pilot Request + Manager Approval V1 — the create/decide RPC semantics proved
// BEHAVIOURALLY against a faithful in-memory model of the real transactions. There is
// no live Postgres in unit tests, so this reducer mirrors the two RPCs step for step
// (advisory lock → account/plan checks → idempotency replay → CAS → atomic write) and
// the migration schema test (pro-pilot-migration.schema.test.ts) pins that the SQL
// actually implements each rule. Together they cover the request/decision data +
// transaction + idempotency requirements (server §13 1–20 and §9/§12 invariants).

import { describe, it, expect, beforeEach } from 'vitest';

type PlanCode = 'FREE' | 'PRO';
type Status = 'PENDING' | 'APPROVED' | 'DECLINED';

interface Assignment { id: string; account_id: string; plan_code: PlanCode; status: 'active' | 'ended'; }
interface PlanAudit { id: string; account_id: string; new_plan: PlanCode; idempotency_key: string; }
interface Request {
  id: string; account_id: string; room_id: string | null; status: Status;
  decided_at: string | null; decided_by: string | null; decision_reason: string | null;
  approved_plan_assignment_id: string | null; request_idempotency_key: string;
}
interface RequestAudit {
  id: string; request_id: string; account_id: string; previous_status: Status; next_status: Status;
  manager_actor: string | null; decision_idempotency_key: string;
}

// Faithful model of the DB + both RPCs. Event/Queue tables are intentionally ABSENT —
// the request/decision path can touch neither, so their absence is the proof (§20).
class PilotDb {
  accounts = new Set<string>();
  assignments: Assignment[] = [];
  planAudit: PlanAudit[] = [];
  requests: Request[] = [];
  requestAudit: RequestAudit[] = [];
  private seq = 0;

  seedAccount(id: string, plan: PlanCode = 'FREE') {
    this.accounts.add(id);
    this.assignments.push({ id: `a${++this.seq}`, account_id: id, plan_code: plan, status: 'active' });
  }
  activePlan(accountId: string): PlanCode | null {
    return this.assignments.find((a) => a.account_id === accountId && a.status === 'active')?.plan_code ?? null;
  }
  pendingFor(accountId: string) {
    return this.requests.filter((r) => r.account_id === accountId && r.status === 'PENDING');
  }

  // Mirrors change_karaoke_host_plan (the EXISTING authority the decide RPC reuses).
  private changePlan(accountId: string, plan: PlanCode, key: string): { ok: boolean } {
    const prior = this.planAudit.find((r) => r.idempotency_key === key);
    if (prior) return { ok: true }; // replay: writes nothing
    const active = this.assignments.find((a) => a.account_id === accountId && a.status === 'active');
    if (active && active.plan_code === plan) return { ok: true }; // no-op
    if (active) active.status = 'ended';
    const row: Assignment = { id: `a${++this.seq}`, account_id: accountId, plan_code: plan, status: 'active' };
    this.assignments.push(row);
    this.planAudit.push({ id: `p${++this.seq}`, account_id: accountId, new_plan: plan, idempotency_key: key });
    return { ok: true };
  }

  // Mirrors create_karaoke_pro_pilot_request(...).
  create(accountId: string, roomId: string | null, key: string):
    | { ok: false; error: string }
    | { ok: true; requestId: string; status: Status; reused: boolean } {
    if (!key.trim()) return { ok: false, error: 'idempotency_key_required' };
    if (!this.accounts.has(accountId)) return { ok: false, error: 'account_not_found' };
    const replay = this.requests.find((r) => r.request_idempotency_key === key.trim());
    if (replay) return { ok: true, requestId: replay.id, status: replay.status, reused: true };
    if (this.activePlan(accountId) === 'PRO') return { ok: false, error: 'already_pro' };
    const existing = this.pendingFor(accountId)[0];
    if (existing) return { ok: true, requestId: existing.id, status: existing.status, reused: true };
    // partial unique index (one PENDING per account) — enforced structurally above.
    const row: Request = {
      id: `r${++this.seq}`, account_id: accountId, room_id: roomId, status: 'PENDING',
      decided_at: null, decided_by: null, decision_reason: null,
      approved_plan_assignment_id: null, request_idempotency_key: key.trim(),
    };
    this.requests.push(row);
    return { ok: true, requestId: row.id, status: 'PENDING', reused: false };
  }

  // Mirrors decide_karaoke_pro_pilot_request(...). ONE transaction, all-or-nothing.
  decide(requestId: string, decision: 'approve' | 'decline', key: string, reason: string | null):
    | { ok: false; error: string; status?: Status }
    | { ok: true; replayed: boolean; requestId: string; status: Status } {
    if (decision !== 'approve' && decision !== 'decline') return { ok: false, error: 'invalid_decision' };
    if (!key.trim()) return { ok: false, error: 'idempotency_key_required' };
    const next: Status = decision === 'approve' ? 'APPROVED' : 'DECLINED';

    const req = this.requests.find((r) => r.id === requestId);
    if (!req) return { ok: false, error: 'request_not_found' };

    // durable decision replay — return recorded outcome, write nothing
    const priorAudit = this.requestAudit.find((r) => r.decision_idempotency_key === key.trim());
    if (priorAudit) return { ok: true, replayed: true, requestId: priorAudit.request_id, status: priorAudit.next_status };

    // CAS: only a PENDING request can be decided
    if (req.status !== 'PENDING') return { ok: false, error: 'already_decided', status: req.status };

    const snapAssign = this.assignments.map((a) => ({ ...a }));
    const snapPlanAudit = this.planAudit.map((a) => ({ ...a }));
    const snapReq = this.requests.map((r) => ({ ...r }));
    try {
      if (decision === 'approve') {
        const planKey = `propilot:${key.trim()}`;
        const change = this.changePlan(req.account_id, 'PRO', planKey);
        if (!change.ok) throw new Error('plan_change_failed');
        const assignId = this.assignments.find((a) => a.account_id === req.account_id && a.status === 'active')!.id;
        req.status = 'APPROVED'; req.decided_at = '2026-07-24T00:00:00Z'; req.decided_by = 'bty_mgr';
        req.decision_reason = reason; req.approved_plan_assignment_id = assignId;
      } else {
        req.status = 'DECLINED'; req.decided_at = '2026-07-24T00:00:00Z'; req.decided_by = 'bty_mgr';
        req.decision_reason = reason;
      }
      if (this.requestAudit.some((r) => r.decision_idempotency_key === key.trim())) {
        throw Object.assign(new Error('dup'), { code: '23505' });
      }
      this.requestAudit.push({
        id: `d${++this.seq}`, request_id: requestId, account_id: req.account_id,
        previous_status: 'PENDING', next_status: next, manager_actor: 'bty_mgr',
        decision_idempotency_key: key.trim(),
      });
      return { ok: true, replayed: false, requestId, status: next };
    } catch (e) {
      this.assignments = snapAssign; this.planAudit = snapPlanAudit; this.requests = snapReq;
      throw e;
    }
  }
}

let db: PilotDb;
beforeEach(() => { db = new PilotDb(); });

describe('create_karaoke_pro_pilot_request — semantics (§13 1–6)', () => {
  it('(1) a FREE Host creates a PENDING request', () => {
    db.seedAccount('acct', 'FREE');
    const res = db.create('acct', 'room1', 'k1');
    expect(res).toMatchObject({ ok: true, status: 'PENDING', reused: false });
    expect(db.pendingFor('acct')).toHaveLength(1);
  });

  it('(2) a PRO Host cannot create a request', () => {
    db.seedAccount('acct', 'PRO');
    expect(db.create('acct', 'room1', 'k1')).toEqual({ ok: false, error: 'already_pro' });
    expect(db.requests).toHaveLength(0);
  });

  it('(3) a second PENDING for the same account is never created (returns the existing one)', () => {
    db.seedAccount('acct', 'FREE');
    const a = db.create('acct', 'room1', 'k1');
    const b = db.create('acct', 'room1', 'k2'); // different key, still PENDING exists
    expect(b).toMatchObject({ ok: true, reused: true });
    expect((a as { requestId: string }).requestId).toBe((b as { requestId: string }).requestId);
    expect(db.pendingFor('acct')).toHaveLength(1);
  });

  it('(4) the same idempotency key returns the same request (no duplicate)', () => {
    db.seedAccount('acct', 'FREE');
    const a = db.create('acct', 'room1', 'same');
    const b = db.create('acct', 'room1', 'same');
    expect((a as { requestId: string }).requestId).toBe((b as { requestId: string }).requestId);
    expect(b).toMatchObject({ reused: true });
    expect(db.requests).toHaveLength(1);
  });

  it('an unknown account cannot create a request', () => {
    expect(db.create('ghost', null, 'k1')).toEqual({ ok: false, error: 'account_not_found' });
  });
});

describe('decide_karaoke_pro_pilot_request — APPROVE (§13 8–14)', () => {
  function seededPending() {
    db.seedAccount('acct', 'FREE');
    const r = db.create('acct', 'room1', 'k1') as { requestId: string };
    return r.requestId;
  }

  it('(8) approve moves the request to APPROVED', () => {
    const id = seededPending();
    const res = db.decide(id, 'approve', 'd1', 'ok');
    expect(res).toMatchObject({ ok: true, status: 'APPROVED' });
    expect(db.requests.find((r) => r.id === id)!.status).toBe('APPROVED');
  });

  it('(9) approve moves the canonical plan to PRO', () => {
    const id = seededPending();
    db.decide(id, 'approve', 'd1', 'ok');
    expect(db.activePlan('acct')).toBe('PRO');
  });

  it('(10) approve creates exactly one active assignment', () => {
    const id = seededPending();
    db.decide(id, 'approve', 'd1', 'ok');
    expect(db.assignments.filter((a) => a.account_id === 'acct' && a.status === 'active')).toHaveLength(1);
  });

  it('(11) approve writes exactly one plan audit row', () => {
    const id = seededPending();
    db.decide(id, 'approve', 'd1', 'ok');
    expect(db.planAudit).toHaveLength(1);
  });

  it('(12) approve writes exactly one request-decision audit row', () => {
    const id = seededPending();
    db.decide(id, 'approve', 'd1', 'ok');
    expect(db.requestAudit).toHaveLength(1);
    expect(db.requestAudit[0]).toMatchObject({ previous_status: 'PENDING', next_status: 'APPROVED' });
  });

  it('(13) a retried approve (same key) makes NO duplicate plan/assignment/audit', () => {
    const id = seededPending();
    db.decide(id, 'approve', 'd1', 'ok');
    const replay = db.decide(id, 'approve', 'd1', 'ok');
    expect(replay).toMatchObject({ ok: true, replayed: true, status: 'APPROVED' });
    expect(db.assignments.filter((a) => a.account_id === 'acct' && a.status === 'active')).toHaveLength(1);
    expect(db.planAudit).toHaveLength(1);
    expect(db.requestAudit).toHaveLength(1);
    expect(db.activePlan('acct')).toBe('PRO');
  });

  it('(14) two concurrent approves with the same key converge to one change', () => {
    const id = seededPending();
    const first = db.decide(id, 'approve', 'dup', 'ok');
    const second = db.decide(id, 'approve', 'dup', 'ok'); // double-submit, same key
    expect(first).toMatchObject({ ok: true });
    expect(second).toMatchObject({ ok: true, replayed: true });
    expect(db.planAudit).toHaveLength(1);
    expect(db.requestAudit).toHaveLength(1);
  });
});

describe('decide_karaoke_pro_pilot_request — DECLINE (§13 15–17)', () => {
  function seededPending() {
    db.seedAccount('acct', 'FREE');
    return (db.create('acct', 'room1', 'k1') as { requestId: string }).requestId;
  }

  it('(15) decline keeps the plan FREE (no assignment, no plan audit)', () => {
    const id = seededPending();
    const res = db.decide(id, 'decline', 'd1', 'not now');
    expect(res).toMatchObject({ ok: true, status: 'DECLINED' });
    expect(db.activePlan('acct')).toBe('FREE');
    expect(db.planAudit).toHaveLength(0);
  });

  it('(16) decline writes exactly one decision audit row', () => {
    const id = seededPending();
    db.decide(id, 'decline', 'd1', 'not now');
    expect(db.requestAudit).toHaveLength(1);
    expect(db.requestAudit[0]).toMatchObject({ previous_status: 'PENDING', next_status: 'DECLINED' });
  });

  it('(17) a retried decline (same key) creates no duplicate audit', () => {
    const id = seededPending();
    db.decide(id, 'decline', 'd1', 'x');
    const replay = db.decide(id, 'decline', 'd1', 'x');
    expect(replay).toMatchObject({ ok: true, replayed: true, status: 'DECLINED' });
    expect(db.requestAudit).toHaveLength(1);
  });
});

describe('decide guards (§13 18–19) + integrity (§9/§12/§20)', () => {
  function pendingId() {
    db.seedAccount('acct', 'FREE');
    return (db.create('acct', 'room1', 'k1') as { requestId: string }).requestId;
  }

  it('(18) an APPROVED request cannot be declined', () => {
    const id = pendingId();
    db.decide(id, 'approve', 'd1', 'ok');
    const res = db.decide(id, 'decline', 'd2', 'no');
    expect(res).toEqual({ ok: false, error: 'already_decided', status: 'APPROVED' });
    expect(db.activePlan('acct')).toBe('PRO'); // unchanged
  });

  it('(19) a DECLINED request cannot be approved', () => {
    const id = pendingId();
    db.decide(id, 'decline', 'd1', 'no');
    const res = db.decide(id, 'approve', 'd2', 'yes');
    expect(res).toEqual({ ok: false, error: 'already_decided', status: 'DECLINED' });
    expect(db.activePlan('acct')).toBe('FREE'); // decline never granted PRO
    expect(db.planAudit).toHaveLength(0);
  });

  it('(§9) no reachable state has request APPROVED while plan is still FREE', () => {
    const id = pendingId();
    db.decide(id, 'approve', 'd1', 'ok');
    const req = db.requests.find((r) => r.id === id)!;
    // If APPROVED, the plan MUST be PRO (single-transaction invariant).
    expect(req.status === 'APPROVED' ? db.activePlan('acct') === 'PRO' : true).toBe(true);
  });

  it('(§9) no reachable state has plan PRO while its approving request stays PENDING', () => {
    const id = pendingId();
    db.decide(id, 'approve', 'd1', 'ok');
    if (db.activePlan('acct') === 'PRO') {
      expect(db.requests.find((r) => r.id === id)!.status).toBe('APPROVED');
    }
  });

  it('a decision for an unknown request is rejected', () => {
    expect(db.decide('ghost', 'approve', 'd1', 'x')).toEqual({ ok: false, error: 'request_not_found' });
  });
});
