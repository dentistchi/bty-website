// BUILD 21 — duration resolution now says WHY it failed.
//
// The shipped resolver returned a bare `null` for six different causes, and /dj/start turned all
// six into "잠시 후 다시 시도해 주세요". For a 40-minute medley or a deleted video that advice is
// false and the Host can never win. These tests pin the classification itself, and in particular
// the two rules that are easy to get wrong:
//
//   1. `too_long` is NARROW — a finite parsed value strictly greater than the bound. A malformed,
//      missing, zero, or negative duration is NOT length information and must degrade to
//      `lookup_failed`, because telling a Host a broken video is "over 15 minutes" is a lie that
//      sends them looking for a shorter version that does not exist.
//   2. A quota failure must NOT consume the retry. The quota is gone, not flaky.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const state = {
  cached: null as number | null,
  cacheThrows: false,
  apiKey: 'test-key' as string | null,
};

vi.mock('./supabase.server', () => ({
  karaokeDb: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => {
            if (state.cacheThrows) throw new Error('cache down');
            return { data: state.cached == null ? null : { duration_seconds: state.cached } };
          },
        }),
      }),
      upsert: async () => ({ error: null }),
    }),
  }),
}));

vi.mock('./env.server', () => ({
  optionalEnv: (name: string) => (name === 'YOUTUBE_API_KEY' ? state.apiKey ?? undefined : undefined),
}));

import { resolveVideoDuration } from './youtube-duration.server';
import { MAX_LEASE_SECONDS } from '@/domain/playback-lease';

const VIDEO = 'dQw4w9WgXcQ';

/** A YouTube contentDetails 200 carrying one item with `iso`. */
function okItem(iso: string | null) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ items: [{ contentDetails: iso == null ? {} : { duration: iso } }] }),
  } as unknown as Response;
}
function okEmpty() {
  return { ok: true, status: 200, json: async () => ({ items: [] }) } as unknown as Response;
}
function httpError(status: number, reason = '') {
  return {
    ok: false,
    status,
    json: async () => (reason ? { error: { errors: [{ reason }] } } : {}),
  } as unknown as Response;
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  state.cached = null;
  state.cacheThrows = false;
  state.apiKey = 'test-key';
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('BUILD 21 — success is still defined by trustedLeaseDurationSeconds alone', () => {
  it('resolves an in-bounds duration and caches it', async () => {
    fetchMock.mockResolvedValueOnce(okItem('PT3M42S'));
    expect(await resolveVideoDuration(VIDEO)).toEqual({ ok: true, seconds: 222 });
  });

  it('accepts the exact upper bound (900s) — the bound itself is NOT "too long"', async () => {
    fetchMock.mockResolvedValueOnce(okItem('PT15M'));
    expect(await resolveVideoDuration(VIDEO)).toEqual({ ok: true, seconds: MAX_LEASE_SECONDS });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('serves a cache hit without any upstream call', async () => {
    state.cached = 230;
    expect(await resolveVideoDuration(VIDEO)).toEqual({ ok: true, seconds: 230 });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('BUILD 21 — too_long is narrow: only a finite parsed value ABOVE the bound', () => {
  it('classifies a 901s video as too_long (one second past the bound)', async () => {
    fetchMock.mockResolvedValueOnce(okItem('PT15M1S'));
    expect(await resolveVideoDuration(VIDEO)).toEqual({ ok: false, reason: 'too_long' });
  });

  it('classifies a real production 2.5-hour medley as too_long', async () => {
    // TapTFlOmE_I = 8917s, measured in the live request history.
    fetchMock.mockResolvedValueOnce(okItem('PT2H28M37S'));
    expect(await resolveVideoDuration(VIDEO)).toEqual({ ok: false, reason: 'too_long' });
  });

  it('a cached out-of-bounds row is ALSO too_long — no pointless upstream call', async () => {
    state.cached = 8917;
    expect(await resolveVideoDuration(VIDEO)).toEqual({ ok: false, reason: 'too_long' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // The core §1 rule: these are NOT length facts and must never say "too long".
  it.each([
    ['a zero duration', 'PT0S'],
    ['a malformed duration', 'not-a-duration'],
    ['an empty duration', ''],
  ])('%s degrades to lookup_failed, never too_long', async (_label, iso) => {
    fetchMock.mockResolvedValueOnce(okItem(iso));
    expect(await resolveVideoDuration(VIDEO)).toEqual({ ok: false, reason: 'lookup_failed' });
  });

  it('a MISSING duration field degrades to lookup_failed', async () => {
    fetchMock.mockResolvedValueOnce(okItem(null));
    expect(await resolveVideoDuration(VIDEO)).toEqual({ ok: false, reason: 'lookup_failed' });
  });
});

describe('BUILD 21 — video_unavailable is distinct from a lookup failure', () => {
  it('a 200 with no items means the video is gone (deleted/private), not a blip', async () => {
    fetchMock.mockResolvedValueOnce(okEmpty());
    expect(await resolveVideoDuration(VIDEO)).toEqual({ ok: false, reason: 'video_unavailable' });
    // Permanent → asking again changes nothing, so it must not burn a retry.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('BUILD 21 — quota exhaustion is classified and never retried', () => {
  it.each([
    ['HTTP 429 RESOURCE_EXHAUSTED', 429, ''],
    ['HTTP 403 quotaExceeded', 403, 'quotaExceeded'],
    ['HTTP 403 dailyLimitExceeded', 403, 'dailyLimitExceeded'],
    ['HTTP 403 rateLimitExceeded', 403, 'rateLimitExceeded'],
  ])('%s → quota_exceeded in exactly ONE upstream call', async (_label, status, reason) => {
    fetchMock.mockResolvedValue(httpError(status, reason));
    expect(await resolveVideoDuration(VIDEO)).toEqual({ ok: false, reason: 'quota_exceeded' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('BUILD 21 — genuinely transient failures still retry once', () => {
  it('a 500 retries once, then reports lookup_failed', async () => {
    fetchMock.mockResolvedValue(httpError(500));
    expect(await resolveVideoDuration(VIDEO)).toEqual({ ok: false, reason: 'lookup_failed' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('a 500 followed by a success resolves (the retry is real)', async () => {
    fetchMock.mockResolvedValueOnce(httpError(500)).mockResolvedValueOnce(okItem('PT3M'));
    expect(await resolveVideoDuration(VIDEO)).toEqual({ ok: true, seconds: 180 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('a network throw retries once, then reports lookup_failed', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));
    expect(await resolveVideoDuration(VIDEO)).toEqual({ ok: false, reason: 'lookup_failed' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('BUILD 21 — configuration and input faults are their own answers', () => {
  it('a missing API key is not_configured, not a lookup failure', async () => {
    state.apiKey = null;
    expect(await resolveVideoDuration(VIDEO)).toEqual({ ok: false, reason: 'not_configured' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('a non-canonical videoId never reaches the network', async () => {
    expect(await resolveVideoDuration('nope')).toEqual({ ok: false, reason: 'lookup_failed' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('a cache read failure still falls through to the live lookup', async () => {
    state.cacheThrows = true;
    fetchMock.mockResolvedValueOnce(okItem('PT4M'));
    expect(await resolveVideoDuration(VIDEO)).toEqual({ ok: true, seconds: 240 });
  });
});

describe('BUILD 21 — the fail-closed contract is unchanged', () => {
  it('NO failure branch ever yields a usable duration', async () => {
    const failures: Array<() => void> = [
      () => fetchMock.mockResolvedValue(okItem('PT2H')),
      () => fetchMock.mockResolvedValue(okEmpty()),
      () => fetchMock.mockResolvedValue(httpError(429)),
      () => fetchMock.mockResolvedValue(httpError(500)),
      () => fetchMock.mockRejectedValue(new Error('x')),
    ];
    for (const arrange of failures) {
      fetchMock.mockReset();
      arrange();
      const r = await resolveVideoDuration(VIDEO);
      expect(r.ok).toBe(false);
      expect('seconds' in r).toBe(false); // never a fallback, never a zero-fill
    }
  });
});
