// BUILD R3 — the service that reads the aggregation RPC.
//
// Its whole job is to pass the RPC's numbers through unchanged and add only presentation. The two
// pins that matter: it must NEVER invent a zero when the read fails, and it must never recompute a
// quota figure the RPC already stated.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const rpc = vi.fn();
vi.mock('./supabase.server', () => ({ karaokeDb: () => ({ rpc }) }));

import { getYoutubeUsage } from './youtube-usage.server';

const RPC_DOC = {
  bucket: 'search_queries',
  endpoint: 'search.list',
  timezone: 'America/Los_Angeles',
  generated_at: '2026-08-19T02:00:00+00:00',
  today: {
    day: '2026-08-18', day_start: '2026-08-18T07:00:00+00:00', day_end: '2026-08-19T07:00:00+00:00',
    calls: 42, limit: 1000, remaining: 958, usage_pct: 4.2,
    ok: 40, quota_exceeded: 1, http_4xx: 1, http_5xx: 0, network_error: 0,
    last_successful_at: '2026-08-19T01:00:09+00:00',
  },
  efficiency: {
    visible_searches: 100, cache_hits: 58, upstream: 42, breaker_open: 0, gated: 0,
    cache_hit_rate: 0.58, calls_per_visible_search: 0.42,
  },
  blocked: { rate_limited: 6, budget_guarded: 0 },
  budget: { reserved: 42, soft_ceiling: 850, hard_reserve: 150 },
  trend: {
    daily_7: [{ day: '2026-08-18', calls: 42 }],
    daily_30: [{ day: '2026-07-21', calls: 7 }],
    peak_hour: { hour_utc: '2026-08-18T23:00:00+00:00', calls: 9 },
  },
};

beforeEach(() => {
  rpc.mockReset();
  rpc.mockResolvedValue({ data: RPC_DOC, error: null });
});

describe('R3 — the service is a faithful projection', () => {
  it('calls the aggregation RPC once and takes its numbers verbatim', async () => {
    const v = await getYoutubeUsage(30);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('karaoke_youtube_search_usage', { p_trend_days: 30 });
    expect(v.today.calls).toBe(42);
    expect(v.today.remaining).toBe(958);      // the RPC's own figure, not recomputed
    expect(v.today.usagePercent).toBe(4.2);
    expect(v.efficiency.visibleSearches).toBe(100);
    expect(v.blocked.rateLimited).toBe(6);
    expect(v.today.quotaExceeded).toBe(1);
  });

  it('adds only presentation: the band, per-day percentages and a Pacific peak label', async () => {
    const v = await getYoutubeUsage();
    expect(v.today.status).toBe('NORMAL');
    expect(v.trend.daily7[0]).toEqual({ day: '2026-08-18', calls: 42, percent: 4.2 });
    expect(v.trend.peakHour?.pacificLabel).toMatch(/Aug 18.*PT/);
    expect(v.budget.reserveRemaining).toBe(808); // 850 − 42
  });

  it('THROWS on an RPC error — a zeroed view would be indistinguishable from a quiet day', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'boom' } });
    await expect(getYoutubeUsage()).rejects.toThrow('youtube_usage_unavailable');
  });

  it('THROWS when the RPC returns nothing at all', async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    await expect(getYoutubeUsage()).rejects.toThrow('youtube_usage_unavailable');
  });

  it('a genuinely empty day projects as zeroes, not as an error', async () => {
    rpc.mockResolvedValue({
      data: { ...RPC_DOC, today: { ...RPC_DOC.today, calls: 0, remaining: 1000, usage_pct: 0, ok: 0, last_successful_at: null } },
      error: null,
    });
    const v = await getYoutubeUsage();
    expect(v.today.calls).toBe(0);
    expect(v.today.remaining).toBe(1000);
    expect(v.today.lastSuccessfulAt).toBeNull();
    expect(v.today.status).toBe('NORMAL');
  });

  it('bands a high day as CRITICAL from the RPC percentage', async () => {
    rpc.mockResolvedValue({
      data: { ...RPC_DOC, today: { ...RPC_DOC.today, calls: 960, remaining: 40, usage_pct: 96 } },
      error: null,
    });
    expect((await getYoutubeUsage()).today.status).toBe('CRITICAL');
  });

  it('reads no videos.list figure — that bucket has no representation here', async () => {
    const v = await getYoutubeUsage();
    expect(JSON.stringify(v)).not.toMatch(/videos/i);
    expect(v.endpoint).toBe('search.list');
    expect(v.bucket).toBe('search_queries');
  });
});
