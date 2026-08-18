// BUILD R2 — the branch-to-disposition contract for YouTube `search.list` quota telemetry.
//
// THE INVARIANT UNDER TEST: a durable quota row may exist ONLY when BTY actually issued one
// outbound `search.list` HTTP request. Every zero-quota exit — gated, cache hit, open breaker —
// must count a VISIBLE SEARCH and nothing else. These tests assert the negative (`no call row`)
// at least as hard as the positive, because an over-count is what would make us ask Google for a
// quota increase we do not need.
//
// The sinks are mocked: this file pins WHICH sink is called for WHICH branch and HOW MANY TIMES.
// The database side (RLS, append-only, duplicate call_id, Pacific-day aggregation) is proven
// against real Postgres in the migration gate, and the SQL itself is pinned by
// youtube-search-quota-migration.schema.test.ts.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./env.server', () => ({
  optionalEnv: (name: string) => {
    const v = process.env[name];
    return v && v.trim() ? v.trim() : undefined;
  },
}));

const serves: string[] = [];
const calls: Array<Record<string, unknown>> = [];
let serveThrows = false;
let callThrows = false;

vi.mock('./youtube-search-telemetry.server', async (importOriginal) => {
  // The CLASSIFIER is pure and is the real thing — mocking it would let a mapping bug pass.
  const actual = await importOriginal<typeof import('./youtube-search-telemetry.server')>();
  return {
    ...actual,
    recordSearchServe: vi.fn(async (d: string) => {
      serves.push(d);
      if (serveThrows) throw new Error('telemetry down');
    }),
    recordOutboundSearchCall: vi.fn(async (c: Record<string, unknown>) => {
      calls.push(c);
      if (callThrows) throw new Error('telemetry down');
    }),
  };
});

import { searchYoutubeWithCache, QUOTA_MARKER_KEY, SEARCH_CACHE_VERSION, type SearchKv } from './youtube.server';
import { classifySearchCallOutcome } from './youtube-search-telemetry.server';

const ITEM = { videoId: 'v1', title: 'T', channelTitle: 'C', thumbnailUrl: null };
const ORIGINAL_KEY = process.env.YOUTUBE_API_KEY;

const emptyKv = (): SearchKv => ({ get: vi.fn(async () => null), put: vi.fn(async () => {}) });
const okFetch = () =>
  vi.fn(async () => ({
    ok: true,
    json: async () => ({ items: [{ id: { videoId: 'v1' }, snippet: { title: 'T', channelTitle: 'C' } }] }),
  }));
const errFetch = (status: number, reason = '') =>
  vi.fn(async () => ({ ok: false, status, json: async () => ({ error: { errors: [{ reason }] } }) }));

beforeEach(() => {
  serves.length = 0;
  calls.length = 0;
  serveThrows = false;
  callThrows = false;
  process.env.YOUTUBE_API_KEY = 'test-key';
});
afterEach(() => {
  if (ORIGINAL_KEY === undefined) delete process.env.YOUTUBE_API_KEY;
  else process.env.YOUTUBE_API_KEY = ORIGINAL_KEY;
  vi.unstubAllGlobals();
});

describe('R2 — zero-quota branches count a visible search and NOTHING else', () => {
  it('H1. GATED: no credential → GATED serve, no call row, no fetch', async () => {
    delete process.env.YOUTUBE_API_KEY;
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const r = await searchYoutubeWithCache('IU', emptyKv());
    expect(r.gated).toBe(true);
    expect(serves).toEqual(['GATED']);
    expect(calls).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('H2. CACHE_HIT: v1 envelope in KV → CACHE_HIT serve, no call row, no fetch', async () => {
    const kv: SearchKv = {
      get: vi.fn(async () => ({
        version: SEARCH_CACHE_VERSION,
        fetchedAt: '2026-08-18T00:00:00.000Z',
        items: [ITEM],
      })),
      put: vi.fn(async () => {}),
    };
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const r = await searchYoutubeWithCache('IU', kv);
    expect(r.items).toEqual([ITEM]);
    expect(serves).toEqual(['CACHE_HIT']);
    expect(calls).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('H3. BREAKER_OPEN: marker set → BREAKER_OPEN serve, no call row, no fetch', async () => {
    const kv: SearchKv = {
      get: vi.fn(async (k: string) => (k === QUOTA_MARKER_KEY ? true : null)),
      put: vi.fn(async () => {}),
    };
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const r = await searchYoutubeWithCache('IU', kv);
    expect(r.quotaExceeded).toBe(true);
    expect(serves).toEqual(['BREAKER_OPEN']);
    expect(calls).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('R2 — one outbound request = exactly one durable quota row', () => {
  it('H4. success → UPSTREAM serve + ONE row, outcome OK, style carried', async () => {
    const fetchSpy = okFetch();
    vi.stubGlobal('fetch', fetchSpy);

    await searchYoutubeWithCache('IU', emptyKv(), { style: 'mr' });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(serves).toEqual(['UPSTREAM']);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ outcome: 'OK', style: 'mr', httpStatus: null });
    expect(typeof calls[0].callId).toBe('string');
    expect((calls[0].latencyMs as number) >= 0).toBe(true);
  });

  it('H5. quotaExceeded → ONE row QUOTA_EXCEEDED, and the breaker still trips', async () => {
    const kv = emptyKv();
    vi.stubGlobal('fetch', errFetch(429, 'rateLimitExceeded'));

    const r = await searchYoutubeWithCache('IU', kv);
    expect(r.quotaExceeded).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ outcome: 'QUOTA_EXCEEDED', httpStatus: 429 });
    // Existing behaviour preserved: the marker is still written.
    expect((kv.put as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe(QUOTA_MARKER_KEY);
  });

  it('H6. generic 4xx → ONE row HTTP_4XX', async () => {
    vi.stubGlobal('fetch', errFetch(400, 'badRequest'));
    await searchYoutubeWithCache('IU', emptyKv());
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ outcome: 'HTTP_4XX', httpStatus: 400, upstreamReason: 'badRequest' });
  });

  it('H7. 5xx → ONE row HTTP_5XX', async () => {
    vi.stubGlobal('fetch', errFetch(503));
    await searchYoutubeWithCache('IU', emptyKv());
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ outcome: 'HTTP_5XX', httpStatus: 503 });
  });

  it('H8. network failure → ONE row NETWORK_ERROR with no status', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('network down'); }));
    await searchYoutubeWithCache('IU', emptyKv());
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ outcome: 'NETWORK_ERROR', httpStatus: null });
  });

  it('a second search mints a DIFFERENT call_id — two real calls count twice', async () => {
    vi.stubGlobal('fetch', okFetch());
    await searchYoutubeWithCache('IU', emptyKv());
    await searchYoutubeWithCache('BTS', emptyKv());
    expect(calls).toHaveLength(2);
    expect(calls[0].callId).not.toBe(calls[1].callId);
  });
});

describe('R2 — H9: telemetry is fail-open', () => {
  it('a telemetry failure changes neither the response nor the number of YouTube fetches', async () => {
    const fetchSpy = okFetch();
    vi.stubGlobal('fetch', fetchSpy);
    serveThrows = true;
    callThrows = true;

    const r = await searchYoutubeWithCache('IU', emptyKv());
    expect(r.ok).toBe(true);
    expect(r.degraded).toBe(false);
    expect(r.items).toHaveLength(1);
    expect(fetchSpy).toHaveBeenCalledTimes(1); // no retry, no second unit spent
  });

  it('a telemetry failure on a CACHE HIT must not fall through into a paid fetch', async () => {
    // The trap this pins: the cache read sits in a try/catch, so a throwing telemetry call placed
    // inside it would be swallowed and the search would proceed to spend a real quota unit.
    const kv: SearchKv = {
      get: vi.fn(async () => ({
        version: SEARCH_CACHE_VERSION,
        fetchedAt: '2026-08-18T00:00:00.000Z',
        items: [ITEM],
      })),
      put: vi.fn(async () => {}),
    };
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    serveThrows = true;

    const r = await searchYoutubeWithCache('IU', kv);
    expect(r.items).toEqual([ITEM]);
    expect(fetchSpy).not.toHaveBeenCalled(); // ZERO quota, even with telemetry broken
    expect(calls).toEqual([]);
  });

  it('a telemetry failure while GATED still returns the gated response', async () => {
    delete process.env.YOUTUBE_API_KEY;
    serveThrows = true;
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const r = await searchYoutubeWithCache('IU', emptyKv());
    expect(r.gated).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('R2 — H12: the recommendation path is invisible to quota telemetry', () => {
  it('a cache-only read records NO serve and NO call row', async () => {
    // A recommendation resolution is not a VISIBLE SEARCH; counting it would inflate the
    // efficiency denominator and understate calls-per-search. It also spends no quota, so it must
    // never touch the call table.
    const { searchYoutubeCachedOnly } = await import('./youtube.server');
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const r = await searchYoutubeCachedOnly('IU 인기곡');
    expect(r.items).toEqual([]);      // no KV binding in this env
    expect(serves).toEqual([]);
    expect(calls).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('R2 — outcome classifier (pure)', () => {
  it('quota wins over the raw status, because 403/429 would otherwise read as a generic failure', () => {
    expect(classifySearchCallOutcome(403, true)).toBe('QUOTA_EXCEEDED');
    expect(classifySearchCallOutcome(429, true)).toBe('QUOTA_EXCEEDED');
  });
  it('separates "YouTube answered badly" from "we never reached YouTube"', () => {
    expect(classifySearchCallOutcome(500, false)).toBe('HTTP_5XX');
    expect(classifySearchCallOutcome(503, false)).toBe('HTTP_5XX');
    expect(classifySearchCallOutcome(400, false)).toBe('HTTP_4XX');
    expect(classifySearchCallOutcome(403, false)).toBe('HTTP_4XX');
    expect(classifySearchCallOutcome(undefined, false)).toBe('NETWORK_ERROR');
    expect(classifySearchCallOutcome(null, false)).toBe('NETWORK_ERROR');
  });
});
