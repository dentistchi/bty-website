// BUILD R3 — GET /api/manager/youtube-usage.
//
// Pins the two properties this endpoint exists to have: it reveals NOTHING without the existing
// Manager session, and it is strictly read-only — a monitoring surface that spent quota, wrote a
// row, or ran a search would corrupt the very evidence it reports.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const state = { managerEnabled: true, managerOk: false };
vi.mock('@/lib/manager-auth.server', () => ({
  managerEnabled: () => state.managerEnabled,
  managerAuthorized: vi.fn(async () => state.managerOk),
}));
const getYoutubeUsage = vi.fn();
vi.mock('@/lib/youtube-usage.server', () => ({
  getYoutubeUsage: (...a: unknown[]) => getYoutubeUsage(...a),
}));

import { GET } from './route';

const url = () => new NextRequest('https://x/api/manager/youtube-usage');

const USAGE = {
  bucket: 'search_queries',
  endpoint: 'search.list',
  timezone: 'America/Los_Angeles',
  today: { calls: 42, limit: 1000, remaining: 958, usagePercent: 4.2, status: 'NORMAL' },
  efficiency: { visibleSearches: 100, cacheHits: 58, upstream: 42 },
  blocked: { rateLimited: 6, budgetGuarded: 0 },
  budget: { reserved: 42, softCeiling: 850, hardReserve: 150, reserveRemaining: 808 },
  trend: { daily7: [], daily30: [], peakHour: null },
};

beforeEach(() => {
  state.managerEnabled = true;
  state.managerOk = false;
  getYoutubeUsage.mockReset();
  getYoutubeUsage.mockResolvedValue(USAGE);
});

describe('GET /api/manager/youtube-usage', () => {
  it('(2) unauthenticated → uniform 401 that leaks no telemetry at all', async () => {
    state.managerOk = false;
    const res = await GET(url());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({ error: 'Unauthorized' });
    // Not a count, not a date, not a hint that any data exists.
    expect(JSON.stringify(body)).not.toMatch(/calls|quota|search|1000|limit/i);
    expect(getYoutubeUsage).not.toHaveBeenCalled();
  });

  it('(1) a Manager session gets the usage document, no-store', async () => {
    state.managerOk = true;
    const res = await GET(url());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.usage.today.calls).toBe(42);
    expect(body.usage.today.limit).toBe(1000);
    expect(res.headers.get('cache-control')).toContain('no-store');
    expect(getYoutubeUsage).toHaveBeenCalledTimes(1);
  });

  it('is a pass-through: the route recomputes no quota math of its own', async () => {
    state.managerOk = true;
    const body = await (await GET(url())).json();
    // Every number is exactly what the aggregation RPC returned, so the console can never drift
    // from the evidence we would submit.
    expect(body.usage).toEqual(USAGE);
  });

  it('(20) an unreadable RPC is 502 — never a 200 full of zeros', async () => {
    state.managerOk = true;
    getYoutubeUsage.mockRejectedValue(new Error('youtube_usage_unavailable'));
    const res = await GET(url());
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body).toEqual({ error: 'Usage data is unavailable.' });
    // A zeroed payload would be indistinguishable from a quiet day.
    expect(body).not.toHaveProperty('usage');
  });

  it('never leaks the upstream error text (which can carry connection/role detail)', async () => {
    state.managerOk = true;
    getYoutubeUsage.mockRejectedValue(new Error('connection to postgres://user:pw@host failed'));
    const body = await (await GET(url())).json();
    expect(JSON.stringify(body)).not.toMatch(/postgres|pw@|connection/i);
  });

  it('reports 503 when the manager feature is not configured, and still queries nothing', async () => {
    state.managerEnabled = false;
    state.managerOk = true;
    const res = await GET(url());
    expect(res.status).toBe(503);
    expect(getYoutubeUsage).not.toHaveBeenCalled();
  });
});
