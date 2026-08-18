// R1 — the CACHE-ONLY read path (`searchYoutubeCachedOnly`) and the recommendations that ride on
// it. Its sibling `youtube-cache-envelope.test.ts` covers the READER (`readSearchCacheEnvelope`)
// in isolation; this file covers the CALLER that failed to use it.
//
// Kept in its own file because these are the only tests that need a real KV binding resolved
// through `@opennextjs/cloudflare`; mocking that module inside the main suite would change what
// its existing "no KV binding in the test env" assertions mean.
//
// THE DEFECT THESE PIN: the writer stores a v1 envelope, but this path used to cast the KV value
// to a bare array and test `.length`. An object has no `.length`, so a populated cache read as
// empty and guest recommendations went silently blank. Every case below therefore also asserts
// the hard invariant — the cache-only path NEVER calls fetch, whatever the cache holds.

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./env.server', () => ({
  optionalEnv: (name: string) => {
    const v = process.env[name];
    return v && v.trim() ? v.trim() : undefined;
  },
}));

// The KV the module resolves through the Cloudflare context. `store` is the cache's contents.
const store = new Map<string, unknown>();
const kv = {
  get: async (key: string, _type: 'json') => (store.has(key) ? store.get(key) : null),
  put: async (key: string, value: string) => {
    store.set(key, JSON.parse(value));
  },
};
vi.mock('@opennextjs/cloudflare', () => ({
  getCloudflareContext: () => ({ env: { KARAOKE_SEARCH_KV: kv } }),
}));

import { searchYoutubeCachedOnly, SEARCH_CACHE_VERSION } from './youtube.server';
import { getRecommendations } from './recommendations.server';

const ITEMS = [
  { videoId: 'aaaaaaaaaaa', title: 'IU - Palette', channelTitle: 'IU', thumbnailUrl: 't1' },
  { videoId: 'bbbbbbbbbbb', title: 'IU - Blueming', channelTitle: 'IU', thumbnailUrl: 't2' },
];

// `searchYoutubeCachedOnly` defaults to the karaoke style, so the key carries the 노래방 bias.
const QUERY = 'IU 인기곡';
const KEY = 'ytq:IU 인기곡 노래방';

const envelope = () => ({
  version: SEARCH_CACHE_VERSION,
  fetchedAt: '2026-08-18T00:00:00.000Z',
  items: ITEMS,
});

beforeEach(() => {
  store.clear();
  vi.unstubAllGlobals();
  process.env.YOUTUBE_API_KEY = 'test-key'; // present, to prove the key is not what gates this path
});

describe('searchYoutubeCachedOnly — reads the canonical cache envelope', () => {
  it('A. serves items from a populated v1 ENVELOPE, without calling the API', async () => {
    store.set(KEY, envelope());
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const r = await searchYoutubeCachedOnly(QUERY);
    expect(r.items.map((i) => i.videoId)).toEqual(['aaaaaaaaaaa', 'bbbbbbbbbbb']);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('B. still serves a LEGACY bare array (written before the envelope shipped)', async () => {
    store.set(KEY, ITEMS);
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const r = await searchYoutubeCachedOnly(QUERY);
    expect(r.items.map((i) => i.videoId)).toEqual(['aaaaaaaaaaa', 'bbbbbbbbbbb']);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('C. returns EMPTY for a corrupt/unrecognised cache value — and still never calls the API', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    for (const corrupt of [
      { version: 999, fetchedAt: '2026-08-18T00:00:00.000Z', items: ITEMS }, // wrong version
      { version: SEARCH_CACHE_VERSION, items: ITEMS }, // no fetchedAt
      { version: SEARCH_CACHE_VERSION, fetchedAt: '2026-08-18T00:00:00.000Z' }, // no items
      'not-json-shaped',
      42,
    ]) {
      store.set(KEY, corrupt);
      const r = await searchYoutubeCachedOnly(QUERY);
      expect(r.items).toEqual([]);
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('C2. an EMPTY envelope is a miss, not an answer', async () => {
    store.set(KEY, { version: SEARCH_CACHE_VERSION, fetchedAt: '2026-08-18T00:00:00.000Z', items: [] });
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const r = await searchYoutubeCachedOnly(QUERY);
    expect(r.items).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('carries no provenance — the cache-only path never claims a fetch instant', async () => {
    store.set(KEY, envelope());
    vi.stubGlobal('fetch', vi.fn());

    const r = await searchYoutubeCachedOnly(QUERY);
    expect(r.items).toHaveLength(2);
    expect(r.fetchedAt).toBeUndefined();
  });
});

describe('getRecommendations — resolves from cache, at ZERO search.list cost', () => {
  const SOURCE = { title: 'IU - Blueming', channelTitle: 'IU' };

  it('D. returns at least one recommendation from a populated v1-ENVELOPE cache, with zero outbound calls', async () => {
    store.set(KEY, envelope());
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const recos = await getRecommendations(SOURCE, 'bbbbbbbbbbb');
    expect(recos.length).toBeGreaterThan(0);
    // The excluded source video must never come back as its own recommendation.
    expect(recos.map((r) => r.videoId)).not.toContain('bbbbbbbbbbb');
    // THE INVARIANT: recommendations cost nothing. This assertion used to hold trivially because
    // nothing was ever returned; it must hold now that they actually resolve.
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns nothing (and still spends nothing) when no seed is cached', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const recos = await getRecommendations(SOURCE, 'bbbbbbbbbbb');
    expect(recos).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
