// Conservative classifier: guess whether a YouTube result is a karaoke/lyrics
// video (likely to show on-screen words on the TV) vs an official audio/music
// video. Pure — title + channel text only, no network. We label ONLY on clear
// evidence; anything ambiguous stays 'unknown' and shows no badge, so the app
// never claims lyrics it can't see.

export type VideoKind = 'mr' | 'karaoke' | 'lyrics' | 'official' | 'mv' | 'unknown';

// MR = a backing track with vocals removed (the DEFAULT performance style). It's
// distinguished from a karaoke video FIRST, on clear "no vocals" evidence, so an
// MR result shows a 🎹 badge rather than being lumped in with lyric-bearing
// karaoke clips. Conservative: only obvious MR terms count.
// Korean terms use no \b — the regex \b is ASCII-word based and never sits
// beside a Hangul syllable, so \b반주\b would never match.
const MR = /instrumental|\bmr\b|반주|backing\s*track|minus\s*one|off\s*vocal/i;
const KARAOKE = /karaoke|가라오케|노래방|sing[\s-]?along/i;
const LYRICS = /lyric|가사|자막|lyaerics|字幕/i;
const MV = /official\s*(music)?\s*video|뮤직비디오|\bm\/v\b|\bmv\b|vevo/i;
const OFFICIAL = /official\s*audio|\baudio\b|-\s*topic|official\s*lyric/i;

/**
 * Classify a result. Priority: mr → karaoke → lyrics → mv → official → unknown.
 * MR comes first (its own "no vocals" family); karaoke/lyrics next because those
 * are the ones likely to show words on the TV; MV before official so "official
 * music video" isn't mislabelled audio. Anything ambiguous stays 'unknown'.
 */
export function classifyVideo(title: string, channel = ''): VideoKind {
  const hay = `${title ?? ''} ${channel ?? ''}`;
  if (MR.test(hay)) return 'mr';
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
  tone: 'mr' | 'karaoke' | 'lyrics' | 'audio' | 'mv';
}

/**
 * Badge for a kind, or null when there's no confident label (unknown). MR is its
 * own family (🎹); karaoke and lyrics share the "likely has on-screen words"
 * family (gold); audio/mv are neutral. Labels are short and read the same in the
 * KO guest and EN DJ/Display UIs.
 */
export function badgeForKind(kind: VideoKind): VideoBadge | null {
  switch (kind) {
    case 'mr':
      return { label: 'MR', emoji: '🎹', tone: 'mr' };
    case 'karaoke':
      return { label: 'Karaoke', emoji: '🎤', tone: 'karaoke' };
    case 'lyrics':
      return { label: 'Lyrics', emoji: '📝', tone: 'lyrics' };
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
