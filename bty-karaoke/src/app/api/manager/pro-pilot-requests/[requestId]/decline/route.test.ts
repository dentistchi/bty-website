// POST .../[requestId]/decline — operator gate + safe forwarding (§13 15/17/18).

import { describe, it, expect, vi, beforeEach } from 'vitest';

const state = { enabled: true, ok: false };
vi.mock('@/lib/manager-auth.server', () => ({
  managerEnabled: () => state.enabled,
  managerAuthorized: vi.fn(async () => state.ok),
}));
const decideProPilotRequest = vi.fn();
vi.mock('@/lib/pro-pilot.server', () => ({ decideProPilotRequest: (...a: unknown[]) => decideProPilotRequest(...a) }));

import { POST } from './route';

function req(body: unknown) {
  return new Request('https://x/api/manager/pro-pilot-requests/r1/decline', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }) as unknown as import('next/server').NextRequest;
}
const ctx = { params: Promise.resolve({ requestId: 'r1' }) };

beforeEach(() => { state.enabled = true; state.ok = false; decideProPilotRequest.mockReset(); });

describe('POST decline', () => {
  it('unauthenticated → 401, never decides', async () => {
    state.ok = false;
    const res = await POST(req({ idempotencyKey: 'k1' }), ctx);
    expect(res.status).toBe(401);
    expect(decideProPilotRequest).not.toHaveBeenCalled();
  });

  it('(15) an authorized operator declines → DECLINED + currentPlan FREE', async () => {
    state.ok = true;
    decideProPilotRequest.mockResolvedValue({ ok: true, replayed: false, requestId: 'r1', status: 'DECLINED' });
    const res = await POST(req({ idempotencyKey: 'k1', reason: 'not now' }), ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, requestId: 'r1', status: 'DECLINED', currentPlan: 'FREE' });
    expect(decideProPilotRequest).toHaveBeenCalledWith({
      requestId: 'r1', decision: 'decline', reason: 'not now', decisionIdempotencyKey: 'k1',
    });
  });

  it('(17) a replayed decline is a stable success', async () => {
    state.ok = true;
    decideProPilotRequest.mockResolvedValue({ ok: true, replayed: true, requestId: 'r1', status: 'DECLINED' });
    const res = await POST(req({ idempotencyKey: 'k1' }), ctx);
    expect(res.status).toBe(200);
    expect((await res.json()).status).toBe('DECLINED');
  });

  it('(18) declining an already-decided (APPROVED) request → 409', async () => {
    state.ok = true;
    decideProPilotRequest.mockResolvedValue({ ok: false, error: 'already_decided', status: 'APPROVED' });
    const res = await POST(req({ idempotencyKey: 'k1' }), ctx);
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ ok: false, error: 'already_decided', status: 'APPROVED' });
  });
});
