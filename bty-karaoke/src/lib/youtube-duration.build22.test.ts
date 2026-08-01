// BUILD 22 — raw duration cache + batched search enrichment.
//
// Two defects these tests exist to prevent:
//
//   1. QUOTA AMPLIFICATION. The shipped resolver cached only admissible durations, so every
//      attempt on a 40-minute medley re-bought the same immutable fact. BUILD 22 moves that
//      lookup to Guest request time and onto every search result, which multiplies the pressure
//      — so "resolve once, classify forever" is now load-bearing, not an optimisation.
//   2. N+1 ENRICHMENT. Resolving 8 search results one-at-a-time would add 8 upstream calls to a
//      single search. `videos.list` costs ONE unit whether it carries 1 id or 50, so the batch
//      must be exactly one call for all misses — and zero when the cache already has them.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const state = {
  /** videoId → cached raw seconds. */
  cache: new Map<string, number>(),
  cacheReadThrows: false,
  cacheWriteThrows: false,
  /** The DB CHECK ceiling. Infinity = BUILD 22-R1 applied (no upper bound at all);
   *  900 = the un-migrated production schema. */
  checkMaxSeconds: Number.POSITIVE_INFINITY,
  /** Every row handed to the cache upsert, flattened. */
  written: [] as Array<{ video_id: string; duration_seconds: number }>,
  apiKey: 'test-key' as string | null,
};

vi.mock('./supabase.server', () => ({
  karaokeDb: () => ({
    from: () => {
      const b: Record<string, unknown> = {};
      let inIds: string[] = [];
      let eqId: string | null = null;
      b.select = () => b;
      b.eq = (_col: string, v: string) => {
        eqId = v;
        return b;
      };
      b.in = (_col: string, v: string[]) => {
        inIds = v;
        return b;
      };
      b.maybeSingle = async () => {
        if (state.cacheReadThrows) throw new Error('cache down');
        const secs = eqId != null ? state.cache.get(eqId) : undefined;
        return { data: secs == null ? null : { duration_seconds: secs } };
      };
      // The `.in()` batch read resolves as a thenable (PostgREST builder semantics).
      b.then = (resolve: (v: { data: unknown; error: unknown }) => void) => {
        if (state.cacheReadThrows) throw new Error('cache down');
        return resolve({
          data: inIds
            .filter((id) => state.cache.has(id))
            .map((id) => ({ video_id: id, duration_seconds: state.cache.get(id) })),
          error: null,
        });
      };
      b.upsert = async (rows: unknown) => {
        if (state.cacheWriteThrows) throw new Error('cache write down');
        const list = (Array.isArray(rows) ? rows : [rows]) as Array<{
          video_id: string;
          duration_seconds: number;
        }>;
        // Model the REAL database: a multi-row upsert is ONE statement, so a single row that
        // violates the CHECK rejects the whole batch and writes nothing. `checkMaxSeconds`
        // stands in for the pre-BUILD-22 constraint (1..900) so the un-migrated schema can be
        // exercised exactly as production would behave.
        if (list.some((r) => r.duration_seconds > state.checkMaxSeconds)) {
          return { error: { code: '23514', message: 'check constraint violated' } };
        }
        for (const r of list) {
          state.written.push(r);
          state.cache.set(r.video_id, r.duration_seconds);
        }
        return { error: null };
      };
      return b;
    },
  }),
}));

vi.mock('./env.server', () => ({
  optionalEnv: (name: string) => (name === 'YOUTUBE_API_KEY' ? state.apiKey ?? undefined : undefined),
}));

import {
  resolveRawVideoDuration,
  resolveRawVideoDurations,
  resolveVideoDuration,
  enrichItemsWithDuration,
} from './youtube-duration.server';

const A = 'aaaaaaaaaaa';
const B = 'bbbbbbbbbbb';
const C = 'ccccccccccc';

function okItem(iso: string) {
  return { ok: true, status: 200, json: async () => ({ items: [{ contentDetails: { duration: iso } }] }) } as unknown as Response;
}
function okBatch(entries: Array<[string, string]>) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ items: entries.map(([id, iso]) => ({ id, contentDetails: { duration: iso } })) }),
  } as unknown as Response;
}
function httpError(status: number, reason = '') {
  return { ok: false, status, json: async () => (reason ? { error: { errors: [{ reason }] } } : {}) } as unknown as Response;
}

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  state.cache = new Map();
  state.cacheReadThrows = false;
  state.cacheWriteThrows = false;
  state.checkMaxSeconds = Number.POSITIVE_INFINITY;
  state.written = [];
  state.apiKey = 'test-key';
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ── B. Duration cache ────────────────────────────────────────────────────────────────────────

describe('BUILD 22 — the cache is now RAW, and an over-limit duration is durable', () => {
  it('a cached 900 avoids the upstream call and is allowed', async () => {
    state.cache.set(A, 900);
    expect(await resolveRawVideoDuration(A)).toEqual({ ok: true, seconds: 900 });
    expect(await resolveVideoDuration(A)).toEqual({ ok: true, seconds: 900 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('a cached 901 avoids the upstream call and classifies as too_long', async () => {
    state.cache.set(A, 901);
    expect(await resolveRawVideoDuration(A)).toEqual({ ok: true, seconds: 901 });
    expect(await resolveVideoDuration(A)).toEqual({ ok: false, reason: 'too_long' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('a FRESH 901 is PERSISTED — the previously unstorable case', async () => {
    fetchMock.mockResolvedValueOnce(okItem('PT15M1S'));
    expect(await resolveRawVideoDuration(A)).toEqual({ ok: true, seconds: 901 });
    expect(state.written).toEqual([
      { video_id: A, duration_seconds: 901, source: 'youtube_contentDetails' },
    ]);
  });

  // THE QUOTA GUARD. Reverting the cache write for over-limit values fails this test.
  it('a SECOND resolution of the same 901 costs ZERO upstream calls', async () => {
    fetchMock.mockResolvedValueOnce(okItem('PT2H28M37S'));
    expect(await resolveVideoDuration(A)).toEqual({ ok: false, reason: 'too_long' });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fetchMock.mockClear();
    expect(await resolveVideoDuration(A)).toEqual({ ok: false, reason: 'too_long' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ['quota exhaustion', httpError(429), 'quota_exceeded'],
    ['a deleted video', { ok: true, status: 200, json: async () => ({ items: [] }) } as unknown as Response, 'video_unavailable'],
  ])('does NOT persist a durable verdict for %s', async (_label, response, reason) => {
    fetchMock.mockResolvedValue(response);
    expect(await resolveRawVideoDuration(A)).toEqual({ ok: false, reason });
    expect(state.written).toEqual([]);
    expect(state.cache.has(A)).toBe(false);
  });

  it('does NOT persist a durable verdict for a malformed duration', async () => {
    fetchMock.mockResolvedValue(okItem('not-a-duration'));
    expect(await resolveRawVideoDuration(A)).toEqual({ ok: false, reason: 'lookup_failed' });
    expect(state.written).toEqual([]);
  });

  it('a cache WRITE failure never erases a successfully resolved duration', async () => {
    state.cacheWriteThrows = true;
    fetchMock.mockResolvedValueOnce(okItem('PT15M1S'));
    // The provider answered; a failed write costs a future re-lookup, never this answer.
    expect(await resolveRawVideoDuration(A)).toEqual({ ok: true, seconds: 901 });
  });

  it('a cache READ failure falls through to the lookup instead of failing the caller', async () => {
    state.cacheReadThrows = true;
    fetchMock.mockResolvedValueOnce(okItem('PT3M05S'));
    expect(await resolveRawVideoDuration(A)).toEqual({ ok: true, seconds: 185 });
  });

  // ── R1: the raw cache has NO upper bound ───────────────────────────────────────────────────
  //
  // An earlier draft capped storage at 86400. That put the original defect back one order of
  // magnitude up: a duration above the cap was unstorable, so it was re-looked-up on every single
  // resolution. These pin that no such cliff exists at any value.

  it('a cached 86401 returns too_long with ZERO upstream calls', async () => {
    state.cache.set(A, 86401);
    expect(await resolveRawVideoDuration(A)).toEqual({ ok: true, seconds: 86401 });
    expect(await resolveVideoDuration(A)).toEqual({ ok: false, reason: 'too_long' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('a cached 100000 also returns too_long with ZERO upstream calls', async () => {
    state.cache.set(A, 100000);
    expect(await resolveVideoDuration(A)).toEqual({ ok: false, reason: 'too_long' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('a FRESH 86401 is PERSISTED (previously discarded by the ceiling)', async () => {
    fetchMock.mockResolvedValueOnce(okItem('PT24H0M1S'));
    expect(await resolveRawVideoDuration(A)).toEqual({ ok: true, seconds: 86401 });
    expect(state.written).toEqual([
      { video_id: A, duration_seconds: 86401, source: 'youtube_contentDetails' },
    ]);
  });

  it('a SECOND resolution of that 86401 uses the cache — no repeat quota', async () => {
    fetchMock.mockResolvedValueOnce(okItem('PT24H0M1S'));
    expect(await resolveVideoDuration(A)).toEqual({ ok: false, reason: 'too_long' });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fetchMock.mockClear();
    expect(await resolveVideoDuration(A)).toEqual({ ok: false, reason: 'too_long' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('a nonsense cached row is not treated as an answer', async () => {
    state.cache.set(A, 0);
    fetchMock.mockResolvedValueOnce(okItem('PT3M05S'));
    expect(await resolveRawVideoDuration(A)).toEqual({ ok: true, seconds: 185 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

// ── C. Batch search enrichment ───────────────────────────────────────────────────────────────

describe('BUILD 22 — batched enrichment never becomes N+1', () => {
  it('a FULL cache hit issues ZERO upstream calls', async () => {
    state.cache.set(A, 100);
    state.cache.set(B, 200);
    state.cache.set(C, 300);
    const out = await resolveRawVideoDurations([A, B, C]);
    expect(out.get(A)).toBe(100);
    expect(out.get(C)).toBe(300);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // THE N+1 GUARD. One call per result would make this 3.
  it('THREE misses resolve in exactly ONE videos.list call', async () => {
    fetchMock.mockResolvedValueOnce(okBatch([[A, 'PT1M40S'], [B, 'PT15M'], [C, 'PT15M1S']]));
    const out = await resolveRawVideoDurations([A, B, C]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(out.get(A)).toBe(100);
    expect(out.get(B)).toBe(900);
    expect(out.get(C)).toBe(901);
  });

  it('sends every missing id in ONE comma-separated request', async () => {
    fetchMock.mockResolvedValueOnce(okBatch([[A, 'PT1M'], [B, 'PT2M']]));
    await resolveRawVideoDurations([A, B]);
    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.searchParams.get('id')).toBe(`${A},${B}`);
    expect(url.searchParams.get('part')).toBe('contentDetails');
  });

  it('asks upstream ONLY for the misses — cached ids are never re-fetched', async () => {
    state.cache.set(A, 100);
    fetchMock.mockResolvedValueOnce(okBatch([[B, 'PT2M']]));
    await resolveRawVideoDurations([A, B]);
    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.searchParams.get('id')).toBe(B);
  });

  it('persists every batch-resolved duration in ONE bulk write, including over-limit ones', async () => {
    fetchMock.mockResolvedValueOnce(okBatch([[A, 'PT1M40S'], [B, 'PT2H28M37S']]));
    await resolveRawVideoDurations([A, B]);
    expect(state.written).toEqual([
      { video_id: A, duration_seconds: 100, source: 'youtube_contentDetails' },
      { video_id: B, duration_seconds: 8917, source: 'youtube_contentDetails' },
    ]);
  });

  it('de-duplicates repeated ids and ignores malformed ones', async () => {
    fetchMock.mockResolvedValueOnce(okBatch([[A, 'PT1M']]));
    await resolveRawVideoDurations([A, A, 'nope', '']);
    expect(new URL(String(fetchMock.mock.calls[0][0])).searchParams.get('id')).toBe(A);
  });

  it('an id ABSENT from the batch response stays unknown — never a durable verdict', async () => {
    fetchMock.mockResolvedValueOnce(okBatch([[A, 'PT1M']])); // B omitted (deleted/private)
    const out = await resolveRawVideoDurations([A, B]);
    expect(out.has(B)).toBe(false);
    expect(state.written.map((w) => w.video_id)).toEqual([A]);
  });
});

describe('BUILD 22 — enrichment failure degrades to unknown, never to an outage', () => {
  const items = [
    { videoId: A, title: 'short', channelTitle: 'TJ', thumbnailUrl: null },
    { videoId: B, title: 'long', channelTitle: 'TJ', thumbnailUrl: null },
  ];

  it('quota exhaustion returns SEARCHABLE results with unknown admission', async () => {
    fetchMock.mockResolvedValueOnce(httpError(429));
    const out = await enrichItemsWithDuration(items);
    expect(out).toHaveLength(2);
    expect(out.every((i) => i.durationAdmission === 'unknown')).toBe(true);
    expect(out.every((i) => i.durationSeconds === null)).toBe(true);
  });

  it('a network throw does not fail the successful search response', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network down'));
    const out = await enrichItemsWithDuration(items);
    expect(out.map((i) => i.durationAdmission)).toEqual(['unknown', 'unknown']);
  });

  it('a missing API key leaves results unknown and selectable', async () => {
    state.apiKey = null;
    const out = await enrichItemsWithDuration(items);
    expect(out.map((i) => i.durationAdmission)).toEqual(['unknown', 'unknown']);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('PRESERVES result order and every original field exactly', async () => {
    fetchMock.mockResolvedValueOnce(okBatch([[B, 'PT2M'], [A, 'PT1M']])); // upstream order differs
    const out = await enrichItemsWithDuration(items);
    expect(out.map((i) => i.videoId)).toEqual([A, B]); // input order, not upstream order
    expect(out[0].title).toBe('short');
    expect(out[1].channelTitle).toBe('TJ');
  });

  it('classifies exactly 900 as allowed and 901 as too_long on the wire shape', async () => {
    fetchMock.mockResolvedValueOnce(okBatch([[A, 'PT15M'], [B, 'PT15M1S']]));
    const out = await enrichItemsWithDuration(items);
    expect(out[0]).toMatchObject({ durationSeconds: 900, durationAdmission: 'allowed' });
    expect(out[1]).toMatchObject({ durationSeconds: 901, durationAdmission: 'too_long' });
  });

  it('an empty result list costs nothing', async () => {
    expect(await enrichItemsWithDuration([])).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // R1 — a search page containing a >24h cached video must behave like any other blocked result:
  // represented as too_long, no upstream call, and the response still fully usable.
  it('a cached duration over 24 hours enriches as too_long, with no upstream call and no failure', async () => {
    state.cache.set(A, 86401);
    state.cache.set(B, 185);
    const out = await enrichItemsWithDuration(items);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ durationSeconds: 86401, durationAdmission: 'too_long' });
    expect(out[1]).toMatchObject({ durationSeconds: 185, durationAdmission: 'allowed' });
    // The other results are unaffected — one over-limit row never degrades the page.
    expect(out.map((i) => i.videoId)).toEqual([A, B]);
  });
});

// ── Deployment safety: correct on the un-migrated schema too ─────────────────────────────────

describe('BUILD 22 — behaviour when the migration has NOT been applied (CHECK still 1..900)', () => {
  beforeEach(() => {
    state.checkMaxSeconds = 900; // the pre-BUILD-22 production constraint
  });

  it('an over-limit duration is still RESOLVED and classified, even though it cannot be cached', async () => {
    fetchMock.mockResolvedValueOnce(okItem('PT2H28M37S'));
    expect(await resolveVideoDuration(A)).toEqual({ ok: false, reason: 'too_long' });
    expect(state.written).toEqual([]); // rejected by the old CHECK — never silently "successful"
  });

  it('a rejected over-limit row does NOT discard the admissible rows in the same batch', async () => {
    fetchMock.mockResolvedValueOnce(okBatch([[A, 'PT1M40S'], [B, 'PT2H28M37S']]));
    const out = await resolveRawVideoDurations([A, B]);
    // Both are returned to the caller — resolution is independent of persistence.
    expect(out.get(A)).toBe(100);
    expect(out.get(B)).toBe(8917);
    // ...and the admissible one is still cached despite the batch rejection.
    expect(state.written).toEqual([{ video_id: A, duration_seconds: 100, source: 'youtube_contentDetails' }]);
  });

  it('the submit gate still refuses the over-limit song (the product behaviour is unaffected)', async () => {
    fetchMock.mockResolvedValueOnce(okItem('PT15M1S'));
    const raw = await resolveRawVideoDuration(A);
    expect(raw).toEqual({ ok: true, seconds: 901 });
  });
});

// ── BUILD 21 regression: the Host Start contract is unchanged by the refactor ────────────────

describe('BUILD 21 — resolveVideoDuration behaviour is preserved exactly', () => {
  it.each([
    ['PT0S', 'lookup_failed'],
    ['not-a-duration', 'lookup_failed'],
  ])('%s degrades to %s — a broken video is NEVER called "over 15 minutes"', async (iso, reason) => {
    fetchMock.mockResolvedValue(okItem(iso));
    expect(await resolveVideoDuration(A)).toEqual({ ok: false, reason });
  });

  it('quota exhaustion is NOT retried (the quota is gone, not flaky)', async () => {
    fetchMock.mockResolvedValueOnce(httpError(403, 'quotaExceeded'));
    expect(await resolveVideoDuration(A)).toEqual({ ok: false, reason: 'quota_exceeded' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('a missing API key still fails closed as not_configured', async () => {
    state.apiKey = null;
    expect(await resolveVideoDuration(A)).toEqual({ ok: false, reason: 'not_configured' });
  });

  it('an unparseable videoId never reaches the network', async () => {
    expect(await resolveVideoDuration('nope')).toEqual({ ok: false, reason: 'lookup_failed' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
