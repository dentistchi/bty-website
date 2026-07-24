// POST /api/manager/timed-passes/issue — operator-gated pass issuance (BUILD 17 §4/Gate A).

import { describe, it, expect, vi, beforeEach } from 'vitest';

const state = { enabled: true, ok: false };
vi.mock('@/lib/manager-auth.server', () => ({
  managerEnabled: () => state.enabled,
  managerAuthorized: vi.fn(async () => state.ok),
}));
const issueTimedPass = vi.fn();
vi.mock('@/lib/timed-pass.server', () => ({ issueTimedPass: (...a: unknown[]) => issueTimedPass(...a) }));

import { POST } from './route';

function req(body: unknown) {
  return new Request('https://x/api/manager/timed-passes/issue', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }) as unknown as import('next/server').NextRequest;
}

beforeEach(() => {
  state.enabled = true;
  state.ok = false;
  issueTimedPass.mockReset();
});

describe('POST /api/manager/timed-passes/issue', () => {
  it('unauthenticated / plain Host → 401, never issues', async () => {
    const res = await POST(req({ accountId: '11111111-1111-1111-1111-111111111111', passType: 'ONE_HOUR', idempotencyKey: 'k' }));
    expect(res.status).toBe(401);
    expect(issueTimedPass).not.toHaveBeenCalled();
  });

  it('503 when manager is not enabled', async () => {
    state.enabled = false;
    state.ok = true;
    const res = await POST(req({ accountId: '11111111-1111-1111-1111-111111111111', passType: 'ONE_HOUR', idempotencyKey: 'k' }));
    expect(res.status).toBe(503);
  });

  it('rejects an arbitrary pass type (closed enum) before the service', async () => {
    state.ok = true;
    const res = await POST(req({ accountId: '11111111-1111-1111-1111-111111111111', passType: 'TWO_HOURS', idempotencyKey: 'k' }));
    expect(res.status).toBe(400);
    expect(issueTimedPass).not.toHaveBeenCalled();
  });

  it('Gate A: authorized operator issues a 1h pass on a FREE account', async () => {
    state.ok = true;
    issueTimedPass.mockResolvedValue({ ok: true, passGrantId: 'g1', passType: 'ONE_HOUR', status: 'AVAILABLE', reused: false });
    const res = await POST(req({ accountId: '11111111-1111-1111-1111-111111111111', passType: 'ONE_HOUR', reason: 'gate A', idempotencyKey: 'k1' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, passGrantId: 'g1', passType: 'ONE_HOUR', status: 'AVAILABLE' });
    expect(issueTimedPass).toHaveBeenCalledWith({
      accountId: '11111111-1111-1111-1111-111111111111', passType: 'ONE_HOUR', reason: 'gate A', idempotencyKey: 'k1',
    });
  });

  it('§6: a PRO account is blocked with 409 account_is_pro', async () => {
    state.ok = true;
    issueTimedPass.mockResolvedValue({ ok: false, error: 'account_is_pro' });
    const res = await POST(req({ accountId: '11111111-1111-1111-1111-111111111111', passType: 'ONE_HOUR', idempotencyKey: 'k' }));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('account_is_pro');
  });
});
