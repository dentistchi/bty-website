// GET /api/manager/host-plans — Manager authorization + filter pass-through (V1).
// Pins: unauthenticated/plain-Host is a uniform 401 that never queries; only a
// Manager session succeeds; plan/anomaly/search/pagination params reach the service;
// response is no-store and carries no credential.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const state = { managerEnabled: true, managerOk: false };
vi.mock('@/lib/manager-auth.server', () => ({
  managerEnabled: () => state.managerEnabled,
  managerAuthorized: vi.fn(async () => state.managerOk),
}));
const listHostPlanConsole = vi.fn();
vi.mock('@/lib/host-plan-console.server', () => ({
  listHostPlanConsole: (...a: unknown[]) => listHostPlanConsole(...a),
}));

import { GET } from './route';

const url = (qs = '') => new NextRequest(`https://x/api/manager/host-plans${qs}`);

beforeEach(() => {
  state.managerEnabled = true;
  state.managerOk = false;
  listHostPlanConsole.mockReset();
  listHostPlanConsole.mockResolvedValue({
    totals: { accounts: 3, free: 3, pro: 0, anomalies: 0 },
    page: { limit: 50, offset: 0, count: 3, total: 3 },
    hosts: [],
  });
});

describe('GET /api/manager/host-plans', () => {
  it('(1/2) unauthenticated / plain-Host → uniform 401, no query', async () => {
    state.managerOk = false;
    const res = await GET(url());
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Unauthorized' });
    expect(listHostPlanConsole).not.toHaveBeenCalled();
  });

  it('(3) a Manager session succeeds and gets the list + no-store', async () => {
    state.managerOk = true;
    const res = await GET(url());
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toContain('no-store');
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.totals).toEqual({ accounts: 3, free: 3, pro: 0, anomalies: 0 });
  });

  it('(14/15/16/17/13) forwards plan / anomaly / search / pagination params', async () => {
    state.managerOk = true;
    await GET(url('?plan=pro&anomaly=1&q=chi&limit=10&offset=20'));
    expect(listHostPlanConsole).toHaveBeenCalledWith({
      plan: 'PRO',
      anomalyOnly: true,
      q: 'chi',
      limit: 10,
      offset: 20,
    });
  });

  it('an unrecognized plan value falls back to ALL', async () => {
    state.managerOk = true;
    await GET(url('?plan=enterprise'));
    expect(listHostPlanConsole).toHaveBeenCalledWith(expect.objectContaining({ plan: 'ALL' }));
  });
});
