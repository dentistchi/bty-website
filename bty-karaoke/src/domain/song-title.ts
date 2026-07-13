// Pure title normalization so the DJ (and guest) see the actual song, not a
// noisy karaoke upload title like:
//   "[KY ENTERTAINMENT] 하여가 - 서태지와 아이들 (KY.2213) / KY Karaoke"
// No network. Best-effort and conservative: when unsure, it keeps the cleaned
// title rather than guessing a wrong artist split.

export interface SongDisplay {
  song: string;
  artist: string | null;
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
