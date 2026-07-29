// Pure "방금 부른 노래" (Recently Sung) model — BUILD 20B-WEB7.
//
// Mirrors the device-proven Native OPTION B contract. A performance is recorded
// ONLY when a request this Guest canonically OWNED was observed PLAYING and then
// left the stage while the SAME Event stayed live — never inferred from title /
// artist / videoId, never from a page reload, never from a failed poll, and never
// from an EVENT_ENDED / Event-change cleanup.
//
// Recorded identity is the `requestId` (so the same song sung twice yields two
// rows). The saved-song identity, by contrast, is the `videoId` — see
// `saved-songs.ts`. No I/O, no side effects.

import type { GuestQueueState } from './queue';

export interface RecentlySung {
  requestId: string;
  videoId: string | null;
  title: string;
  artist: string | null;
  thumbnailUrl: string | null;
  /** epoch ms the performance was recorded (newest-first ordering key). */
  sungAt: number;
}

/** In-flight proof that an OWNED request was seen on stage this session. */
export interface PlayingSnapshot {
  requestId: string;
  videoId: string | null;
  title: string;
  artist: string | null;
  thumbnailUrl: string | null;
}

export const RECENTLY_SUNG_MAX = 10;

/**
 * localStorage key for the recorded performances. Event-scoped like `myRequestsKey`:
 * "방금" is a within-Event notion and requestIds are Event-scoped, so a new Event
 * starts a fresh list. Falls back to a room-scoped key when no Event id is known.
 */
export function recentlySungKey(slug: string, eventId?: string | null): string {
  return eventId
    ? `bty-karaoke:${slug}:${eventId}:recently-sung`
    : `bty-karaoke:${slug}:recently-sung`;
}

/** Tolerant parse of the stored list — always returns a clean, capped array. */
export function parseRecentlySung(raw: string | null): RecentlySung[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return [];
    const rows: RecentlySung[] = [];
    for (const r of arr) {
      if (!r || typeof r !== 'object') continue;
      const o = r as Record<string, unknown>;
      if (typeof o.requestId !== 'string' || !o.requestId) continue;
      rows.push({
        requestId: o.requestId,
        videoId: typeof o.videoId === 'string' ? o.videoId : null,
        title: typeof o.title === 'string' ? o.title : '',
        artist: typeof o.artist === 'string' ? o.artist : null,
        thumbnailUrl: typeof o.thumbnailUrl === 'string' ? o.thumbnailUrl : null,
        sungAt: typeof o.sungAt === 'number' ? o.sungAt : 0,
      });
    }
    return capRecentlySung(dedupeByRequestId(rows));
  } catch {
    return [];
  }
}

/** Keep the first occurrence of each requestId, then the newest RECENTLY_SUNG_MAX. */
export function dedupeByRequestId(list: readonly RecentlySung[]): RecentlySung[] {
  const seen = new Set<string>();
  const out: RecentlySung[] = [];
  for (const r of list) {
    if (seen.has(r.requestId)) continue;
    seen.add(r.requestId);
    out.push(r);
  }
  return out;
}

/** Newest-first, capped at RECENTLY_SUNG_MAX. */
export function capRecentlySung(list: readonly RecentlySung[]): RecentlySung[] {
  return [...list].sort((a, b) => b.sungAt - a.sungAt).slice(0, RECENTLY_SUNG_MAX);
}

/** Merge a freshly-recorded performance in (dedup by requestId, newest-first, capped). */
export function addRecentlySung(list: readonly RecentlySung[], entry: RecentlySung): RecentlySung[] {
  return capRecentlySung(dedupeByRequestId([entry, ...list]));
}

/** One own request's live status, projected for the reconciler. */
export interface OwnStatusRow {
  requestId: string;
  state: GuestQueueState;
  videoId: string | null;
  title: string;
  artist: string | null;
  thumbnailUrl: string | null;
}

export interface ReconcileInput {
  /** This Guest's own requests with their canonical live state THIS poll. */
  own: readonly OwnStatusRow[];
  /** Unresolved own-playing proofs carried from the previous poll (by requestId). */
  unresolved: Readonly<Record<string, PlayingSnapshot>>;
  /**
   * The Event is still the SAME live Event this screen opened (not ended, id
   * unchanged). When false, NOTHING is recorded and every proof is dropped — an
   * EVENT_ENDED or Event replacement must never manufacture history.
   */
  eventActive: boolean;
  /**
   * The canonical refresh for this tick succeeded. A failed polling response must
   * never be read as "the song left the stage" — proofs are held, nothing recorded.
   */
  pollOk: boolean;
  /** epoch ms stamped on any performance recorded this tick. */
  nowMs: number;
}

export interface ReconcileResult {
  /** The proofs to carry into the next poll. */
  unresolved: Record<string, PlayingSnapshot>;
  /** Performances that just completed — append these (order: as discovered). */
  recorded: RecentlySung[];
}

/**
 * OPTION B reconciler. Given this poll's own statuses and the proofs carried from
 * the prior poll, decide which owned performances just completed.
 *
 * RECORD a performance iff a request that was proven own+playing in a prior poll is
 * now `done` (finished) OR `not_found` (gone from the active queue after playing) —
 * AND the Event is still live AND this poll succeeded.
 *
 * NEVER record for: waiting / up_next / still now_playing (no transition yet),
 * `removed` (cancelled), a failed poll, or an inactive/replaced Event. A request
 * only enters the proof set by being seen `now_playing`, so a page reload with no
 * retained proof records nothing.
 */
export function reconcileRecentlySung(input: ReconcileInput): ReconcileResult {
  const { own, unresolved, eventActive, pollOk, nowMs } = input;

  // Failed poll → hold everything, record nothing (a blip is not "left the stage").
  if (!pollOk) return { unresolved: { ...unresolved }, recorded: [] };

  // Event ended / replaced → drop every proof, record nothing (no false history).
  if (!eventActive) return { unresolved: {}, recorded: [] };

  const next: Record<string, PlayingSnapshot> = { ...unresolved };
  const recorded: RecentlySung[] = [];
  const ownById = new Map(own.map((r) => [r.requestId, r]));

  // 1) Capture fresh proof: any own request seen on stage right now.
  for (const r of own) {
    if (r.state === 'now_playing') {
      next[r.requestId] = {
        requestId: r.requestId,
        videoId: r.videoId,
        title: r.title,
        artist: r.artist,
        thumbnailUrl: r.thumbnailUrl,
      };
    }
  }

  // 2) Resolve proofs whose request has left the stage.
  for (const requestId of Object.keys(next)) {
    const row = ownById.get(requestId);
    // A request we hold proof for but no longer poll (dropped from own list) — its
    // last observed state is unknown this tick; keep the proof until we can classify.
    if (!row) continue;
    if (row.state === 'now_playing') continue; // still singing — keep proof

    if (row.state === 'done' || row.state === 'not_found') {
      const proof = next[requestId];
      recorded.push({
        requestId,
        videoId: proof.videoId,
        title: proof.title,
        artist: proof.artist,
        thumbnailUrl: proof.thumbnailUrl,
        sungAt: nowMs,
      });
      delete next[requestId];
    } else if (row.state === 'removed') {
      // Cancelled after we (somehow) saw it — never a performance. Drop, don't record.
      delete next[requestId];
    }
    // waiting / up_next: a playing song cannot regress to waiting; keep proof as a
    // conservative no-op rather than recording on an impossible transition.
  }

  return { unresolved: next, recorded };
}
