// BUILD R2.5 — abuse containment behaviour.
//
// THE CLAIM UNDER TEST, in one line: a request WE refuse must cost zero YouTube quota and must
// never be mistaken for Google refusing us. Every blocked case below therefore asserts three
// things — no fetch, no durable call row, and `quotaExceeded` still false — because getting any
// one of those wrong corrupts either the grant or the evidence we will show Google.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./env.server', () => ({
  optionalEnv: (name: string) => {
    const v = process.env[name];
    return v && v.trim() ? v.trim() : undefined;
  },
}));

const serves: string[] = [];
const calls: Array<Record<string, unknown>> = [];

vi.mock('./youtube-search-telemetry.server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./youtube-search-telemetry.server')>();
  return {
    ...actual,
    recordSearchServe: vi.fn(async (d: string) => { serves.push(d); }),
    recordOutboundSearchCall: vi.fn(async (c: Record<string, unknown>) => { calls.push(c); }),
  };
});

// The budget reservation is the only thing mocked from the guard: the per-IP limiter is exercised
// directly against a fake KV further down.
let budgetGranted = true;
let budgetThrows = false;
vi.mock('./youtube-search-guard.server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./youtube-search-guard.server')>();
  return {
    ...actual,
    reserveSearchBudget: vi.fn(async () => {
      if (budgetThrows) throw new Error('db down');
      return { granted: budgetGranted, reserved: budgetGranted ? 1 : 850 };
    }),
  };
});

import { searchYoutubeWithCache, QUOTA_MARKER_KEY, SEARCH_CACHE_VERSION, type SearchKv } from './youtube.server';
import { searchRateLimitKey, cloudflareClientIp, SEARCH_IP_MAX } from './youtube-search-guard.server';

const ITEM = { videoId: 'v1', title: 'T', channelTitle: 'C', thumbnailUrl: null };
const ORIGINAL_KEY = process.env.YOUTUBE_API_KEY;

const emptyKv = (): SearchKv => ({ get: vi.fn(async () => null), put: vi.fn(async () => {}) });
const cachedKv = (): SearchKv => ({
  get: vi.fn(async (k: string) =>
    k === QUOTA_MARKER_KEY
      ? null
      : { version: SEARCH_CACHE_VERSION, fetchedAt: '2026-08-18T00:00:00.000Z', items: [ITEM] }),
  put: vi.fn(async () => {}),
});
const okFetch = () =>
  vi.fn(async () => ({
    ok: true,
    json: async () => ({ items: [{ id: { videoId: 'v1' }, snippet: { title: 'T', channelTitle: 'C' } }] }),
  }));

beforeEach(() => {
  serves.length = 0;
  calls.length = 0;
  budgetGranted = true;
  budgetThrows = false;
  process.env.YOUTUBE_API_KEY = 'test-key';
});
afterEach(() => {
  if (ORIGINAL_KEY === undefined) delete process.env.YOUTUBE_API_KEY;
  else process.env.YOUTUBE_API_KEY = ORIGINAL_KEY;
  vi.unstubAllGlobals();
});

describe('R2.5 — below the ceiling nothing changes', () => {
  it('T1. a normal cold search still goes upstream and records exactly one call', async () => {
    const fetchSpy = okFetch();
    vi.stubGlobal('fetch', fetchSpy);

    const r = await searchYoutubeWithCache('IU', emptyKv());
    expect(r.ok).toBe(true);
    expect(r.items).toHaveLength(1);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(serves).toEqual(['UPSTREAM']);
    expect(calls).toHaveLength(1);
  });

  it('T2. a cache hit still costs nothing', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const r = await searchYoutubeWithCache('IU', cachedKv());
    expect(r.items).toEqual([ITEM]);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(serves).toEqual(['CACHE_HIT']);
    expect(calls).toEqual([]);
  });
});

describe('R2.5 — the daily budget guard', () => {
  it('T7. at the ceiling a COLD search issues no request and writes no quota row', async () => {
    budgetGranted = false;
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const r = await searchYoutubeWithCache('novel query', emptyKv());
    expect(fetchSpy).not.toHaveBeenCalled();      // ZERO quota
    expect(calls).toEqual([]);                    // ZERO durable rows
    expect(serves).toEqual(['BUDGET_GUARDED']);
    expect(r.degraded).toBe(true);
    expect(r.fallbackUrl).toContain('search_query='); // the guest still has a way to sing
  });

  it('T7b. our own refusal must NEVER be dressed up as Google refusing us', async () => {
    budgetGranted = false;
    const kv = emptyKv();
    vi.stubGlobal('fetch', vi.fn());

    const r = await searchYoutubeWithCache('novel query', kv);
    // `quotaExceeded` means Google said no. Saying it here would poison the exact signal the
    // quota programme reads, and would make an internal cap look like an external outage.
    expect(r.quotaExceeded).toBe(false);
    // …and the Google circuit breaker must not be armed by our own guard.
    expect(kv.put).not.toHaveBeenCalled();
  });

  it('T6. a CACHE HIT is still served while the budget guard is active', async () => {
    budgetGranted = false;
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const r = await searchYoutubeWithCache('IU', cachedKv());
    expect(r.items).toEqual([ITEM]);   // guests keep singing through a drain
    expect(r.degraded).toBe(false);
    expect(serves).toEqual(['CACHE_HIT']);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('T9. a reservation failure fails OPEN and never causes a second fetch', async () => {
    budgetThrows = true;
    const fetchSpy = okFetch();
    vi.stubGlobal('fetch', fetchSpy);

    const r = await searchYoutubeWithCache('IU', emptyKv());
    expect(r.ok).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});

describe('R2.5 — T8: Google’s own refusal is unchanged and stays distinguishable', () => {
  it('a real quotaExceeded still trips the breaker and still reports quotaExceeded', async () => {
    const kv = emptyKv();
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false, status: 429, json: async () => ({ error: { errors: [{ reason: 'rateLimitExceeded' }] } }),
    })));

    const r = await searchYoutubeWithCache('IU', kv);
    expect(r.quotaExceeded).toBe(true);
    expect((kv.put as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe(QUOTA_MARKER_KEY);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ outcome: 'QUOTA_EXCEEDED' });
    // The two refusals are recorded under different dispositions and never merge.
    expect(serves).toEqual(['UPSTREAM']);
    expect(serves).not.toContain('BUDGET_GUARDED');
  });
});

describe('R2.5 — per-IP limiter', () => {
  it('T4. different clients get different buckets, and no raw IP appears in the key', async () => {
    const { pseudonymizeIp } = await import('./rate-limit.server');
    const a = searchRateLimitKey(await pseudonymizeIp('s', 'youtube-search', '203.0.113.7'));
    const b = searchRateLimitKey(await pseudonymizeIp('s', 'youtube-search', '198.51.100.9'));
    expect(a).not.toBe(b);
    expect(a).toMatch(/^ytrl:[0-9a-f]{32}$/);
    expect(a).not.toContain('203.0.113.7');
    expect(b).not.toContain('198.51.100.9');
  });

  it('the scope keeps a search key from colliding with an auth/PIN key for the same IP', async () => {
    const { pseudonymizeIp } = await import('./rate-limit.server');
    const search = await pseudonymizeIp('s', 'youtube-search', '203.0.113.7');
    const pin = await pseudonymizeIp('s', 'some-room-id', '203.0.113.7');
    expect(search).not.toBe(pin);
  });

  it('only the Cloudflare-set header is trusted — x-forwarded-for is client-controllable', () => {
    const h = (m: Record<string, string>) => ({ get: (k: string) => m[k] ?? null });
    expect(cloudflareClientIp(h({ 'cf-connecting-ip': '203.0.113.7' }))).toBe('203.0.113.7');
    expect(cloudflareClientIp(h({ 'x-forwarded-for': '203.0.113.7' }))).toBeNull();
    expect(cloudflareClientIp(h({}))).toBeNull();
    expect(cloudflareClientIp(h({ 'cf-connecting-ip': '   ' }))).toBeNull();
  });

  it('T3. a client over the window is refused, and refusal reaches YouTube in no way at all', async () => {
    const store = new Map<string, string>();
    const kv = {
      get: async (k: string) => store.get(k) ?? null,
      put: async (k: string, v: string) => { store.set(k, v); },
      delete: async (k: string) => { store.delete(k); },
    };
    vi.doMock('@opennextjs/cloudflare', () => ({
      getCloudflareContext: () => ({ env: { KARAOKE_SEARCH_KV: kv } }),
    }));
    process.env.KARAOKE_RATELIMIT_SECRET = 'test-secret';
    vi.resetModules();
    const guard = await import('./youtube-search-guard.server');

    const ip = '203.0.113.7';
    const verdicts: boolean[] = [];
    for (let i = 0; i < SEARCH_IP_MAX + 3; i++) {
      verdicts.push((await guard.checkSearchRateLimit(ip)).allowed);
    }
    expect(verdicts.slice(0, SEARCH_IP_MAX).every(Boolean)).toBe(true);   // generous window
    expect(verdicts.slice(SEARCH_IP_MAX)).toEqual([false, false, false]); // then closed

    // A DIFFERENT client is unaffected — one abuser cannot deny service to a room full of guests.
    expect((await guard.checkSearchRateLimit('198.51.100.9')).allowed).toBe(true);

    delete process.env.KARAOKE_RATELIMIT_SECRET;
    vi.doUnmock('@opennextjs/cloudflare');
    vi.resetModules();
  });

  it('T9b. an unavailable limiter fails OPEN (no secret, no KV, no edge IP)', async () => {
    const guard = await import('./youtube-search-guard.server');
    delete process.env.KARAOKE_RATELIMIT_SECRET;
    expect((await guard.checkSearchRateLimit('203.0.113.7')).allowed).toBe(true); // no secret
    expect((await guard.checkSearchRateLimit(null)).allowed).toBe(true);          // no edge IP
  });
});
