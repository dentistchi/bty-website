// LYRICS DISPLAY V1 — pure lyrics domain. No I/O, no network, no DB. Two jobs:
//
//   1. sanitizeLyrics()  — normalize + bound Admin-typed text into safe plain
//      text and derive its status. Rendered as TEXT only (never HTML), so this is
//      also the XSS-safety boundary: control chars stripped, length capped.
//
//   2. normalizeSongForLyrics() — the "resolver" input-normalization step. It
//      turns a noisy YouTube title / channel / search query into a best-effort
//      { song, artist, confidence } for looking a song up. It NEVER trusts the raw
//      YouTube title: karaoke / MR / live / quality suffixes are stripped per the
//      search mode. Low confidence → the caller shows 'unavailable' rather than a
//      wrong match. V1 has no licensed provider wired, so this is exercised by
//      tests and reused the day a provider is added; the shipped lyrics path is
//      Admin-provided text (sanitizeLyrics + lyricsViewFor).

import { cleanSongTitle, displaySong } from './song-title';

export type LyricsStatus = 'unavailable' | 'loading' | 'available' | 'failed';

/** Upper bound on stored lyrics. A long song is ~4–5k chars; 8k is generous. */
export const MAX_LYRICS_LEN = 8000;

export interface SanitizedLyrics {
  /** Clean plain text, or null when the input is empty (a "clear"). */
  text: string | null;
  /** 'available' when non-empty text remains, else 'unavailable'. */
  status: Extract<LyricsStatus, 'available' | 'unavailable'>;
}

/**
 * Normalize Admin-typed lyrics into safe, bounded plain text.
 *  - CRLF / CR → LF (consistent line breaks the Display preserves).
 *  - Strip C0/DEL control chars EXCEPT newline and tab (defuses stray escape /
 *    format bytes; there is no markup to execute — the Display renders text only).
 *  - Trim trailing spaces per line, collapse 3+ blank lines to one, drop leading /
 *    trailing blank lines.
 *  - Hard-cap at MAX_LYRICS_LEN (defense-in-depth beside the Zod bound).
 * Empty (or whitespace-only) input clears the lyrics → status 'unavailable'.
 */
export function sanitizeLyrics(raw: string | null | undefined): SanitizedLyrics {
  if (raw == null) return { text: null, status: 'unavailable' };
  let s = String(raw)
    .replace(/\r\n?/g, '\n')
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\n+|\n+$/g, '');
  if (s.length > MAX_LYRICS_LEN) s = s.slice(0, MAX_LYRICS_LEN).replace(/\n+$/g, '');
  const text = s.trim() ? s : null;
  return { text, status: text ? 'available' : 'unavailable' };
}

/** The stored lyrics fields the Display projection reads (a subset of the row). */
export interface LyricsRow {
  lyrics_text?: string | null;
  lyrics_status?: string | null;
  lyrics_source?: string | null;
}

/** What the Display renders for the current song's lyrics. Text-only, no HTML. */
export interface LyricsView {
  status: LyricsStatus;
  /** Present only when status === 'available'. Plain text with newlines. */
  text: string | null;
  /** 'admin' | 'provider' | null — drives an optional attribution line. */
  source: string | null;
}

const VALID_STATUS: readonly LyricsStatus[] = ['unavailable', 'loading', 'available', 'failed'];

/**
 * Pure projection of a stored request's lyrics fields to the Display view. The
 * stored status is authoritative but reconciled with the text: 'available' with
 * no text degrades to 'unavailable' (never claim lyrics we don't have), and any
 * non-empty text is shown as 'available' even if the status column lagged. Text
 * is surfaced ONLY for 'available' so a stale/failed row never leaks old words.
 */
export function lyricsViewFor(row: LyricsRow | null | undefined): LyricsView {
  const text = row?.lyrics_text?.trim() ? row.lyrics_text : null;
  const raw = row?.lyrics_status;
  const stored: LyricsStatus = VALID_STATUS.includes(raw as LyricsStatus)
    ? (raw as LyricsStatus)
    : 'unavailable';
  let status: LyricsStatus = stored;
  if (text) status = 'available';
  else if (stored === 'available') status = 'unavailable';
  return {
    status,
    text: status === 'available' ? text : null,
    source: row?.lyrics_source ?? null,
  };
}

// ── Resolver input normalization ───────────────────────────────────────────

export type LyricsSearchMode = 'original' | 'karaoke' | 'mr';

export interface SongLookup {
  song: string;
  artist: string | null;
  /** 0..1 — below LOW_CONFIDENCE the caller must NOT show a guessed match. */
  confidence: number;
  /** Why confidence is low (for logs / fallback copy), when applicable. */
  reason?: string;
}

export const LOW_CONFIDENCE = 0.4;

// Karaoke / MR / performance / quality suffixes to strip before a lyrics lookup.
// Korean terms carry no \b (it never borders a Hangul syllable).
// NOTE: multi-word "… video" phrases come BEFORE bare `lyrics?` so the phrase wins
// (else `lyric` is eaten first, orphaning "video"). Bare "video" is NOT stripped —
// it can be part of a real title (e.g. "Video Games").
const MODE_NOISE =
  /\b(?:lyric\s*video|music\s*video|official\s*video|official\s*audio|official|lyrics?|karaoke|instrumental|inst\.?|mr|minus\s*one|off\s*vocal|backing\s*track|live|cover|remix|audio|mv|m\/v|hd|hq|4k|8k|full\s*version|clean|explicit)\b|가라오케|노래방|반주|엠알|자막|가사|라이브|커버/gi;
const FEAT = /\s*[([]?\s*(?:feat\.?|ft\.?|featuring|with)\s+[^)\]]*[)\]]?/gi;
const EMPTY_PARENS = /[([【][\s.,;:/·|-]*[)\]】]/g;
// A residue that's just a karaoke catalog code or pure punctuation/number — not a
// real song name (e.g. an MR upload whose "title" was only "TJ 12345").
const NON_TITLE = /^[\s\d.,;:/·|()\[\]-]*$/;

/**
 * Best-effort { song, artist, confidence } for a lyrics lookup from a YouTube
 * result. Reuses the karaoke title cleaner, then strips mode-specific suffixes.
 * Conservative: aggressive stripping that empties the title collapses confidence
 * rather than inventing a match. `mode` defaults to 'original'; 'karaoke' / 'mr'
 * strip the extra sing-along / backing-track vocabulary so the ORIGINAL song is
 * matched, never the MR upload's filename.
 */
export function normalizeSongForLyrics(input: {
  youtubeTitle?: string | null;
  channelTitle?: string | null;
  searchQuery?: string | null;
  artist?: string | null;
  songTitle?: string | null;
  mode?: LyricsSearchMode;
}): SongLookup {
  // An explicit song/artist (e.g. from a future structured source) wins outright.
  const explicitSong = input.songTitle?.trim();
  if (explicitSong) {
    return { song: explicitSong, artist: input.artist?.trim() || null, confidence: 0.95 };
  }

  const rawTitle = input.youtubeTitle?.trim() || input.searchQuery?.trim() || '';
  if (!rawTitle) {
    return { song: '', artist: null, confidence: 0, reason: 'no-title' };
  }

  // Start from the shared karaoke cleaner (brackets, catalog codes, brand tails).
  const base = displaySong(rawTitle, input.channelTitle);
  let song = cleanSongTitle(base.song)
    .replace(FEAT, ' ')
    .replace(MODE_NOISE, ' ')
    .replace(EMPTY_PARENS, ' ')
    .replace(/[\s\-–—]+$/g, '')
    .replace(/^[\s\-–—]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  const rawArtist = input.artist?.trim() || base.artist || '';
  const artist =
    rawArtist
      .replace(MODE_NOISE, ' ')
      .replace(/[([【][^)\]】]*[)\]】]/g, ' ')
      .replace(/[\s\-–—]+$/g, '')
      .replace(/\s+/g, ' ')
      .trim() || null;

  // Confidence: start high, penalize when normalization left little to match, the
  // original was a heavy MR/karaoke upload, or the residue isn't a real title.
  let confidence = 0.85;
  let reason: string | undefined;
  if (!song || NON_TITLE.test(song)) {
    confidence = 0.1;
    reason = 'no-song-after-normalize';
    song = '';
  } else if (song.length < 2) {
    confidence = 0.3;
    reason = 'too-short';
  } else if (!artist) {
    // A real song with no artist is still searchable (many karaoke titles lack a
    // clean artist); the CANDIDATE scorer, not this step, guards a wrong artist.
    confidence = Math.min(confidence, 0.6);
  }

  return { song, artist, confidence, reason };
}

// ── Candidate scoring (LRCLIB or any future provider) ──────────────────────

/** One provider result to score against our normalized {song, artist}. */
export interface LyricsCandidate {
  trackName?: string | null;
  artistName?: string | null;
  albumName?: string | null;
  duration?: number | null;
  instrumental?: boolean | null;
  plainLyrics?: string | null;
  syncedLyrics?: string | null;
}

/** Below this a match is treated as too weak → the caller shows 'unavailable'. */
export const LYRICS_MATCH_THRESHOLD = 0.62;

/** Normalize a name to a comparable form: lowercase, keep Hangul + alphanumerics. */
function normName(s: string | null | undefined): string {
  return (s ?? '')
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[^0-9a-z가-힣㄰-㆏]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokens(s: string): string[] {
  const n = normName(s);
  return n ? n.split(' ') : [];
}

/**
 * Recall-oriented overlap: how much of `want` is present in `have`, with a strong
 * bonus when the whole normalized `want` is a substring of `have` (handles LRCLIB's
 * bilingual titles like "Through the Night (밤편지)" matching a query of "밤편지").
 * Returns 0..1. An empty `want` returns a neutral 0.5 (nothing to disprove).
 */
function overlap(want: string, have: string): number {
  const w = tokens(want);
  if (!w.length) return 0.5;
  const h = new Set(tokens(have));
  const hits = w.filter((t) => h.has(t)).length;
  let score = hits / w.length;
  const wJoined = normName(want).replace(/\s+/g, '');
  const hJoined = normName(have).replace(/\s+/g, '');
  if (wJoined && hJoined.includes(wJoined)) score = Math.max(score, 0.9);
  return Math.min(1, score);
}

/**
 * Score a provider candidate against our normalized query, 0..1. Requirements:
 *  - The candidate MUST carry usable lyrics (plain or synced) and not be flagged
 *    instrumental — otherwise it scores 0 (never show an empty/instrumental match).
 *  - Title match dominates; artist match refines. When we have no query artist,
 *    the title alone can still clear the bar (many karaoke titles lack a clean
 *    artist), but the ceiling is lower so a wrong-artist song can't sneak through.
 */
export function scoreLyricsCandidate(
  query: { song: string; artist: string | null },
  cand: LyricsCandidate,
): number {
  const hasLyrics = Boolean(cand.plainLyrics?.trim() || cand.syncedLyrics?.trim());
  if (!hasLyrics || cand.instrumental) return 0;
  if (!query.song?.trim()) return 0;

  // The query side (a YouTube title) is messy and often jumbles artist+song
  // ("IU(아이유) _ Love wins all"); the candidate side (LRCLIB) is clean. So build a
  // haystack from our derived song+artist and measure BOTH directions: how much of
  // the clean candidate title appears in our messy query, and vice-versa.
  const hay = `${query.song} ${query.artist ?? ''}`;
  const titleScore = Math.max(overlap(cand.trackName ?? '', hay), overlap(query.song, cand.trackName ?? ''));
  const candArtist = normName(cand.artistName);
  const artistScore = candArtist ? overlap(cand.artistName ?? '', hay) : 0.5;

  // The candidate's artist IS reflected in our query → confident weighted score.
  if (artistScore >= 0.34) return titleScore * 0.7 + artistScore * 0.3;

  // The candidate's artist is NOT in our query:
  //  - we HAD a query artist that disagrees → likely the wrong song, cap hard.
  //  - we had NO artist to check → accept ONLY a strong title-only match, capped.
  if (query.artist) return Math.min(titleScore, 0.5);
  return titleScore >= 0.85 ? Math.min(titleScore, 0.72) : Math.min(titleScore, 0.5);
}

/** Best scoring candidate at or above the threshold, else null. Stable on ties. */
export function pickBestLyricsCandidate(
  query: { song: string; artist: string | null },
  candidates: readonly LyricsCandidate[],
): { candidate: LyricsCandidate; score: number } | null {
  let best: { candidate: LyricsCandidate; score: number } | null = null;
  for (const candidate of candidates) {
    const score = scoreLyricsCandidate(query, candidate);
    if (score > (best?.score ?? -1)) best = { candidate, score };
  }
  return best && best.score >= LYRICS_MATCH_THRESHOLD ? best : null;
}

/**
 * Stable identity for a song, independent of request id, so a repeated song
 * reuses a verified result. `artist::song`, each normalized; missing artist → '?'.
 */
export function canonicalTrackKey(song: string, artist: string | null | undefined): string {
  const s = normName(song).replace(/\s+/g, '-');
  const a = normName(artist).replace(/\s+/g, '-') || '?';
  return `${a}::${s}`;
}
