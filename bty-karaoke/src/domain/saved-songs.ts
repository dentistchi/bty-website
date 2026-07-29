// Pure client-side model for the web Guest's SAVED songs ("내 노래") — BUILD 20B-WEB7.
//
// Parity with the device-proven Native My Songs contract. Saved identity is the
// YouTube `videoId`; a saved row is a small display snapshot. This is presentation
// state a Guest carries on their device — never queue truth, never an account.
//
// SCOPE (critical): the anonymous library is NOT scoped to Room / Event / guest
// name / cancel-capability. It is a single device-local list that survives a page
// refresh, an Event change, a Room exit, and a Guest-session rotation. That is why
// the key below carries no slug/eventId — unlike `myRequestsKey` (ownership data,
// which MUST NOT cross an Event boundary). No I/O, no side effects.

export interface SavedSong {
  videoId: string;
  title: string;
  artist: string | null;
  thumbnailUrl: string | null;
  /** epoch ms the song was saved on this device (newest-first ordering key). */
  savedAt: number;
}

/** The snapshot a caller supplies when saving (savedAt is stamped by the store). */
export interface SavedSongSnapshot {
  videoId: string;
  title: string;
  artist: string | null;
  thumbnailUrl: string | null;
}

/**
 * localStorage key for the anonymous device library. GLOBAL by design — no slug and
 * no eventId — so the same saved songs are visible in every Room/Event on this
 * device and survive a Guest-session rotation. (Contrast `myRequestsKey`, which is
 * Event-scoped because it carries cancel/ownership capabilities.)
 */
export const SAVED_SONGS_KEY = 'bty-karaoke:saved-songs';

/** Bounded so a device library can never grow without limit. Newest kept. */
export const SAVED_SONGS_MAX = 200;

const YOUTUBE_VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

/** True iff `videoId` is a well-formed YouTube id (guards against manual junk). */
export function isValidVideoId(videoId: string | null | undefined): boolean {
  return !!videoId && YOUTUBE_VIDEO_ID.test(videoId);
}

/** Tolerant parse of a stored library — always returns a clean, sorted array. */
export function parseSavedSongs(raw: string | null): SavedSong[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return [];
    const rows: SavedSong[] = [];
    for (const r of arr) {
      if (!r || typeof r !== 'object') continue;
      const o = r as Record<string, unknown>;
      if (!isValidVideoId(o.videoId as string)) continue;
      rows.push({
        videoId: o.videoId as string,
        title: typeof o.title === 'string' ? o.title : '',
        artist: typeof o.artist === 'string' ? o.artist : null,
        thumbnailUrl: typeof o.thumbnailUrl === 'string' ? o.thumbnailUrl : null,
        savedAt: typeof o.savedAt === 'number' ? o.savedAt : 0,
      });
    }
    return sortSavedNewestFirst(dedupeByVideoId(rows));
  } catch {
    return [];
  }
}

/** Newest-first (highest savedAt first); stable for equal timestamps. */
export function sortSavedNewestFirst(list: readonly SavedSong[]): SavedSong[] {
  return [...list].sort((a, b) => b.savedAt - a.savedAt);
}

/** Keep only the first occurrence of each videoId (input order preserved). */
export function dedupeByVideoId(list: readonly SavedSong[]): SavedSong[] {
  const seen = new Set<string>();
  const out: SavedSong[] = [];
  for (const s of list) {
    if (seen.has(s.videoId)) continue;
    seen.add(s.videoId);
    out.push(s);
  }
  return out;
}

/** Is this videoId already saved? */
export function containsSaved(list: readonly SavedSong[], videoId: string): boolean {
  return list.some((s) => s.videoId === videoId);
}

/**
 * Insert or refresh a saved song, newest-first, capped at SAVED_SONGS_MAX. Saving an
 * already-saved videoId refreshes its snapshot and bumps it to the front (idempotent
 * on identity — never a duplicate row). Invalid video ids are ignored (returns the
 * list unchanged) so a malformed manual entry can never poison the library.
 */
export function upsertSaved(
  list: readonly SavedSong[],
  snapshot: SavedSongSnapshot,
  nowMs: number,
): SavedSong[] {
  if (!isValidVideoId(snapshot.videoId)) return [...list];
  const without = list.filter((s) => s.videoId !== snapshot.videoId);
  const entry: SavedSong = {
    videoId: snapshot.videoId,
    title: snapshot.title,
    artist: snapshot.artist ?? null,
    thumbnailUrl: snapshot.thumbnailUrl ?? null,
    savedAt: nowMs,
  };
  return sortSavedNewestFirst([entry, ...without]).slice(0, SAVED_SONGS_MAX);
}

/** Remove a saved song by videoId (idempotent — absent id → unchanged list). */
export function removeSaved(list: readonly SavedSong[], videoId: string): SavedSong[] {
  return list.filter((s) => s.videoId !== videoId);
}

/** Map a BUILD 20A server SavedSong (createdAt ISO) to the client shape. */
export function fromServerSavedSong(row: {
  videoId: string;
  title: string;
  artist: string | null;
  thumbnailUrl: string | null;
  createdAt: string;
}): SavedSong {
  const ms = Date.parse(row.createdAt);
  return {
    videoId: row.videoId,
    title: row.title,
    artist: row.artist ?? null,
    thumbnailUrl: row.thumbnailUrl ?? null,
    savedAt: Number.isFinite(ms) ? ms : 0,
  };
}
