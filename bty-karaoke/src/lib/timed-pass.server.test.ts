// timed-pass.server — the thin service over the issue/select/revoke RPCs, the state read,
// and the read-only inventory/audit lists. Proves param forwarding, jsonb normalization,
// typed rejections, and the domain projection wiring.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const rpc = vi.fn();
const datasets: Record<string, unknown[]> = {};

function builder(table: string) {
  const rows = () => datasets[table] ?? [];
  const chain: Record<string, unknown> = {};
  const methods = ['select', 'eq', 'order', 'limit'];
  for (const m of methods) chain[m] = () => chain;
  (chain as { then: unknown }).then = (resolve: (v: unknown) => void) => resolve({ data: rows(), error: null });
  chain.maybeSingle = async () => ({ data: rows()[0] ?? null, error: null });
  return chain;
}

vi.mock('@/lib/supabase.server', () => ({
  karaokeDb: () => ({ rpc, from: (t: string) => builder(t) }),
}));

import {
  issueTimedPass,
  selectTimedPass,
  revokeTimedPass,
  readTimedPassState,
  listAccountTimedPasses,
  getHostTimedPassInventory,
} from './timed-pass.server';

beforeEach(() => {
  rpc.mockReset();
  for (const k of Object.keys(datasets)) delete datasets[k];
});

describe('issueTimedPass', () => {
  it('forwards params and normalizes a new grant', async () => {
    rpc.mockResolvedValue({ data: { ok: true, passGrantId: 'g1', passType: 'ONE_HOUR', status: 'AVAILABLE', reused: false }, error: null });
    const out = await issueTimedPass({ accountId: 'a', passType: 'ONE_HOUR', reason: 'gate A', idempotencyKey: 'k1' });
    expect(rpc).toHaveBeenCalledWith('issue_timed_access_pass', {
      p_account_id: 'a', p_pass_type: 'ONE_HOUR', p_reason: 'gate A', p_idempotency_key: 'k1', p_manager_actor: 'bty_mgr',
    });
    expect(out).toEqual({ ok: true, passGrantId: 'g1', passType: 'ONE_HOUR', status: 'AVAILABLE', reused: false });
  });

  it('maps account_is_pro to a typed rejection (no throw)', async () => {
    rpc.mockResolvedValue({ data: { ok: false, error: 'account_is_pro' }, error: null });
    expect(await issueTimedPass({ accountId: 'a', passType: 'FOUR_HOURS', reason: null, idempotencyKey: 'k' }))
      .toEqual({ ok: false, error: 'account_is_pro' });
  });

  it('returns reused=true on an idempotent replay', async () => {
    rpc.mockResolvedValue({ data: { ok: true, passGrantId: 'g1', passType: 'ONE_HOUR', status: 'AVAILABLE', reused: true }, error: null });
    const out = await issueTimedPass({ accountId: 'a', passType: 'ONE_HOUR', reason: null, idempotencyKey: 'k1' });
    expect(out.ok && out.reused).toBe(true);
  });
});

describe('selectTimedPass', () => {
  it('forwards and normalizes a real selection', async () => {
    rpc.mockResolvedValue({ data: { ok: true, passGrantId: 'g1', status: 'SELECTED', changed: true }, error: null });
    const out = await selectTimedPass({ accountId: 'a', passGrantId: 'g1', idempotencyKey: 'k' });
    expect(rpc).toHaveBeenCalledWith('select_timed_access_pass', {
      p_account_id: 'a', p_pass_grant_id: 'g1', p_idempotency_key: 'k',
    });
    expect(out).toEqual({ ok: true, passGrantId: 'g1', status: 'SELECTED', changed: true });
  });

  it('maps not_selectable (revoked/expired/active) to a typed rejection with status', async () => {
    rpc.mockResolvedValue({ data: { ok: false, error: 'not_selectable', status: 'REVOKED' }, error: null });
    expect(await selectTimedPass({ accountId: 'a', passGrantId: 'g1' }))
      .toEqual({ ok: false, error: 'not_selectable', status: 'REVOKED' });
  });

  it('passes a null idempotency key when omitted', async () => {
    rpc.mockResolvedValue({ data: { ok: true, passGrantId: 'g1', status: 'SELECTED', changed: false }, error: null });
    await selectTimedPass({ accountId: 'a', passGrantId: 'g1' });
    expect(rpc).toHaveBeenCalledWith('select_timed_access_pass', { p_account_id: 'a', p_pass_grant_id: 'g1', p_idempotency_key: null });
  });
});

describe('revokeTimedPass', () => {
  it('maps not_revocable (ACTIVE) to a typed rejection with status', async () => {
    rpc.mockResolvedValue({ data: { ok: false, error: 'not_revocable', status: 'ACTIVE' }, error: null });
    expect(await revokeTimedPass({ passGrantId: 'g1', reason: null, idempotencyKey: 'k' }))
      .toEqual({ ok: false, error: 'not_revocable', status: 'ACTIVE' });
  });

  it('returns replayed=true on a durable replay', async () => {
    rpc.mockResolvedValue({ data: { ok: true, passGrantId: 'g1', status: 'REVOKED', replayed: true }, error: null });
    const out = await revokeTimedPass({ passGrantId: 'g1', reason: 'undo', idempotencyKey: 'k' });
    expect(out.ok && out.replayed).toBe(true);
  });
});

describe('readTimedPassState', () => {
  it('projects the RPC jsonb into the typed effective state', async () => {
    rpc.mockResolvedValue({
      data: {
        outcome: 'ok', basePlan: 'FREE', effectiveEntitlement: 'TIMED_ACCESS',
        activePass: { id: 'g1', passType: 'ONE_HOUR', durationSeconds: 3600, activatedAt: '2026-07-23T10:00:00Z', expiresAt: '2026-07-23T11:00:00Z', remainingSeconds: 1200 },
        selectedPass: null,
      },
      error: null,
    });
    const state = await readTimedPassState('a');
    expect(state?.effectiveEntitlement).toBe('TIMED_ACCESS');
    expect(state?.activePass?.remainingSeconds).toBe(1200);
  });

  it('returns null on a failed outcome (fail safe)', async () => {
    rpc.mockResolvedValue({ data: { outcome: 'account_not_found' }, error: null });
    expect(await readTimedPassState('a')).toBeNull();
  });
});

describe('listAccountTimedPasses / inventory', () => {
  it('maps grant rows to camelCase views, newest first as returned', async () => {
    datasets['timed_access_pass_grants'] = [
      {
        id: 'g1', account_id: 'a', pass_type: 'FOUR_HOURS', duration_seconds: 14400, status: 'AVAILABLE',
        issue_reason: 'pilot', selected_at: null, activated_at: null, expires_at: null, expired_at: null,
        revoked_at: null, revoke_reason: null, created_at: '2026-07-23T09:00:00Z',
      },
    ];
    const passes = await listAccountTimedPasses('a');
    expect(passes).toHaveLength(1);
    expect(passes[0]).toMatchObject({ id: 'g1', passType: 'FOUR_HOURS', durationSeconds: 14400, status: 'AVAILABLE', issueReason: 'pilot' });
  });

  it('getHostTimedPassInventory combines state + passes', async () => {
    rpc.mockResolvedValue({ data: { outcome: 'ok', basePlan: 'FREE', effectiveEntitlement: 'FREE', activePass: null, selectedPass: null }, error: null });
    datasets['timed_access_pass_grants'] = [];
    const out = await getHostTimedPassInventory('a');
    expect(out.state?.effectiveEntitlement).toBe('FREE');
    expect(out.passes).toEqual([]);
  });
});
