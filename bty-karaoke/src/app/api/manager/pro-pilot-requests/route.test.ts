// GET /api/manager/pro-pilot-requests — operator-gated read-only list (§13 7).

import { describe, it, expect, vi, beforeEach } from 'vitest';

const state = { enabled: true, ok: false };
vi.mock('@/lib/manager-auth.server', () => ({
  managerEnabled: () => state.enabled,
  managerAuthorized: vi.fn(async () => state.ok),
}));
const listProPilotRequests = vi.fn();
vi.mock('@/lib/pro-pilot.server', () => ({ listProPilotRequests: (...a: unknown[]) => listProPilotRequests(...a) }));

import { GET } from './route';

function req(url = 'https://x/api/manager/pro-pilot-requests') {
  return new Request(url) as unknown as import('next/server').NextRequest;
}

beforeEach(() => { state.enabled = true; state.ok = false; listProPilotRequests.mockReset(); });

describe('GET /api/manager/pro-pilot-requests', () => {
  it('unauthenticated / plain Host → uniform 401, never reads the list', async () => {
    state.ok = false;
    const res = await GET(Object.assign(req(), { nextUrl: new URL('https://x/api/manager/pro-pilot-requests') }));
    expect(res.status).toBe(401);
    expect(listProPilotRequests).not.toHaveBeenCalled();
  });

  it('(7) an authorized operator gets the pending list', async () => {
    state.ok = true;
    listProPilotRequests.mockResolvedValue({
      totals: { total: 1, pending: 1, approved: 0, declined: 0, uniqueAccounts: 1 },
      requests: [{ requestId: 'r1', status: 'PENDING' }],
    });
    const url = new URL('https://x/api/manager/pro-pilot-requests?status=PENDING');
    const res = await GET(Object.assign(req(url.toString()), { nextUrl: url }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.totals.pending).toBe(1);
    expect(listProPilotRequests).toHaveBeenCalledWith({ status: 'PENDING' });
  });

  it('503 when manager is not enabled', async () => {
    state.enabled = false; state.ok = true;
    const url = new URL('https://x/api/manager/pro-pilot-requests');
    const res = await GET(Object.assign(req(), { nextUrl: url }));
    expect(res.status).toBe(503);
  });
});
