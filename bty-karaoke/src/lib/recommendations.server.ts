// Server-only recommendation resolution. Turns a chosen song into up to 3
// "songs that go well with it" — each RESOLVED to a real YouTube result through
// the existing search path. Never fabricates a video id. Deterministic
// same-artist/mood seeds by default; an optional AI provider (behind a boundary)
// may supply candidate queries but never blocks or is trusted for ids.

import {
  recommendationQueries,
  MAX_RECOMMENDATIONS,
  type RecoSource,
} from '@/domain/recommendations';
import { rankResults } from '@/domain/youtube-rank';
import type { YoutubeSearchItem } from '@/domain/youtube-search';
import { searchYoutubeCachedOnly } from './youtube.server';
import { maybeAiRecommendationQueries } from './ai-recommend.server';

/**
 * Resolve recommendations for a source song. Excludes the source video id.
 * Returns [] when search is unavailable — the UI then hides the section.
 *
 * QUOTA: recommendations are served ONLY from the KV cache (searchYoutubeCachedOnly)
 * — they NEVER call googleapis. This keeps one explicit guest search at a single
 * `search.list` call; a recommendation seed that isn't already cached is skipped
 * rather than spending a quota unit. Every returned item is still a real, resolved
 * YouTube result (from a prior cached search).
 */
export async function getRecommendations(
  source: RecoSource,
  excludeVideoId?: string,
): Promise<YoutubeSearchItem[]> {
  // Optional AI candidate queries; fall back to deterministic seeds.
  let queries = await maybeAiRecommendationQueries(source).catch(() => null);
  if (!queries || !queries.length) queries = recommendationQueries(source);

  const picked: YoutubeSearchItem[] = [];
  const seen = new Set<string>(excludeVideoId ? [excludeVideoId] : []);

  for (const q of queries) {
    if (picked.length >= MAX_RECOMMENDATIONS) break;
    const res = await searchYoutubeCachedOnly(q); // cache-only — no upstream call
    if (!res.items.length) continue;
    const best = rankResults(res.items, q).top;
    const pick = best.find((it) => it.videoId && !seen.has(it.videoId));
    if (pick) {
      seen.add(pick.videoId);
      picked.push(pick);
    }
  }

  return picked.slice(0, MAX_RECOMMENDATIONS);
}
