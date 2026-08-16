// BUILD 26T-R1B-R6-R1B-R6 §H — the approved MARK_UNAVAILABLE copy, in ONE place.
//
// Pure: no I/O, no DOM. Every surface that renders an unavailable row reads from here, so the
// ratified wording cannot drift between web, native and history views.
//
// WHAT THIS DELIBERATELY DOES NOT SAY. HARD_UNAVAILABLE is established by one fact — an
// authoritative YouTube response in which the video id was absent. That does NOT establish
// *why*: deleted, private and some region restrictions are indistinguishable in that response.
// So the copy never claims "deleted", "private" or "removed by YouTube". Saying any of them would
// be asserting a reason we did not measure.

export type UnavailableLocale = 'en' | 'ko';

export interface UnavailableCopy {
  /** Replaces the stale YouTube title. */
  title: string;
  /** Explanatory body, where the layout naturally supports it. */
  body: string;
}

const COPY: Record<UnavailableLocale, UnavailableCopy> = {
  en: {
    title: 'YouTube video unavailable',
    body: 'This video is currently unavailable through YouTube.',
  },
  ko: {
    title: 'YouTube 동영상을 사용할 수 없음',
    body: '현재 YouTube를 통해 이 동영상을 이용할 수 없습니다.',
  },
};

/** The approved copy for a locale. Anything unrecognised falls back to English. */
export function unavailableCopy(locale: string | null | undefined): UnavailableCopy {
  return COPY[String(locale).toLowerCase().startsWith('ko') ? 'ko' : 'en'];
}

/**
 * R6 §L — may the "Developed with YouTube" attribution appear on this row?
 *
 * NO for an unavailable row. Its API fields have been CLEARED, so it is not a live current YouTube
 * API presentation — it is BTY history about something that used to be one. Attributing it would
 * claim a live-API surface that no longer exists, and the fact that the copy happens to contain the
 * word "YouTube" is not what earns the mark.
 *
 * The previously measured contract is unchanged: live API result surfaces carry the mark, stored
 * and unavailable BTY history does not.
 */
export function showsYouTubeAttribution(row: { youtubeUnavailable?: boolean }): boolean {
  return row.youtubeUnavailable !== true;
}
