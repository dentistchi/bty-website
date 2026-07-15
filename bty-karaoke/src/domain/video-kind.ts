// Conservative classifier: guess whether a YouTube result is a karaoke/lyrics
// video (likely to show on-screen words on the TV) vs an official audio/music
// video. Pure — title + channel text only, no network. We label ONLY on clear
// evidence; anything ambiguous stays 'unknown' and shows no badge, so the app
// never claims lyrics it can't see.

export type VideoKind = 'mr' | 'karaoke' | 'lyrics' | 'official' | 'mv' | 'unknown';

// Clear "no vocals" backing-track evidence — the STRONGEST MR signal. It wins
// even over a karaoke-provider tag: "karaoke instrumental" is an MR. Korean terms
// use no \b (the ASCII \b never sits beside a Hangul syllable).
const INSTRUMENTAL = /instrumental|반주|backing\s*track|minus\s*one|off\s*vocal/i;
// Karaoke sing-along / provider signals (on-screen words). A provider (TJ / 금영 /
// KY) or 노래방 / karaoke means the karaoke version — classified karaoke even when
// the title ALSO says "MR" (a TJ "MR" is still the sing-along karaoke), UNLESS the
// title is clearly instrumental (handled above). Reflects real search results.
const KARAOKE = /karaoke|가라오케|노래방|sing[\s-]?along|\btj\b|티제이|금영|\bky\b/i;
// A bare MR abbreviation with NO karaoke signal → an MR track.
const MR_TOKEN = /\bmr\b|엠알|\binst\b|inst\./i;
const LYRICS = /lyric|가사|자막|lyaerics|字幕/i;
const MV = /official\s*(music)?\s*video|뮤직비디오|\bm\/v\b|\bmv\b|vevo/i;
const OFFICIAL = /official\s*audio|\baudio\b|-\s*topic|official\s*lyric/i;

/**
 * Classify a result. Priority (V5.2):
 *   instrumental → karaoke(provider/sing-along) → MR-token → lyrics → mv →
 *   official → unknown.
 * Clear instrumental evidence is MR first; a karaoke provider/노래방 tag then
 * wins over a bare "MR" token (a TJ/금영 "MR" is the karaoke sing-along version);
 * a bare "MR" with no karaoke signal is an MR. Anything ambiguous stays 'unknown'
 * so the app never claims a kind it can't see.
 */
export function classifyVideo(title: string, channel = ''): VideoKind {
  const hay = `${title ?? ''} ${channel ?? ''}`;
  if (INSTRUMENTAL.test(hay)) return 'mr';
  if (KARAOKE.test(hay)) return 'karaoke';
  if (MR_TOKEN.test(hay)) return 'mr';
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
