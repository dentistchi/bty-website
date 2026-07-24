// POST .../[requestId]/approve — operator gate + safe forwarding (§13 8/13/14/19).

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
  return new Request('https://x/api/manager/pro-pilot-requests/r1/approve', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }) as unknown as import('next/server').NextRequest;
}
const ctx = { params: Promise.resolve({ requestId: 'r1' }) };

beforeEach(() => { state.enabled = true; state.ok = false; decideProPilotRequest.mockReset(); });

describe('POST approve', () => {
  it('unauthenticated → 401, never decides', async () => {
    state.ok = false;
    const res = await POST(req({ idempotencyKey: 'k1' }), ctx);
    expect(res.status).toBe(401);
    expect(decideProPilotRequest).not.toHaveBeenCalled();
  });

  it('(8) an authorized operator approves → APPROVED + currentPlan PRO', async () => {
    state.ok = true;
    decideProPilotRequest.mockResolvedValue({ ok: true, replayed: false, requestId: 'r1', status: 'APPROVED' });
    const res = await POST(req({ idempotencyKey: 'k1', reason: 'go' }), ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, requestId: 'r1', status: 'APPROVED', currentPlan: 'PRO' });
    expect(decideProPilotRequest).toHaveBeenCalledWith({
      requestId: 'r1', decision: 'approve', reason: 'go', decisionIdempotencyKey: 'k1',
    });
  });

  it('(13/14) a replayed approve is still a stable success', async () => {
    state.ok = true;
    decideProPilotRequest.mockResolvedValue({ ok: true, replayed: true, requestId: 'r1', status: 'APPROVED' });
    const res = await POST(req({ idempotencyKey: 'k1' }), ctx);
    expect(res.status).toBe(200);
    expect((await res.json()).status).toBe('APPROVED');
  });

  it('(19) approving an already-decided (DECLINED) request → 409', async () => {
    state.ok = true;
    decideProPilotRequest.mockResolvedValue({ ok: false, error: 'already_decided', status: 'DECLINED' });
    const res = await POST(req({ idempotencyKey: 'k1' }), ctx);
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ ok: false, error: 'already_decided', status: 'DECLINED' });
  });

  it('a missing request → 404', async () => {
    state.ok = true;
    decideProPilotRequest.mockResolvedValue({ ok: false, error: 'request_not_found' });
    const res = await POST(req({ idempotencyKey: 'k1' }), ctx);
    expect(res.status).toBe(404);
  });

  it('missing idempotency key → 400, never decides', async () => {
    state.ok = true;
    const res = await POST(req({}), ctx);
    expect(res.status).toBe(400);
    expect(decideProPilotRequest).not.toHaveBeenCalled();
  });
});
