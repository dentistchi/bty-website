// Pure title normalization so the DJ (and guest) see the actual song, not a
// noisy karaoke upload title like:
//   "[KY ENTERTAINMENT] 하여가 - 서태지와 아이들 (KY.2213) / KY Karaoke"
// No network. Best-effort and conservative: when unsure, it keeps the cleaned
// title rather than guessing a wrong artist split.

export interface SongDisplay {
  song: string;
  artist: string | null;
}

// ── BUILD 20B-WEB7-R1 — conservative, display-only song-title projection ──────────
//
// The ONE formatter every WEB GUEST song surface renders through. It NEVER mutates
// stored data (raw request title, videoId, saved snapshot, request payload). It
// removes ONLY explicitly-allowlisted karaoke-provider metadata, extracts a
// Song/Artist split only when unambiguous, and surfaces a compact source label
// (TJ/KY/MR/NWC). When unsure it keeps the cleaned string as the title and NEVER
// invents an artist (and never shows a karaoke company as the singer).

export interface SongDisplayMetadata {
  title: string;
  artist: string | null;
  /** Compact provider/source badge: 'TJ' | 'KY' | 'MR' | 'NWC' | null. */
  sourceLabel: string | null;
}

// Provider keyword signal — recognizes provider brackets/suffixes AND rejects a
// would-be artist that is really provider metadata. Intentionally specific: it is
// NOT a catch-all bracket stripper.
const PROVIDER_SIGNAL = /(?:\bTJ\b|\bKY\b|KUMYOUNG|금영|태진|노래방|가라오케|karaoke|\bNWC\b|MR\s*Live)/i;

// A leading provider bracket: [ … ] / 【 … 】 whose inner text is provider metadata.
const LEADING_BRACKET = /^\s*(?:\[([^\]]*)\]|【([^】]*)】)\s*/;
// A trailing provider bracket at the end of the string.
const TRAILING_BRACKET = /\s*(?:\[([^\]]*)\]|【([^】]*)】)\s*$/;
// The "노래 / MR / 가사 / 반주" catalog tail (optionally preceded by a separator).
const KARAOKE_MENU_TAIL = /\s*(?:[/·|]\s*)?노래\s*\/\s*MR\s*\/\s*가사\s*\/\s*반주\s*$/i;
// Trailing brand suffix: "/ TJ Karaoke", "/ KY 금영노래방", "· 노래방", …
const TRAILING_BRAND_SUFFIX = /\s*[/·|]\s*(?:tj|ky|kumyoung|금영|태진)?\s*(?:karaoke|금영노래방|노래방)\b.*$/i;
// A provider catalog code: (KY.86188) (KY 86188) (TJ.1234) (금영 123) …
const PROVIDER_CODE = /\(\s*(?:KY|TJ|KUMYOUNG|금영|태진)\s*[.\s]?\s*\d+\s*\)/gi;
// Channels that are karaoke companies / auto-generated, never a real singer.
const NON_ARTIST_CHANNEL = /노래방|가라오케|karaoke|금영|kumyoung|태진|공식|채널|\btopic\b|vevo|official|entertainment|records/i;

/** Longest plausible artist string on the right of a "Song - Artist" split. */
const MAX_ARTIST_LEN = 25;

/** True iff a leading/trailing bracket's inner text is allowlisted provider noise. */
function isProviderBracket(inner: string | undefined): boolean {
  return !!inner && PROVIDER_SIGNAL.test(inner);
}

/** Strip ONLY allowlisted provider noise (leading/trailing brackets, tails, codes). */
function stripProviderNoise(raw: string): string {
  let s = raw ?? '';
  // Iterate: provider metadata can appear in several positions and orders.
  for (let i = 0; i < 6; i++) {
    const before = s;
    // Leading provider bracket (e.g. "[TJ노래방] ").
    const lead = s.match(LEADING_BRACKET);
    if (lead && isProviderBracket(lead[1] ?? lead[2])) s = s.slice(lead[0].length);
    // Trailing provider bracket (e.g. " [KY 금영노래방]").
    const tail = s.match(TRAILING_BRACKET);
    if (tail && isProviderBracket(tail[1] ?? tail[2])) s = s.slice(0, s.length - tail[0].length);
    // Trailing catalog menu + brand suffixes.
    s = s.replace(KARAOKE_MENU_TAIL, ' ').replace(TRAILING_BRAND_SUFFIX, ' ');
    // Provider catalog codes anywhere.
    s = s.replace(PROVIDER_CODE, ' ');
    s = s.replace(/\s+/g, ' ').trim();
    if (s === before) break;
  }
  // Trim dangling separators left behind by a strip (e.g. "난 -", "/ 좋은 날").
  return s.replace(/^[\s/·|,–—-]+|[\s/·|,–—-]+$/g, '').trim();
}

/** Detect the compact provider/source label from the raw title + channel. */
function detectSourceLabel(rawTitle: string, channel?: string | null): string | null {
  const t = `${rawTitle ?? ''} ${channel ?? ''}`;
  if (/태진|\bTJ\b/i.test(t)) return 'TJ';
  if (/금영|KUMYOUNG|\bKY\b/i.test(t)) return 'KY';
  if (/\bNWC\b/i.test(t)) return 'NWC';
  if (/MR\s*Live|노래\s*\/\s*MR|\bMR\b/i.test(t)) return 'MR';
  return null;
}

/** A channel that is a genuine artist/uploader (not a karaoke company / auto feed). */
function artistFromChannel(channel?: string | null): string | null {
  if (!channel) return null;
  if (NON_ARTIST_CHANNEL.test(channel)) return null;
  const c = channel.replace(/-\s*topic/i, '').replace(/\s+/g, ' ').trim();
  return c || null;
}

/** Light readability touch: separate a "(" / "[" glued to the preceding word. */
function spaceBeforeBracket(s: string): string {
  return s.replace(/([^\s([])([([])/g, '$1 $2');
}

/**
 * Project a raw karaoke title (+ channel) to a clean display title/artist/source.
 * Display only — inputs are never persisted or sent back.
 */
export function songDisplay(rawTitle: string, channel?: string | null): SongDisplayMetadata {
  const sourceLabel = detectSourceLabel(rawTitle, channel);
  const cleaned = stripProviderNoise(rawTitle ?? '');

  // Split on a spaced delimiter ONLY when there is exactly one — a title with two
  // (e.g. "藤井風 - 何なんw 후지이 카제 - 뭐야ㅋ") is ambiguous → keep whole, no artist.
  const delimiters = cleaned.match(/\s[-–—]\s/g);
  if (delimiters && delimiters.length === 1) {
    const idx = cleaned.search(/\s[-–—]\s/);
    const left = cleaned.slice(0, idx).trim();
    const right = cleaned.slice(idx).replace(/^\s[-–—]\s/, '').trim();
    const validArtist =
      left.length > 0 &&
      right.length > 0 &&
      right.length <= MAX_ARTIST_LEN &&
      !PROVIDER_SIGNAL.test(right);
    if (validArtist) {
      return { title: spaceBeforeBracket(left), artist: right, sourceLabel };
    }
  }

  const title = spaceBeforeBracket(cleaned || (rawTitle ?? '').trim());
  return { title, artist: artistFromChannel(channel), sourceLabel };
}

const BRACKET_TAG = /\[[^\]]*\]|【[^】]*】/g; // [KY ENTERTAINMENT], 【MV】
const KARA_CODE = /\(\s*(?:KY|TJ|KUMYOUNG|금영|태진)[.\s]?\d+\s*\)/gi; // (KY.2213)
const TRAILING_BRAND =
  /\s*[/·|]\s*(?:tj|ky|kumyoung|금영|태진)?\s*karaoke\b.*$/i; // "/ KY Karaoke"
const KARA_WORD = /\b노래방\b|가라오케|karaoke/gi;

const KARAOKE_SIGNAL = /karaoke|노래방|가라오케|kumyoung|금영|태진|\bKY\b|\bTJ\b/i;
const CHANNEL_NOISE = /vevo|-\s*topic|official|karaoke|노래방|records|entertainment|채널/gi;

function cleanChannel(channel?: string | null): string | null {
  if (!channel) return null;
  const c = channel.replace(CHANNEL_NOISE, ' ').replace(/[()[\]]/g, ' ').replace(/\s+/g, ' ').trim();
  return c || null;
}

/** Strip bracket tags, karaoke codes, and trailing brand suffixes from a title. */
export function cleanSongTitle(rawTitle: string): string {
  return (rawTitle ?? '')
    .replace(BRACKET_TAG, ' ')
    .replace(KARA_CODE, ' ')
    .replace(TRAILING_BRAND, ' ')
    .replace(KARA_WORD, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Split a cleaned karaoke title into song + artist. In this app's
 * karaoke-biased results the channel is usually the karaoke brand and the title
 * follows "SONG - ARTIST", so we split only when there's a karaoke signal; other
 * titles keep the cleaned title as the song and use the channel as the artist.
 */
export function displaySong(rawTitle: string, channel?: string | null): SongDisplay {
  const cleaned = cleanSongTitle(rawTitle);
  const karaoke = KARAOKE_SIGNAL.test(`${rawTitle ?? ''} ${channel ?? ''}`);
  const parts = cleaned.match(/^(.+?)\s+[-–—]\s+(.+)$/);

  if (karaoke && parts) {
    return { song: parts[1].trim(), artist: parts[2].trim() || cleanChannel(channel) };
  }
  return { song: cleaned || (rawTitle ?? '').trim(), artist: cleanChannel(channel) };
}
