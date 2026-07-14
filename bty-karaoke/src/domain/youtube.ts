// Pure parsing of guest-entered YouTube input. No network, no API key.
// Accepts a full URL (watch, youtu.be, shorts, embed) or a bare 11-char id.

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

/** Extract a canonical 11-char YouTube video id, or null if none is found. */
export function parseYoutubeVideoId(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;

  // Bare id.
  if (VIDEO_ID.test(raw)) return raw;

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./, '');

  // youtu.be/<id>
  if (host === 'youtu.be') {
    const id = url.pathname.slice(1).split('/')[0];
    return VIDEO_ID.test(id) ? id : null;
  }

  if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
    // watch?v=<id>
    const v = url.searchParams.get('v');
    if (v && VIDEO_ID.test(v)) return v;

    // /shorts/<id> or /embed/<id> or /v/<id>
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts.length >= 2 && ['shorts', 'embed', 'v'].includes(parts[0])) {
      return VIDEO_ID.test(parts[1]) ? parts[1] : null;
    }
  }

  return null;
}

/** True iff `id` is a canonical 11-char YouTube video id. */
export function isValidVideoId(id: string | null | undefined): boolean {
  return typeof id === 'string' && VIDEO_ID.test(id);
}

/**
 * Canonical https watch URL for a VALIDATED video id, or null when the id is not
 * a well-formed 11-char id. Returning null (never a URL) for anything malformed
 * is the guard that keeps a bad/stored id from producing a javascript: or
 * otherwise unexpected navigation target — callers must no-op on null.
 */
export function safeYoutubeWatchUrl(videoId: string | null | undefined): string | null {
  if (!isValidVideoId(videoId)) return null;
  // The id charset ([A-Za-z0-9_-]) is URL-safe, so this is a pure https URL.
  return `https://www.youtube.com/watch?v=${videoId}`;
}
