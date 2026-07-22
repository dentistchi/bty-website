// changeNorebangHostPlan — the thin service over the change_karaoke_host_plan RPC.
// Proves it forwards the right params, normalizes the jsonb outcome, and surfaces
// known rejections as { ok:false } without throwing — never exposing a credential.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const rpc = vi.fn();
vi.mock('@/lib/supabase.server', () => ({
  karaokeDb: () => ({ rpc }),
}));

import { changeNorebangHostPlan } from './host-plan.server';

beforeEach(() => rpc.mockReset());

describe('changeNorebangHostPlan', () => {
  it('forwards MANUAL source + all params to the RPC', async () => {
    rpc.mockResolvedValue({ data: { ok: true, changed: true, previousPlan: 'FREE', currentPlan: 'PRO' }, error: null });
    await changeNorebangHostPlan({ accountId: 'acct-1', planCode: 'PRO', reason: 'pilot', idempotencyKey: 'op-1' });
    expect(rpc).toHaveBeenCalledWith('change_karaoke_host_plan', {
      p_account_id: 'acct-1',
      p_plan_code: 'PRO',
      p_reason: 'pilot',
      p_idempotency_key: 'op-1',
      p_source: 'MANUAL',
      p_actor_account: null,
    });
  });

  it('normalizes a real FREE→PRO change', async () => {
    rpc.mockResolvedValue({ data: { ok: true, changed: true, previousPlan: 'FREE', currentPlan: 'PRO' }, error: null });
    const out = await changeNorebangHostPlan({ accountId: 'a', planCode: 'PRO', reason: 'r', idempotencyKey: 'k' });
    expect(out).toEqual({ ok: true, changed: true, replayed: false, previousPlan: 'FREE', currentPlan: 'PRO' });
  });

  it('normalizes a same-plan no-op (changed=false, previousPlan absent)', async () => {
    rpc.mockResolvedValue({ data: { ok: true, changed: false, currentPlan: 'PRO' }, error: null });
    const out = await changeNorebangHostPlan({ accountId: 'a', planCode: 'PRO', reason: 'r', idempotencyKey: 'k' });
    expect(out).toEqual({ ok: true, changed: false, replayed: false, previousPlan: null, currentPlan: 'PRO' });
  });

  it('surfaces a replayed outcome', async () => {
    rpc.mockResolvedValue({ data: { ok: true, changed: true, replayed: true, previousPlan: 'FREE', currentPlan: 'PRO' }, error: null });
    const out = await changeNorebangHostPlan({ accountId: 'a', planCode: 'PRO', reason: 'r', idempotencyKey: 'k' });
    expect(out).toMatchObject({ ok: true, replayed: true, currentPlan: 'PRO' });
  });

  it('maps account_not_found to a typed rejection (no throw)', async () => {
    rpc.mockResolvedValue({ data: { ok: false, error: 'account_not_found' }, error: null });
    const out = await changeNorebangHostPlan({ accountId: 'ghost', planCode: 'PRO', reason: 'r', idempotencyKey: 'k' });
    expect(out).toEqual({ ok: false, error: 'account_not_found' });
  });

  it('maps invalid_plan_code to a typed rejection', async () => {
    rpc.mockResolvedValue({ data: { ok: false, error: 'invalid_plan_code' }, error: null });
    const out = await changeNorebangHostPlan({ accountId: 'a', planCode: 'PRO', reason: 'r', idempotencyKey: 'k' });
    expect(out).toEqual({ ok: false, error: 'invalid_plan_code' });
  });

  it('throws only on an unexpected DB error', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'boom' } });
    await expect(
      changeNorebangHostPlan({ accountId: 'a', planCode: 'PRO', reason: 'r', idempotencyKey: 'k' }),
    ).rejects.toBeTruthy();
  });
});
