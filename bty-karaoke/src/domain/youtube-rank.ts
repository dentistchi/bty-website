// Pure ranking + limiting for guest search results. No network, no side effects.
// Ranks credible karaoke-friendly matches highest, deprioritizes shorts /
// reactions / covers / obvious duplicates, dedupes by video id and near-identical
// title, and splits into the best few (shown first) plus the rest ("결과 더 보기").

import type { YoutubeSearchItem } from './youtube-search';

export const PRIMARY_RESULT_COUNT = 3;

// Signals we push DOWN — clips that usually aren't the singable track.
const PENALTIES: { re: RegExp; weight: number }[] = [
  { re: /shorts?/i, weight: 5 },
  { re: /reaction|리액션|리액션/i, weight: 5 },
  { re: /\bcover\b|커버/i, weight: 3 },
  { re: /teaser|예고|preview/i, weight: 4 },
  { re: /\blive\b|라이브|콘서트|concert|fancam|직캠/i, weight: 2 },
  { re: /\b(react|reacts)\b/i, weight: 4 },
  { re: /making|비하인드|behind/i, weight: 3 },
];

// Signals we push UP — karaoke-appropriate versions.
const BOOSTS: { re: RegExp; weight: number }[] = [
  { re: /노래방|karaoke/i, weight: 3 },
  { re: /\bMR\b|반주|instrumental|inst\.?/i, weight: 2 },
  { re: /official|공식/i, weight: 1 },
];

/** Words (≥2 chars) from a query, lowercased, for term-overlap scoring. */
export function queryTerms(query: string): string[] {
  return (query ?? '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 2 && t !== '노래방' && t !== 'karaoke');
}

/** A normalized title key for near-duplicate detection. */
export function titleKey(title: string): string {
  return (title ?? '')
    .toLowerCase()
    .replace(/\[[^\]]*\]|\([^)]*\)/g, ' ') // drop [MV] (Official) etc.
    .replace(/[^\p{L}\p{N}]/gu, '')
    .slice(0, 60);
}

/** Deterministic score for one item against the query. Higher = better. */
export function scoreItem(item: YoutubeSearchItem, terms: string[]): number {
  const hay = `${item.title} ${item.channelTitle}`.toLowerCase();
  let score = 0;
  for (const t of terms) if (hay.includes(t)) score += 2;
  for (const { re, weight } of BOOSTS) if (re.test(hay)) score += weight;
  for (const { re, weight } of PENALTIES) if (re.test(hay)) score -= weight;
  return score;
}

export interface RankedResults {
  top: YoutubeSearchItem[];
  more: YoutubeSearchItem[];
}

/**
 * Rank and limit. Stable: ties keep the API's original (relevance) order.
 * Dedupes by videoId first, then by near-identical title. Returns the best
 * `primaryCount` as `top` and the remainder as `more`.
 */
export function rankResults(
  items: readonly YoutubeSearchItem[],
  query: string,
  primaryCount = PRIMARY_RESULT_COUNT,
): RankedResults {
  const terms = queryTerms(query);

  const seenIds = new Set<string>();
  const seenTitles = new Set<string>();
  const deduped: { item: YoutubeSearchItem; idx: number }[] = [];
  items.forEach((item, idx) => {
    if (!item?.videoId || seenIds.has(item.videoId)) return;
    const tk = titleKey(item.title);
    if (tk && seenTitles.has(tk)) return;
    seenIds.add(item.videoId);
    if (tk) seenTitles.add(tk);
    deduped.push({ item, idx });
  });

  const ranked = deduped
    .map(({ item, idx }) => ({ item, idx, score: scoreItem(item, terms) }))
    .sort((a, b) => (b.score !== a.score ? b.score - a.score : a.idx - b.idx))
    .map((r) => r.item);

  return { top: ranked.slice(0, primaryCount), more: ranked.slice(primaryCount) };
}
