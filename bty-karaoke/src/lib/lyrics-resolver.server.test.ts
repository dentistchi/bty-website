// Automatic lyrics resolver — core behavior with injected deps (no network, no DB
// for the core) + the manual-override precedence guard against a fake Supabase.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  resolveLyricsFor,
  parseLrclibResults,
  type ResolverDeps,
  type LyricsKv,
} from './lyrics-resolver.server';
import type { LyricsCandidate } from '@/domain/lyrics';

function memKv(): LyricsKv & { store: Map<string, string> } {
  const store = new Map<string, string>();
  return {
    store,
    async get(key: string) {
      const v = store.get(key);
      return v ? JSON.parse(v) : null;
    },
    async put(key: string, value: string) {
      store.set(key, value);
    },
  };
}

const IU_MATCH: LyricsCandidate = {
  trackName: 'Love wins all', artistName: 'IU', instrumental: false,
  plainLyrics: '내가 시력을 잃어가도\n너를 알아볼 수 있을까', syncedLyrics: '[00:12.00] 내가 시력을 잃어가도',
};

const inputs = { youtubeTitle: 'IU(아이유) _ Love wins all (Official MV)', channelTitle: '1theK' };

describe('resolveLyricsFor', () => {
  it('normalizes → provider → high-confidence match → available, and positive-caches', async () => {
    const kv = memKv();
    const fetchCandidates = vi.fn(async () => [IU_MATCH]);
    const r = await resolveLyricsFor(inputs, { fetchCandidates, kv });
    expect(r.status).toBe('available');
    expect(r.source).toBe('lrclib');
    expect(r.text).toContain('시력을 잃어가도');
    expect(fetchCandidates).toHaveBeenCalledTimes(1);
    expect([...kv.store.keys()][0]).toMatch(/^lrc:v1:/);
  });

  it('reuses a positive cache hit WITHOUT calling the provider (repeat song)', async () => {
    const kv = memKv();
    const fetchCandidates = vi.fn(async () => [IU_MATCH]);
    await resolveLyricsFor(inputs, { fetchCandidates, kv }); // warms cache
    const again = await resolveLyricsFor(inputs, { fetchCandidates, kv });
    expect(again.status).toBe('available');
    expect(again.reason).toBe('cache-hit');
    expect(fetchCandidates).toHaveBeenCalledTimes(1); // NOT called the second time
  });

  it('honors a negative cache hit without calling the provider', async () => {
    const kv = memKv();
    const fetchCandidates = vi.fn(async () => []); // first call → no match → negative cache
    await resolveLyricsFor(inputs, { fetchCandidates, kv });
    const again = await resolveLyricsFor(inputs, { fetchCandidates, kv });
    expect(again.status).toBe('unavailable');
    expect(again.reason).toBe('cache-negative');
    expect(fetchCandidates).toHaveBeenCalledTimes(1);
  });

  it('returns unavailable + negative-caches when nothing scores high enough', async () => {
    const kv = memKv();
    const wrong: LyricsCandidate = { trackName: '완전 다른 곡', artistName: '다른 가수', instrumental: false, plainLyrics: 'x' };
    const r = await resolveLyricsFor(inputs, { fetchCandidates: async () => [wrong], kv });
    expect(r.status).toBe('unavailable');
    expect(r.reason).toBe('no-match');
    expect(r.transient).toBe(false); // a genuine no-match (provider responded)
    expect(kv.store.size).toBe(1); // negative entry written
  });

  it('an empty (0-result) provider response is a genuine no-match, negative-cached', async () => {
    const kv = memKv();
    const r = await resolveLyricsFor(inputs, { fetchCandidates: async () => [], kv });
    expect(r.status).toBe('unavailable');
    expect(r.reason).toBe('no-match');
    expect(r.transient).toBe(false);
    expect(kv.store.size).toBe(1);
  });

  it('does NOT search on a low-confidence normalization (never a wrong query)', async () => {
    const fetchCandidates = vi.fn(async () => [IU_MATCH]);
    const r = await resolveLyricsFor({ youtubeTitle: '(TJ.12345)', channelTitle: 'TJ' }, { fetchCandidates, kv: null });
    expect(r.status).toBe('unavailable');
    expect(fetchCandidates).not.toHaveBeenCalled();
  });

  it('treats a provider timeout as transient unavailable and does NOT negative-cache', async () => {
    const kv = memKv();
    const fetchCandidates = (_q: unknown, signal: AbortSignal) =>
      new Promise<LyricsCandidate[]>((_res, rej) => {
        signal.addEventListener('abort', () => rej(new DOMException('aborted', 'AbortError')));
      });
    const r = await resolveLyricsFor(inputs, { fetchCandidates, kv, timeoutMs: 50 });
    expect(r.status).toBe('unavailable');
    expect(r.reason).toBe('timeout');
    expect(r.transient).toBe(true); // retryable — NOT a no-match
    expect(kv.store.size).toBe(0); // transient → not cached
  });

  it('treats a provider error (429/5xx/network) as TRANSIENT, not a no-match', async () => {
    const kv = memKv();
    const r = await resolveLyricsFor(inputs, { fetchCandidates: async () => { throw new Error('lrclib_429'); }, kv });
    expect(r.status).toBe('unavailable');
    expect(r.reason).toBe('provider-error');
    expect(r.transient).toBe(true);
    expect(kv.store.size).toBe(0); // a rate-limit must NOT create a negative-cache entry
  });

  it('rejects an instrumental-only best candidate (no words) as unavailable', async () => {
    const inst: LyricsCandidate = { trackName: 'Love wins all', artistName: 'IU', instrumental: true, plainLyrics: null, syncedLyrics: null };
    const r = await resolveLyricsFor(inputs, { fetchCandidates: async () => [inst], kv: null });
    expect(r.status).toBe('unavailable');
  });
});

describe('parseLrclibResults', () => {
  it('maps well-formed rows and tolerates malformed input', () => {
    expect(parseLrclibResults('nope')).toEqual([]);
    expect(parseLrclibResults([null, 3, 'x'])).toEqual([]);
    const [c] = parseLrclibResults([{ trackName: 'A', artistName: 'B', instrumental: false, plainLyrics: 'L' }]);
    expect(c).toMatchObject({ trackName: 'A', artistName: 'B', plainLyrics: 'L' });
  });
});

// ── Manual-override precedence at the DB layer ──────────────────────────────
const dbState = { row: null as Record<string, unknown> | null };
vi.mock('./supabase.server', () => ({
  karaokeDb: () => {
    const b: Record<string, unknown> = {};
    Object.assign(b, {
      from: () => b,
      select: () => b,
      update: () => b,
      eq: () => b,
      neq: () => b,
      is: () => b,
      maybeSingle: async () => ({ data: dbState.row, error: null }),
    });
    return b;
  },
}));

describe('resolvePlayingLyrics — manual override precedence', () => {
  beforeEach(() => { dbState.row = null; });

  it('never touches the provider when lyrics_source = admin', async () => {
    const { resolvePlayingLyrics } = await import('./lyrics-resolver.server');
    dbState.row = { youtube_title: 'x', youtube_channel_title: 'y', search_query: null, lyrics_source: 'admin', lyrics_status: 'available', lyrics_resolved_at: null };
    const fetchCandidates = vi.fn(async () => [IU_MATCH]);
    const view = await resolvePlayingLyrics('room-1', 'req-1', { fetchCandidates, kv: null });
    expect(view).toBeNull();
    expect(fetchCandidates).not.toHaveBeenCalled();
  });

  it('returns null (no change) when the playing row is not found', async () => {
    const { resolvePlayingLyrics } = await import('./lyrics-resolver.server');
    dbState.row = null;
    const fetchCandidates = vi.fn(async () => [IU_MATCH]);
    const view = await resolvePlayingLyrics('room-1', 'gone', { fetchCandidates, kv: null });
    expect(view).toBeNull();
    expect(fetchCandidates).not.toHaveBeenCalled();
  });
});
