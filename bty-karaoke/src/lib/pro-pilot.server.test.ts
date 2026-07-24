// pro-pilot.server — the thin service over the create/decide RPCs and the read-only
// Manager list. Proves param forwarding, jsonb normalization, typed rejections, the
// latest-request read, and the list assembly (PENDING-first, Room-derived labels,
// current plan from the entitlement authority, §12 counts).

import { describe, it, expect, vi, beforeEach } from 'vitest';

const rpc = vi.fn();
// Per-table datasets for the read path; each test sets what `from(table).select()` returns.
const datasets: Record<string, unknown[]> = {};

function builder(table: string) {
  const rows = () => datasets[table] ?? [];
  const chain: Record<string, unknown> = {};
  const methods = ['select', 'eq', 'order', 'limit'];
  for (const m of methods) chain[m] = () => chain;
  // Awaiting the builder (list path: from().select()) resolves the full dataset.
  (chain as { then: unknown }).then = (resolve: (v: unknown) => void) => resolve({ data: rows(), error: null });
  // maybeSingle (get path) resolves the first row or null.
  chain.maybeSingle = async () => ({ data: rows()[0] ?? null, error: null });
  return chain;
}

vi.mock('@/lib/supabase.server', () => ({
  karaokeDb: () => ({ rpc, from: (t: string) => builder(t) }),
}));

import {
  createProPilotRequest,
  decideProPilotRequest,
  getProPilotRequestForAccount,
  listProPilotRequests,
} from './pro-pilot.server';

beforeEach(() => {
  rpc.mockReset();
  for (const k of Object.keys(datasets)) delete datasets[k];
});

describe('createProPilotRequest', () => {
  it('forwards params and normalizes a new request', async () => {
    rpc.mockResolvedValue({ data: { ok: true, requestId: 'r1', status: 'PENDING', reused: false }, error: null });
    const out = await createProPilotRequest({ accountId: 'a', roomId: 'room1', idempotencyKey: 'k1' });
    expect(rpc).toHaveBeenCalledWith('create_karaoke_pro_pilot_request', {
      p_account_id: 'a', p_room_id: 'room1', p_idempotency_key: 'k1',
    });
    expect(out).toEqual({ ok: true, requestId: 'r1', status: 'PENDING', reused: false });
  });

  it('maps already_pro to a typed rejection (no throw)', async () => {
    rpc.mockResolvedValue({ data: { ok: false, error: 'already_pro' }, error: null });
    expect(await createProPilotRequest({ accountId: 'a', roomId: null, idempotencyKey: 'k' }))
      .toEqual({ ok: false, error: 'already_pro' });
  });
});

describe('decideProPilotRequest', () => {
  it('forwards approve with the derived actor and normalizes APPROVED', async () => {
    rpc.mockResolvedValue({ data: { ok: true, replayed: false, requestId: 'r1', status: 'APPROVED' }, error: null });
    const out = await decideProPilotRequest({ requestId: 'r1', decision: 'approve', reason: 'go', decisionIdempotencyKey: 'd1' });
    expect(rpc).toHaveBeenCalledWith('decide_karaoke_pro_pilot_request', {
      p_request_id: 'r1', p_decision: 'approve', p_reason: 'go',
      p_decision_idempotency_key: 'd1', p_manager_actor: 'bty_mgr', p_actor_account: null,
    });
    expect(out).toEqual({ ok: true, replayed: false, requestId: 'r1', status: 'APPROVED' });
  });

  it('surfaces a replayed decision', async () => {
    rpc.mockResolvedValue({ data: { ok: true, replayed: true, requestId: 'r1', status: 'APPROVED' }, error: null });
    expect(await decideProPilotRequest({ requestId: 'r1', decision: 'approve', reason: null, decisionIdempotencyKey: 'd1' }))
      .toMatchObject({ ok: true, replayed: true, status: 'APPROVED' });
  });

  it('maps already_decided (with the current status) to a typed rejection', async () => {
    rpc.mockResolvedValue({ data: { ok: false, error: 'already_decided', status: 'DECLINED' }, error: null });
    expect(await decideProPilotRequest({ requestId: 'r1', decision: 'approve', reason: null, decisionIdempotencyKey: 'd1' }))
      .toEqual({ ok: false, error: 'already_decided', status: 'DECLINED' });
  });
});

describe('getProPilotRequestForAccount', () => {
  it('returns null when the account has no request', async () => {
    datasets['karaoke_pro_pilot_requests'] = [];
    expect(await getProPilotRequestForAccount('a')).toBeNull();
  });

  it('returns the latest request view', async () => {
    datasets['karaoke_pro_pilot_requests'] = [
      { id: 'r2', account_id: 'a', room_id: null, status: 'DECLINED', requested_at: 't2', decided_at: 't3', decision_reason: 'no' },
    ];
    expect(await getProPilotRequestForAccount('a')).toEqual({ status: 'DECLINED', requestedAt: 't2', decidedAt: 't3' });
  });
});

describe('listProPilotRequests (§12 counts + labels + order)', () => {
  it('assembles PENDING-first with Room-derived labels and current plan, and correct totals', async () => {
    datasets['karaoke_pro_pilot_requests'] = [
      { id: 'r1', account_id: 'a1', room_id: 'room1', status: 'APPROVED', requested_at: '2026-07-24T01:00', decided_at: '2026-07-24T02:00', decision_reason: null },
      { id: 'r2', account_id: 'a2', room_id: 'room2', status: 'PENDING', requested_at: '2026-07-24T03:00', decided_at: null, decision_reason: null },
      { id: 'r3', account_id: 'a3', room_id: null, status: 'DECLINED', requested_at: '2026-07-24T00:00', decided_at: '2026-07-24T00:30', decision_reason: null },
    ];
    datasets['karaoke_host_plan_assignments'] = [
      { account_id: 'a1', plan_code: 'PRO', status: 'active' },
      { account_id: 'a2', plan_code: 'FREE', status: 'active' },
    ];
    datasets['karaoke_rooms'] = [
      { id: 'room1', slug: 'chi-norebang', display_name: 'Chi Family Norebang' },
      { id: 'room2', slug: 'bty-home', display_name: null },
    ];

    const res = await listProPilotRequests();
    expect(res.totals).toEqual({ total: 3, pending: 1, approved: 1, declined: 1, uniqueAccounts: 3 });
    // PENDING first.
    expect(res.requests[0].status).toBe('PENDING');
    // Room-derived labels, never a personal identity.
    const approved = res.requests.find((r) => r.requestId === 'r1')!;
    expect(approved.roomLabel).toBe('Chi Family Norebang');
    expect(approved.currentPlan).toBe('PRO');
    const pending = res.requests.find((r) => r.requestId === 'r2')!;
    expect(pending.roomLabel).toBe('bty-home'); // display_name null → slug
    expect(pending.currentPlan).toBe('FREE');
    // No email / subject / relay id anywhere.
    expect(JSON.stringify(res)).not.toMatch(/@|privaterelay|subject|token/i);
  });

  it('filters by status', async () => {
    datasets['karaoke_pro_pilot_requests'] = [
      { id: 'r2', account_id: 'a2', room_id: null, status: 'PENDING', requested_at: 't', decided_at: null, decision_reason: null },
      { id: 'r1', account_id: 'a1', room_id: null, status: 'APPROVED', requested_at: 't', decided_at: 't', decision_reason: null },
    ];
    datasets['karaoke_host_plan_assignments'] = [];
    datasets['karaoke_rooms'] = [];
    const res = await listProPilotRequests({ status: 'PENDING' });
    expect(res.requests).toHaveLength(1);
    expect(res.requests[0].requestId).toBe('r2');
    // totals still reflect the full set.
    expect(res.totals.total).toBe(2);
  });
});
