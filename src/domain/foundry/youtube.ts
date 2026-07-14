/**
 * YouTube URL → canonical 11-char video id (pure).
 *
 * No network, no API key. We store ONLY the canonical id — never a raw iframe,
 * an arbitrary embed URL, or client-supplied metadata. The manager pastes a
 * link; this extracts the id the official IFrame Player can play.
 *
 * Supported inputs:
 *   - bare 11-char id
 *   - youtube.com / www. / m. / music. with ?v=<id>
 *   - youtu.be/<id>
 *   - /embed/<id>, /shorts/<id>, /v/<id>
 * Extra query params / trailing paths are tolerated; anything else → null.
 */

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const YT_HOSTS = new Set(["youtube.com", "m.youtube.com", "music.youtube.com"]);
const PATH_ID_PREFIXES = new Set(["embed", "shorts", "v"]);

export function parseYoutubeVideoId(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const raw = input.trim();
  if (!raw) return null;

  // Already a bare id.
  if (VIDEO_ID.test(raw)) return raw;

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") return null;

  const host = url.hostname.replace(/^www\./, "").toLowerCase();

  if (host === "youtu.be") {
    const id = url.pathname.slice(1).split("/")[0];
    return VIDEO_ID.test(id) ? id : null;
  }

  if (YT_HOSTS.has(host)) {
    const v = url.searchParams.get("v");
    if (v && VIDEO_ID.test(v)) return v;
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length >= 2 && PATH_ID_PREFIXES.has(parts[0])) {
      return VIDEO_ID.test(parts[1]) ? parts[1] : null;
    }
    return null;
  }

  return null;
}

/** The canonical watch URL for a stored id (used to build QR-independent links). */
export function youtubeWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

/** Keyless deterministic thumbnail (no Data API needed). Best-effort display only. */
export function youtubeThumbnailUrl(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}
