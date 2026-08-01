// Pure helpers for YouTube search: query normalization, karaoke bias, HTML
// entity decoding, safe API-item projection, and fallback/watch URLs.
// No network, no API key, no side effects.

import type { DurationAdmission } from './duration-admission';

export const MAX_QUERY_LEN = 100;
export const SEARCH_MAX_RESULTS = 8;

const HANGUL = /[가-힣ᄀ-ᇿ㄰-㆏]/;

/** Collapse whitespace, trim, and cap length. */
export function normalizeSearchQuery(raw: string): string {
  return (raw ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_QUERY_LEN);
}

/**
 * Bias a query toward karaoke results. Korean queries get "노래방", other
 * queries get "karaoke". If the user already typed either bias term, the query
 * is returned unchanged (never append a duplicate bias).
 */
export function biasKaraokeQuery(query: string): string {
  const q = query.trim();
  if (!q) return q;
  const hasKoBias = q.includes('노래방');
  const hasEnBias = q.toLowerCase().includes('karaoke');
  if (hasKoBias || hasEnBias) return q;
  return HANGUL.test(q) ? `${q} 노래방` : `${q} karaoke`;
}

function safeFromCodePoint(cp: number): string {
  try {
    return String.fromCodePoint(cp);
  } catch {
    return '';
  }
}

/** Decode the HTML entities YouTube returns in titles/channel names. */
export function decodeHtmlEntities(input: string): string {
  if (!input) return '';
  return input
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => safeFromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => safeFromCodePoint(parseInt(d, 10)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&'); // amp last so "&amp;lt;" -> "&lt;", not "<"
}

export interface YoutubeSearchItem {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnailUrl: string | null;
  // ── BUILD 22 — additive duration admission (present only after server enrichment) ──
  //
  // OPTIONAL on purpose. `projectYoutubeItem` runs before any duration is known, and the KV
  // search cache holds pre-enrichment items with a 1-hour TTL — so entries written by the
  // previous build must keep type-checking and keep working. Enrichment happens AFTER the KV
  // read, which is why every API response still carries a verdict even on a cache hit.
  /** RAW provider length in seconds. Null/absent = not established (never render as 0:00). */
  durationSeconds?: number | null;
  /** Tri-state verdict. Absent is read as 'unknown' — NEVER as 'too_long'. */
  durationAdmission?: DurationAdmission;
}

/**
 * Project a raw YouTube Data API v3 search item to the safe shape we expose.
 * Returns null for items missing a video id or snippet. Titles/channels are
 * entity-decoded. No other API fields leak out.
 */
export function projectYoutubeItem(raw: unknown): YoutubeSearchItem | null {
  const item = raw as {
    id?: { videoId?: string };
    snippet?: {
      title?: string;
      channelTitle?: string;
      thumbnails?: Record<string, { url?: string } | undefined>;
    };
  };
  const videoId = item?.id?.videoId;
  const snippet = item?.snippet;
  if (!videoId || !snippet) return null;
  const thumbs = snippet.thumbnails ?? {};
  const thumbnailUrl = thumbs.medium?.url ?? thumbs.default?.url ?? thumbs.high?.url ?? null;
  return {
    videoId,
    title: decodeHtmlEntities(snippet.title ?? ''),
    channelTitle: decodeHtmlEntities(snippet.channelTitle ?? ''),
    thumbnailUrl,
  };
}

/** Standard YouTube search results URL — the fallback when the API is unavailable. */
export function youtubeSearchUrl(query: string): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}

/** Standard YouTube watch URL for a video id. */
export function youtubeWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
}
