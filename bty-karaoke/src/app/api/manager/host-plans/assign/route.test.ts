// POST /api/manager/host-plans/assign — operator authorization + safe forwarding.
//
// Pins the authorization requirements (13–17): a plain Host session cannot change a
// plan; unauthenticated fails uniformly; only the manager (operator) session
// succeeds; a forged/unknown account leaks nothing; the response never carries a
// credential. The change itself is delegated to the atomic RPC (mocked here).

import { describe, it, expect, vi, beforeEach } from 'vitest';

const state = {
  managerEnabled: true,
  managerOk: false, // does the request carry a valid manager session?
};

vi.mock('@/lib/manager-auth.server', () => ({
  managerEnabled: () => state.managerEnabled,
  managerAuthorized: vi.fn(async () => state.managerOk),
}));

const changeNorebangHostPlan = vi.fn();
vi.mock('@/lib/host-plan.server', () => ({
  changeNorebangHostPlan: (...args: unknown[]) => changeNorebangHostPlan(...args),
}));

import { POST } from './route';

function req(body: unknown) {
  return new Request('https://x/api/manager/host-plans/assign', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }) as unknown as import('next/server').NextRequest;
}

const validBody = {
  accountId: '11111111-1111-4111-8111-111111111111',
  planCode: 'PRO',
  reason: 'Commander pilot lifecycle verification',
  idempotencyKey: 'op-abc-123',
};

beforeEach(() => {
  state.managerEnabled = true;
  state.managerOk = false;
  changeNorebangHostPlan.mockReset();
});

describe('POST /api/manager/host-plans/assign', () => {
  it('(13/14) an unauthenticated / plain-Host request is a uniform 401 and never touches the RPC', async () => {
    state.managerOk = false;
    const res = await POST(req(validBody));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Unauthorized' });
    expect(changeNorebangHostPlan).not.toHaveBeenCalled();
  });

  it('(15) an authorized operator succeeds and gets the plan outcome', async () => {
    state.managerOk = true;
    changeNorebangHostPlan.mockResolvedValue({ ok: true, changed: true, replayed: false, previousPlan: 'FREE', currentPlan: 'PRO' });
    const res = await POST(req(validBody));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, changed: true, previousPlan: 'FREE', currentPlan: 'PRO' });
    expect(res.headers.get('cache-control')).toContain('no-store');
  });

  it('same-plan retry returns changed:false', async () => {
    state.managerOk = true;
    changeNorebangHostPlan.mockResolvedValue({ ok: true, changed: false, replayed: false, previousPlan: null, currentPlan: 'PRO' });
    const res = await POST(req(validBody));
    expect(await res.json()).toEqual({ ok: true, changed: false, previousPlan: null, currentPlan: 'PRO' });
  });

  it('(16) an unknown account is a 404 with no sensitive detail', async () => {
    state.managerOk = true;
    changeNorebangHostPlan.mockResolvedValue({ ok: false, error: 'account_not_found' });
    const res = await POST(req(validBody));
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json).toEqual({ ok: false, error: 'account_not_found' });
    expect(JSON.stringify(json)).not.toMatch(/@|subject|token/i); // no email/subject/token
  });

  it('rejects an unknown plan code (uniform 400) before reaching the RPC', async () => {
    state.managerOk = true;
    const res = await POST(req({ ...validBody, planCode: 'ENTERPRISE' }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Invalid request' });
    expect(changeNorebangHostPlan).not.toHaveBeenCalled();
  });

  it('requires a non-empty reason', async () => {
    state.managerOk = true;
    const res = await POST(req({ ...validBody, reason: '   ' }));
    expect(res.status).toBe(400);
    expect(changeNorebangHostPlan).not.toHaveBeenCalled();
  });

  it('(16) an account-id manipulation still runs through the operator gate + RPC only', async () => {
    // Even a well-formed but attacker-chosen account id can ONLY be actioned by an
    // authorized operator, and only via the RPC — never a client table write.
    state.managerOk = true;
    changeNorebangHostPlan.mockResolvedValue({ ok: false, error: 'account_not_found' });
    const res = await POST(req({ ...validBody, accountId: '99999999-9999-4999-8999-999999999999' }));
    expect(res.status).toBe(404);
    expect(changeNorebangHostPlan).toHaveBeenCalledTimes(1);
  });

  it('returns 503 when plan management is not enabled', async () => {
    state.managerEnabled = false;
    state.managerOk = true;
    const res = await POST(req(validBody));
    expect(res.status).toBe(503);
    expect(changeNorebangHostPlan).not.toHaveBeenCalled();
  });
});
