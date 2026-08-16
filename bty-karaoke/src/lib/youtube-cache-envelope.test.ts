import { describe, it, expect } from 'vitest';
import { readSearchCacheEnvelope, SEARCH_CACHE_VERSION } from './youtube.server';

// BUILD 26T-R1B-R6-R1B-R1 §B/§C — the cache must never invent a fetch instant.
const items = [{ videoId: 'dQw4w9WgXcQ', title: 'T', channelTitle: 'C', thumbnailUrl: 'u' }] as never;

describe('search-cache envelope', () => {
  it('a v1 envelope returns its FACTUAL fetchedAt unchanged (control)', () => {
    const got = readSearchCacheEnvelope({ version: SEARCH_CACHE_VERSION, fetchedAt: '2026-08-01T10:00:00.000Z', items });
    expect(got!.fetchedAt).toBe('2026-08-01T10:00:00.000Z');
    expect(got!.items).toHaveLength(1);
  });

  it('M1: a LEGACY bare array yields UNKNOWN provenance — never a stamped now()', () => {
    const got = readSearchCacheEnvelope(items);
    expect(got!.items).toHaveLength(1);
    expect(got!.fetchedAt).toBeNull();     // the whole point: no invented timestamp
  });

  it('a cache hit does not move the instant forward', () => {
    const env = { version: SEARCH_CACHE_VERSION, fetchedAt: '2026-07-01T00:00:00.000Z', items };
    // Read it repeatedly — a hit is not a fetch, so the value cannot drift.
    expect(readSearchCacheEnvelope(env)!.fetchedAt).toBe('2026-07-01T00:00:00.000Z');
    expect(readSearchCacheEnvelope(env)!.fetchedAt).toBe('2026-07-01T00:00:00.000Z');
  });

  it('an unknown version is a MISS, not fresh data', () => {
    expect(readSearchCacheEnvelope({ version: 99, fetchedAt: '2026-08-01T00:00:00.000Z', items })).toBeNull();
  });

  it('a malformed envelope is a MISS rather than trusted', () => {
    expect(readSearchCacheEnvelope({ version: SEARCH_CACHE_VERSION, items })).toBeNull();       // no fetchedAt
    expect(readSearchCacheEnvelope({ version: SEARCH_CACHE_VERSION, fetchedAt: 123, items })).toBeNull();
    expect(readSearchCacheEnvelope(null)).toBeNull();
    expect(readSearchCacheEnvelope('nope')).toBeNull();
  });
});
