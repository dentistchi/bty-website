// Server-only YouTube Data API v3 search. The API key lives in YOUTUBE_API_KEY
// and is NEVER returned to the client or logged. Callers get only the safe
// projected items plus a standard-search fallback URL.
//
// Results are cached in the dedicated Karaoke KV namespace (binding
// KARAOKE_SEARCH_KV), keyed by the normalized/biased query, to conserve the
// finite YouTube quota. The cache is optional: when the binding is absent (e.g.
// local `next dev`) search still works, uncached.

import {
  projectYoutubeItem,
  youtubeSearchUrl,
  SEARCH_MAX_RESULTS,
  type YoutubeSearchItem,
} from '@/domain/youtube-search';
import { biasStyleQuery, normalizeStyle, type PerformanceStyle } from '@/domain/performance-style';
import { optionalEnv } from './env.server';

export const SEARCH_CACHE_TTL_SECONDS = 3600; // 1 hour
/** Short global circuit-breaker window after a proven daily-quota 429, so a quota
 *  increase or reset takes effect within minutes — not the next day. */
export const QUOTA_BREAKER_TTL_SECONDS = 900; // 15 minutes
/** KV key for the global "daily search quota exhausted" marker (circuit breaker). */
export const QUOTA_MARKER_KEY = 'yt:quota-exhausted';

export interface YoutubeSearchResponse {
  ok: boolean;
  /** true when YOUTUBE_API_KEY is not configured (credential gate). */
  gated: boolean;
  /** true when the API call failed for ANY reason (network/5xx/quota/etc.). */
  degraded: boolean;
  /** true ONLY when Google reported the daily search quota is exhausted (429
   *  RESOURCE_EXHAUSTED / 403 quotaExceeded). Distinct from generic `degraded`. */
  quotaExceeded: boolean;
  items: YoutubeSearchItem[];
  /**
   * BUILD 26T-R1B-R6-R1B-R1 — the FACTUAL instant the server received this YouTube response,
   * ISO-8601. Carried through a cache hit unchanged, because a cache hit is not a fetch.
   *
   * `undefined`/absent means the provenance is UNKNOWN — a legacy bare-array cache value, a gated
   * or degraded response, or any path where no live response was observed. It is never populated
   * from `now()` on a cache hit, and a downstream write records NULL rather than guessing.
   */
  fetchedAt?: string | null;
  /** the user's original (normalized) query, preserved for display. */
  query: string;
  /** biased query actually sent to YouTube / used for the fallback link. */
  biasedQuery: string;
  /** standard YouTube search URL to fall back to when items are unavailable. */
  fallbackUrl: string;
}

/** Minimal shape of the KV binding we depend on (avoids a workers-types dep). */
export interface SearchKv {
  get(key: string, type: 'json'): Promise<unknown>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

function apiKey(): string | null {
  return optionalEnv('YOUTUBE_API_KEY') ?? null;
}

function cacheKeyFor(biasedQuery: string): string {
  return `ytq:${biasedQuery}`;
}

/** BUILD 26T-R1B-R6-R1B-R1 — versioned search-cache envelope carrying factual fetch provenance. */
export const SEARCH_CACHE_VERSION = 1 as const;

export interface SearchCacheEnvelope {
  version: typeof SEARCH_CACHE_VERSION;
  /** ISO instant the server actually received the YouTube response. */
  fetchedAt: string;
  items: YoutubeSearchItem[];
}

/**
 * Read either shape. A v1 envelope yields its factual `fetchedAt`; a LEGACY bare array yields
 * `fetchedAt: null` — unknown, never invented. Anything unrecognised is treated as a miss so a
 * corrupt value cannot masquerade as fresh data.
 *
 * Exported for tests: the legacy path is the one that must never gain a timestamp.
 */
export function readSearchCacheEnvelope(
  raw: unknown,
): { items: YoutubeSearchItem[]; fetchedAt: string | null } | null {
  if (Array.isArray(raw)) return { items: raw as YoutubeSearchItem[], fetchedAt: null };
  if (raw && typeof raw === 'object') {
    const e = raw as Partial<SearchCacheEnvelope>;
    if (e.version === SEARCH_CACHE_VERSION && Array.isArray(e.items) && typeof e.fetchedAt === 'string') {
      return { items: e.items, fetchedAt: e.fetchedAt };
    }
  }
  return null;
}

/** Typed upstream error so callers can distinguish a daily-quota 429 from other
 *  failures WITHOUT ever exposing the raw Google payload/key downstream. */
class YoutubeApiError extends Error {
  constructor(readonly status: number, readonly reason: string) {
    super(`youtube_api_${status}`);
  }
}

/** True iff the upstream failure is the daily search-quota exhaustion. YouTube
 *  reports this as HTTP 429 RESOURCE_EXHAUSTED (Search Queries per day) or the
 *  classic HTTP 403 quotaExceeded / dailyLimitExceeded. */
function isQuotaExhausted(status: number | undefined, reason: string): boolean {
  if (status === 429) return true;
  return /ratelimitexceeded|quotaexceeded|dailylimitexceeded|resource_exhausted/i.test(reason);
}

/** Server-side observability. Logs ONLY a normalized marker + upstream status —
 *  never the API key, guest tokens, query, or the raw upstream URL/body. */
function logSearchFailure(
  marker: 'youtube_search_quota_exceeded' | 'youtube_search_upstream_failure',
  upstreamStatus?: number,
): void {
  try {
    // eslint-disable-next-line no-console
    console.warn(JSON.stringify({ event: marker, upstreamStatus: upstreamStatus ?? null }));
  } catch {
    /* logging must never throw */
  }
}

async function fetchItemsFromApi(biasedQuery: string, key: string): Promise<YoutubeSearchItem[]> {
  const url = new URL('https://www.googleapis.com/youtube/v3/search');
  url.searchParams.set('part', 'snippet');
  url.searchParams.set('type', 'video');
  url.searchParams.set('maxResults', String(SEARCH_MAX_RESULTS));
  url.searchParams.set('q', biasedQuery);
  url.searchParams.set('key', key);

  const res = await fetch(url, { headers: { accept: 'application/json' } });
  if (!res.ok) {
    // Preserve Google's classification (reason) so quota can be told apart from a
    // generic failure — without leaking the raw payload past this boundary.
    let reason = '';
    try {
      const body = (await res.json()) as {
        error?: { status?: string; errors?: Array<{ reason?: string }> };
      };
      reason = body?.error?.errors?.[0]?.reason ?? body?.error?.status ?? '';
    } catch {
      /* non-JSON error body — status alone still classifies 429 */
    }
    throw new YoutubeApiError(res.status, reason);
  }
  const data = (await res.json()) as { items?: unknown[] };
  return (data.items ?? [])
    .map(projectYoutubeItem)
    .filter((x): x is YoutubeSearchItem => x !== null)
    .slice(0, SEARCH_MAX_RESULTS);
}

/** Resolve the Karaoke search KV binding, or null when unavailable (e.g. dev). */
async function resolveSearchKv(): Promise<SearchKv | null> {
  try {
    const mod = await import('@opennextjs/cloudflare');
    const env = mod.getCloudflareContext().env as Record<string, unknown>;
    return (env?.KARAOKE_SEARCH_KV as SearchKv) ?? null;
  } catch {
    return null;
  }
}

/**
 * Cache-aware search. Never throws for the caller: `gated` when the key is
 * missing, `degraded` (with a fallback URL) on any API failure. A KV `null`
 * simply disables caching.
 */
/** Canonical Performance Style from caller opts (mr default; karaoke = 노래방;
 *  original = 원곡). The legacy `bias:false` still maps to Original. */
function resolveStyle(opts?: { bias?: boolean; style?: PerformanceStyle }): PerformanceStyle {
  return opts?.style ? normalizeStyle(opts.style) : opts?.bias === false ? 'original' : 'karaoke';
}

export async function searchYoutubeWithCache(
  query: string,
  kv: SearchKv | null,
  opts?: { bias?: boolean; style?: PerformanceStyle },
): Promise<YoutubeSearchResponse> {
  const style = resolveStyle(opts);
  const biasedQuery = biasStyleQuery(query, style);
  const fallbackUrl = youtubeSearchUrl(biasedQuery);
  const base = { query, biasedQuery, fallbackUrl, items: [] as YoutubeSearchItem[] };

  const key = apiKey();
  if (!key) return { ok: false, gated: true, degraded: false, quotaExceeded: false, ...base };

  const cacheKey = cacheKeyFor(biasedQuery);
  if (kv) {
    // Already-cached successful results are always served, even while the quota
    // circuit breaker is open.
    try {
      // BUILD 26T-R1B-R6-R1B-R1 — the cache now carries the FACTUAL YouTube fetch instant.
      //
      // A cache hit is NOT a YouTube fetch: it may be served up to an hour after the response it
      // holds, so returning `now()` would manufacture freshness the server never observed. The
      // envelope's own `fetchedAt` is returned unchanged.
      //
      // LEGACY BARE ARRAYS (written before this envelope existed) carry no fetch instant. They are
      // returned with `fetchedAt` UNKNOWN rather than stamped — a downstream write then records
      // NULL provenance, which retention treats fail-safe. They also self-heal: the existing 1h
      // TTL retires the whole legacy population without a migration or extra quota.
      const raw = (await kv.get(cacheKey, 'json')) as unknown;
      const envelope = readSearchCacheEnvelope(raw);
      if (envelope && envelope.items.length) {
        return {
          ok: true, gated: false, degraded: false, quotaExceeded: false, ...base,
          items: envelope.items,
          fetchedAt: envelope.fetchedAt,   // null for a legacy value — never invented
        };
      }
    } catch {
      // cache read failure is non-fatal — fall through
    }
    // Circuit breaker: after a proven daily-quota 429, skip googleapis entirely for
    // a short window so we don't burn a request per guest search on a dead quota.
    try {
      if (await kv.get(QUOTA_MARKER_KEY, 'json')) {
        return { ok: false, gated: false, degraded: true, quotaExceeded: true, ...base };
      }
    } catch {
      // breaker read failure is non-fatal — proceed to the API
    }
  }

  try {
    const items = await fetchItemsFromApi(biasedQuery, key);
    const fetchedAtMs = Date.now();   // factual: the response is in hand
    if (kv && items.length) {
      try {
        // The ONE place a factual fetch instant is minted: we have just received a live YouTube
        // response, so this is the only moment `now()` is the truth.
        const envelope: SearchCacheEnvelope = {
          version: SEARCH_CACHE_VERSION,
          fetchedAt: new Date(fetchedAtMs).toISOString(),
          items,
        };
        await kv.put(cacheKey, JSON.stringify(envelope), { expirationTtl: SEARCH_CACHE_TTL_SECONDS });
      } catch {
        // cache write failure is non-fatal
      }
    }
    return {
      ok: true, gated: false, degraded: false, quotaExceeded: false, ...base, items,
      fetchedAt: new Date(fetchedAtMs).toISOString(),
    };
  } catch (e) {
    const status = e instanceof YoutubeApiError ? e.status : undefined;
    const reason = e instanceof YoutubeApiError ? e.reason : '';
    const quotaExceeded = isQuotaExhausted(status, reason);
    if (quotaExceeded) {
      logSearchFailure('youtube_search_quota_exceeded', status);
      // Trip the global breaker (short TTL) so a recovery/increase applies quickly.
      if (kv) {
        try {
          await kv.put(QUOTA_MARKER_KEY, JSON.stringify(true), { expirationTtl: QUOTA_BREAKER_TTL_SECONDS });
        } catch {
          /* breaker write failure is non-fatal */
        }
      }
    } else {
      logSearchFailure('youtube_search_upstream_failure', status);
    }
    return { ok: false, gated: false, degraded: true, quotaExceeded, ...base };
  }
}

/**
 * CACHE-ONLY search — reads the KV cache and NEVER calls googleapis (0 quota).
 * Used by recommendations so one explicit guest search costs at most ONE
 * `search.list` call. Uncached queries simply return no items (the UI hides the
 * section) rather than spending a quota unit.
 */
export async function searchYoutubeCachedOnly(
  query: string,
  opts?: { bias?: boolean; style?: PerformanceStyle },
): Promise<YoutubeSearchResponse> {
  const style = resolveStyle(opts);
  const biasedQuery = biasStyleQuery(query, style);
  const fallbackUrl = youtubeSearchUrl(biasedQuery);
  const base = {
    ok: true as const,
    gated: false,
    degraded: false,
    quotaExceeded: false,
    query,
    biasedQuery,
    fallbackUrl,
    items: [] as YoutubeSearchItem[],
  };
  const kv = await resolveSearchKv();
  if (!kv) return base;
  try {
    // The cache value is read by the ONE canonical reader, exactly as the primary search path
    // reads it. This path previously cast the value to a bare array of its own accord; when the
    // v1 envelope shipped, an object has no `.length`, so every recommendation seed silently
    // missed a cache that was in fact populated. A second parser is what made that possible, so
    // there is deliberately only one.
    //
    // `readSearchCacheEnvelope` accepts both shapes: a v1 envelope and a LEGACY bare array (still
    // present for up to one TTL after a deploy). Anything unrecognised is treated as a miss.
    //
    // Provenance is deliberately NOT propagated here — this path has never returned a
    // `fetchedAt`, and a recommendation carries no seal. Only the items are read.
    const envelope = readSearchCacheEnvelope(await kv.get(cacheKeyFor(biasedQuery), 'json'));
    if (envelope && envelope.items.length) return { ...base, items: envelope.items };
  } catch {
    /* cache read failure — return empty (never calls the API) */
  }
  return base;
}

/** Search YouTube, using the KV cache when the binding is present. */
export async function searchYoutube(
  query: string,
  opts?: { bias?: boolean; style?: PerformanceStyle },
): Promise<YoutubeSearchResponse> {
  return searchYoutubeWithCache(query, await resolveSearchKv(), opts);
}
