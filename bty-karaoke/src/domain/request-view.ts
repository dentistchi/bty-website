// Pure projection of a stored request to what the DJ/guest sees. The visible
// label MUST NEVER be the opaque youtube_video_id.

export interface RequestTitleSource {
  youtube_title?: string | null;
  search_query?: string | null;
  youtube_video_id: string;
}

/**
 * Human-readable label for a request. Prefers the real YouTube title, then the
 * original search query, then a neutral placeholder — never the video id.
 */
export function requestDisplayTitle(r: RequestTitleSource): string {
  const title = r.youtube_title?.trim();
  if (title) return title;
  const query = r.search_query?.trim();
  if (query) return query;
  return 'Untitled request';
}
