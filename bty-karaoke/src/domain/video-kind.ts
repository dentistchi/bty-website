// Conservative classifier: guess whether a YouTube result is a karaoke/lyrics
// video (likely to show on-screen words on the TV) vs an official audio/music
// video. Pure — title + channel text only, no network. We label ONLY on clear
// evidence; anything ambiguous stays 'unknown' and shows no badge, so the app
// never claims lyrics it can't see.

export type VideoKind = 'karaoke' | 'lyrics' | 'official' | 'mv' | 'unknown';

const KARAOKE = /karaoke|가라오케|노래방|instrumental|\bmr\b|\b반주\b|sing[\s-]?along|backing track/i;
const LYRICS = /lyric|가사|자막|lyaerics|字幕/i;
const MV = /official\s*(music)?\s*video|뮤직비디오|\bm\/v\b|\bmv\b|vevo/i;
const OFFICIAL = /official\s*audio|\baudio\b|-\s*topic|official\s*lyric/i;

/**
 * Classify a result. Priority: karaoke → lyrics → mv → official → unknown.
 * (Karaoke/lyrics come first because those are the ones a DJ wants for words on
 * the TV; MV before official so "official music video" isn't mislabelled audio.)
 */
export function classifyVideo(title: string, channel = ''): VideoKind {
  const hay = `${title ?? ''} ${channel ?? ''}`;
  if (KARAOKE.test(hay)) return 'karaoke';
  if (LYRICS.test(hay)) return 'lyrics';
  if (MV.test(hay)) return 'mv';
  if (OFFICIAL.test(hay)) return 'official';
  return 'unknown';
}

export interface VideoBadge {
  label: string;
  emoji: string;
  /** CSS tone class suffix used by the badge styles. */
  tone: 'karaoke' | 'lyrics' | 'audio' | 'mv';
}

/**
 * Badge for a kind, or null when there's no confident label (unknown). Karaoke
 * and lyrics share the "likely has on-screen words" family (gold), audio/mv are
 * neutral. Labels are short and read the same in the KO guest and EN DJ UIs.
 */
export function badgeForKind(kind: VideoKind): VideoBadge | null {
  switch (kind) {
    case 'karaoke':
      return { label: 'Karaoke', emoji: '🎤', tone: 'karaoke' };
    case 'lyrics':
      return { label: 'Lyrics', emoji: '🎤', tone: 'lyrics' };
    case 'official':
      return { label: 'Audio', emoji: '🎵', tone: 'audio' };
    case 'mv':
      return { label: 'MV', emoji: '🎬', tone: 'mv' };
    default:
      return null;
  }
}

/** Convenience: badge straight from title/channel. */
export function badgeForVideo(title: string, channel = ''): VideoBadge | null {
  return badgeForKind(classifyVideo(title, channel));
}
