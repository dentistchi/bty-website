// Pure projection of a stored request to what the DJ/guest sees. The visible
// label MUST NEVER be the opaque youtube_video_id.

import { unavailableCopy } from './youtube-unavailable';

export interface RequestTitleSource {
  youtube_title?: string | null;
  search_query?: string | null;
  /** NULL once a retention transition cleared it (R6). */
  youtube_video_id?: string | null;
  /** R6 §J — non-null means a factual refresh determined the content HARD_UNAVAILABLE. */
  youtube_metadata_unavailable_at?: string | null;
}

/**
 * Human-readable label for a request. Prefers the real YouTube title, then the
 * original search query, then a neutral placeholder — never the video id.
 */
export function requestDisplayTitle(r: RequestTitleSource, locale?: string | null): string {
  // R6 §J — an unavailable row shows the approved copy and NOTHING else. It deliberately does not
  // fall through to `search_query`: that is the guest's own typed text, and rendering it in the
  // title slot would present it as the song's identity when the identity is precisely what we no
  // longer have. The row's other BTY history stays visible around this label.
  if (r.youtube_metadata_unavailable_at != null) return unavailableCopy(locale).title;

  const title = r.youtube_title?.trim();
  if (title) return title;
  const query = r.search_query?.trim();
  if (query) return query;
  return 'Untitled request';
}
