// Pure Performance Style model for guest search. The singer picks how they want
// to perform BEFORE searching; the style biases the YouTube query toward the
// right kind of video. No network, no side effects.
//
// Reflects Dr. Chi's operating preference: MR (backing track) is the DEFAULT.
//   - mr        → instrumental / backing-track versions (vocals removed)
//   - karaoke   → 노래방 / karaoke videos (likely on-screen words)
//   - original  → the raw query (official audio / MV), no bias at all

import type { GuestLocale } from './guest-locale';
import { guestT } from './guest-messages';

import { biasKaraokeQuery } from './youtube-search';

export type PerformanceStyle = 'mr' | 'karaoke' | 'original';

export const PERFORMANCE_STYLES: readonly PerformanceStyle[] = ['mr', 'karaoke', 'original'];

/** MR is the default: Dr. Chi's rooms favour clean backing tracks. */
export const DEFAULT_STYLE: PerformanceStyle = 'mr';

const HANGUL = /[가-힣ᄀ-ᇿ㄰-㆏]/;

// Terms that already express an MR/instrumental intent — never double-append.
const MR_BIAS = /\bmr\b|instrumental|backing\s*track|minus\s*one|off\s*vocal|반주/i;

/** Narrow an arbitrary string to a valid PerformanceStyle, defaulting to MR. */
export function normalizeStyle(raw: string | null | undefined): PerformanceStyle {
  return PERFORMANCE_STYLES.includes(raw as PerformanceStyle)
    ? (raw as PerformanceStyle)
    : DEFAULT_STYLE;
}

/**
 * Bias a query for the chosen style. Conservative: append at most one bias term,
 * and never a duplicate if the singer already typed the intent.
 *   - mr        → " MR" for Korean queries (the standard KR term), " instrumental"
 *                 otherwise. Skipped when the query already reads as MR.
 *   - karaoke   → reuse the shared karaoke bias (노래방 / karaoke).
 *   - original  → returned unchanged.
 */
export function biasStyleQuery(query: string, style: PerformanceStyle): string {
  const q = (query ?? '').trim();
  if (!q) return q;
  if (style === 'original') return q;
  if (style === 'karaoke') return biasKaraokeQuery(q);
  // style === 'mr' — append the standard MR terms so YouTube returns more real
  // backing tracks (the mode-aware ranker then leads with them). Kept short so
  // query relevance isn't diluted: KR uses the two common terms "MR 반주",
  // EN uses "instrumental". Skipped when the singer already typed MR intent.
  if (MR_BIAS.test(q)) return q;
  return HANGUL.test(q) ? `${q} MR 반주` : `${q} instrumental`;
}

export interface StyleCopy {
  label: string; // segmented-control label
  hint: string; // sub-line under the search box
}

/**
 * UI copy per style. Honest — never promises guaranteed lyrics.
 *
 * BUILD 26G — the STYLE IDS ('mr' | 'karaoke' | 'original') are the search contract and are
 * unchanged; `biasStyleQuery` above still augments a Hangul query with Korean search terms
 * regardless of UI language, because that decides what YouTube is asked for, not what the
 * Guest reads.
 */
export function styleCopy(locale: GuestLocale, style: PerformanceStyle): StyleCopy {
  switch (style) {
    case 'mr':
      return {
        label: guestT(locale, 'guest.style.mr.label'),
        hint: guestT(locale, 'guest.style.mr.hint'),
      };
    case 'karaoke':
      return {
        label: guestT(locale, 'guest.style.karaoke.label'),
        hint: guestT(locale, 'guest.style.karaoke.hint'),
      };
    case 'original':
      return {
        label: guestT(locale, 'guest.style.original.label'),
        hint: guestT(locale, 'guest.style.original.hint'),
      };
  }
}
