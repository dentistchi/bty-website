// Server-only YouTube Data API v3 search. The API key lives in YOUTUBE_API_KEY
// and is NEVER returned to the client or logged. Callers get only the safe
// projected items plus a standard-search fallback URL.
//
// Results are cached in the dedicated Karaoke KV namespace (binding
// KARAOKE_SEARCH_KV), keyed by the normalized/biased query, to conserve the
// finite YouTube quota. The cache is optional: when the binding is absent (e.g.
// local `next dev`) search still works, uncached.

import {
  biasKaraokeQuery,
  projectYoutubeItem,
  youtubeSearchUrl,
  SEARCH_MAX_RESULTS,
  type YoutubeSearchItem,
} from '@/domain/youtube-search';
import { optionalEnv } from './env.server';

export const SEARCH_CACHE_TTL_SECONDS = 3600; // 1 hour

export interface YoutubeSearchResponse {
  ok: boolean;
  /** true when YOUTUBE_API_KEY is not configured (credential gate). */
  gated: boolean;
  /** true when the API call failed or quota was exhausted. */
  degraded: boolean;
  items: YoutubeSearchItem[];
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

async function fetchItemsFromApi(biasedQuery: string, key: string): Promise<YoutubeSearchItem[]> {
  const url = new URL('https://www.googleapis.com/youtube/v3/search');
  url.searchParams.set('part', 'snippet');
  url.searchParams.set('type', 'video');
  url.searchParams.set('maxResults', String(SEARCH_MAX_RESULTS));
  url.searchParams.set('q', biasedQuery);
  url.searchParams.set('key', key);

  const res = await fetch(url, { headers: { accept: 'application/json' } });
  if (!res.ok) {
    // 403 = quota/forbidden, 400 = bad request, etc. Surface as degraded.
    throw new Error(`youtube_api_${res.status}`);
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
export async function searchYoutubeWithCache(
  query: string,
  kv: SearchKv | null,
): Promise<YoutubeSearchResponse> {
  const biasedQuery = biasKaraokeQuery(query);
  const fallbackUrl = youtubeSearchUrl(biasedQuery);
  const base = { query, biasedQuery, fallbackUrl, items: [] as YoutubeSearchItem[] };

  const key = apiKey();
  if (!key) return { ok: false, gated: true, degraded: false, ...base };

  const cacheKey = cacheKeyFor(biasedQuery);
  if (kv) {
    try {
      const cached = (await kv.get(cacheKey, 'json')) as YoutubeSearchItem[] | null;
      if (cached && cached.length) {
        return { ok: true, gated: false, degraded: false, ...base, items: cached };
      }
    } catch {
      // cache read failure is non-fatal — fall through to the API
    }
  }

  try {
    const items = await fetchItemsFromApi(biasedQuery, key);
    if (kv && items.length) {
      try {
        await kv.put(cacheKey, JSON.stringify(items), { expirationTtl: SEARCH_CACHE_TTL_SECONDS });
      } catch {
        // cache write failure is non-fatal
      }
    }
    return { ok: true, gated: false, degraded: false, ...base, items };
  } catch {
    return { ok: false, gated: false, degraded: true, ...base };
  }
}

/** Search YouTube, using the KV cache when the binding is present. */
export async function searchYoutube(query: string): Promise<YoutubeSearchResponse> {
  return searchYoutubeWithCache(query, await resolveSearchKv());
}
