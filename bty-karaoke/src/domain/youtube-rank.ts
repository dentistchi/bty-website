// Pure ranking + limiting for guest search results. No network, no side effects.
// Ranks credible karaoke-friendly matches highest, deprioritizes shorts /
// reactions / covers / obvious duplicates, dedupes by video id and near-identical
// title, and splits into the best few (shown first) plus the rest ("결과 더 보기").

import type { YoutubeSearchItem } from './youtube-search';
import { classifyVideo } from './video-kind';
import type { PerformanceStyle } from './performance-style';

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

// ── Mode-aware ranking (V5.2) ──────────────────────────────────────────────
// The generic rankResults ranks karaoke-friendly clips highest regardless of the
// chosen style, so an MR search still led with popular TJ/금영 karaoke videos.
// rankSearchResults re-scores by the SELECTED style using the classifier + text
// signals, so MR mode leads with real MR/instrumental/반주, karaoke mode with
// 노래방/karaoke, original with official/MV — while keeping query relevance so a
// generic off-song backing track never floats to the top.

// Strong "no vocals" evidence — the MR signal we boost hardest in MR mode.
const INSTRUMENTAL_STRONG = /instrumental|반주|backing\s*track|minus\s*one|off\s*vocal|\binst\b/i;
// Karaoke sing-along / provider signals we demote in MR mode.
const KARAOKE_SIGNAL = /karaoke|가라오케|노래방|sing[\s-]?along|\btj\b|티제이|금영|\bky\b/i;
const LIVE_SIGNAL = /\blive\b|라이브|콘서트|concert|fancam|직캠|live\s*performance/i;

/** True when an item is a plausible MR (backing-track) result. */
export function isMrCandidate(item: YoutubeSearchItem): boolean {
  const hay = `${item.title} ${item.channelTitle}`;
  return classifyVideo(item.title, item.channelTitle) === 'mr' || INSTRUMENTAL_STRONG.test(hay);
}

/**
 * Deterministic style-aware score. Higher = better for the chosen style. Query
 * relevance dominates (an off-song result sinks) so MR-ness only decides order
 * among results that actually match what the singer searched for.
 */
export function styleScore(
  item: YoutubeSearchItem,
  terms: string[],
  style: PerformanceStyle,
): number {
  const hay = `${item.title} ${item.channelTitle}`.toLowerCase();
  const kind = classifyVideo(item.title, item.channelTitle);
  const matched = terms.filter((t) => hay.includes(t)).length;

  let s = matched * 40; // relevance to the searched song/artist
  if (terms.length > 0 && matched === 0) s -= 1000; // off-song → bottom (still shown)
  for (const { re, weight } of PENALTIES) if (re.test(hay)) s -= weight; // shorts/reaction/cover

  if (style === 'mr') {
    if (kind === 'mr') s += 100;
    if (INSTRUMENTAL_STRONG.test(hay)) s += 40;
    if (/off\s*vocal|minus\s*one/i.test(hay)) s += 20;
    if (kind === 'karaoke') s -= 80;
    if (KARAOKE_SIGNAL.test(hay)) s -= 60;
    if (kind === 'official' || kind === 'mv') s -= 100;
    if (LIVE_SIGNAL.test(hay)) s -= 40;
  } else if (style === 'karaoke') {
    if (kind === 'karaoke') s += 100;
    if (kind === 'lyrics') s += 50;
    if (KARAOKE_SIGNAL.test(hay)) s += 30;
    if (kind === 'mr') s -= 20;
    if (kind === 'official' || kind === 'mv') s -= 40;
  } else {
    // original
    if (kind === 'official' || kind === 'mv') s += 100;
    if (LIVE_SIGNAL.test(hay)) s += 20;
    if (kind === 'karaoke') s -= 60;
    if (kind === 'mr') s -= 60;
  }
  return s;
}

export interface RankSearchOptions {
  style: PerformanceStyle;
  query: string;
}

/**
 * Rank + limit for a chosen performance style. Stable: equal scores keep the
 * API's original relevance order (never invent an order). Dedupes like
 * rankResults. In MR mode, real MR/instrumental results lead — so the first few
 * shown are MR when any exist, WITHOUT hiding the rest or faking an MR badge.
 */
export function rankSearchResults(
  items: readonly YoutubeSearchItem[],
  opts: RankSearchOptions,
  primaryCount = PRIMARY_RESULT_COUNT,
): RankedResults {
  const terms = queryTerms(opts.query);

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
    .map(({ item, idx }) => ({ item, idx, score: styleScore(item, terms, opts.style) }))
    .sort((a, b) => (b.score !== a.score ? b.score - a.score : a.idx - b.idx))
    .map((r) => r.item);

  return { top: ranked.slice(0, primaryCount), more: ranked.slice(primaryCount) };
}
