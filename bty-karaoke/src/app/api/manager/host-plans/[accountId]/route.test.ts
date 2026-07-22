// GET /api/manager/host-plans/[accountId] — Manager authorization + safe detail (V1).
// Pins: unauthenticated/plain-Host is a uniform 401; a non-UUID or unknown account is
// a uniform 404 (no existence leak); a Manager gets the detail; response is no-store.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const state = { managerEnabled: true, managerOk: false };
vi.mock('@/lib/manager-auth.server', () => ({
  managerEnabled: () => state.managerEnabled,
  managerAuthorized: vi.fn(async () => state.managerOk),
}));
const getHostPlanConsoleDetail = vi.fn();
vi.mock('@/lib/host-plan-console.server', () => ({
  getHostPlanConsoleDetail: (...a: unknown[]) => getHostPlanConsoleDetail(...a),
}));

import { GET } from './route';

const ACC = '1a0be5e8-90e6-40b3-a26c-7b41be0a9a8c';
const req = () => new NextRequest(`https://x/api/manager/host-plans/${ACC}`);
const ctx = (accountId: string) => ({ params: Promise.resolve({ accountId }) });

beforeEach(() => {
  state.managerEnabled = true;
  state.managerOk = false;
  getHostPlanConsoleDetail.mockReset();
});

describe('GET /api/manager/host-plans/[accountId]', () => {
  it('(4) unauthenticated / plain-Host → uniform 401, no read', async () => {
    state.managerOk = false;
    const res = await GET(req(), ctx(ACC));
    expect(res.status).toBe(401);
    expect(getHostPlanConsoleDetail).not.toHaveBeenCalled();
  });

  it('a non-UUID account id → uniform 404, no read', async () => {
    state.managerOk = true;
    const res = await GET(req(), ctx('not-a-uuid'));
    expect(res.status).toBe(404);
    expect(getHostPlanConsoleDetail).not.toHaveBeenCalled();
  });

  it('an unknown account → uniform 404', async () => {
    state.managerOk = true;
    getHostPlanConsoleDetail.mockResolvedValue(null);
    const res = await GET(req(), ctx(ACC));
    expect(res.status).toBe(404);
  });

  it('(18/19) a Manager gets the detail + no-store', async () => {
    state.managerOk = true;
    getHostPlanConsoleDetail.mockResolvedValue({ accountId: ACC, label: 'btyNorebang', assignments: [], audits: [] });
    const res = await GET(req(), ctx(ACC));
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toContain('no-store');
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.detail.label).toBe('btyNorebang');
  });
});
