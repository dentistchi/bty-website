// Pure "live event presence" resolver for the guest screen. No I/O — the server
// hands in the event's active rows + counts and this shapes the PUBLIC guest view
// (event identity, now-singing, up-next, counts). One canonical resolver so the
// guest client never interprets raw rows or re-sorts the queue itself.

import { canonicalRank, type RequestStatus } from './queue';
import { requestDisplayTitle } from './request-view';

export type EventStatus = 'draft' | 'active' | 'ended' | 'archived';

/** Minimal active-row shape the resolver needs (waiting/playing rows only). */
export interface LiveRow {
  id: string;
  status: RequestStatus;
  position: number;
  created_at: string;
  started_at: string | null;
  guest_name: string;
  youtube_title: string | null;
  search_query: string | null;
  youtube_video_id: string | null;
  youtube_thumbnail_url: string | null;
  /** R6 §E/§K — YouTube content determined HARD_UNAVAILABLE; a separate axis from status. */
  youtube_unavailable?: boolean;
}

export interface NowPlayingSlot {
  title: string;
  guestName: string;
  thumbnailUrl: string | null;
  startedAt: string | null;
}
export interface UpNextSlot {
  title: string;
  guestName: string;
  thumbnailUrl: string | null;
}

export interface GuestLivePresence {
  event: { name: string; hostName: string | null; status: EventStatus };
  nowPlaying: NowPlayingSlot | null;
  upNext: UpNextSlot | null;
  counts: { guests: number; requests: number; waiting: number };
}

/** The one-line state a guest reads at a glance. Drives the card + UI tests. */
export type PresenceState =
  | 'ended'
  | 'now_singing_up_next'
  | 'now_singing'
  | 'up_next'
  | 'ready';

/**
 * started_at DESC (newest first; nulls last), then canonical queue order. Used to
 * pick a single deterministic "now singing" row even if the data ever shows more
 * than one `playing` (an anomaly we never surface to the guest).
 */
function byMostRecentlyStarted(a: LiveRow, b: LiveRow): number {
  const ta = a.started_at ? Date.parse(a.started_at) : -Infinity;
  const tb = b.started_at ? Date.parse(b.started_at) : -Infinity;
  if (ta !== tb) return tb - ta;
  return canonicalRank(a, b);
}

function nowSlot(r: LiveRow): NowPlayingSlot {
  return {
    title: requestDisplayTitle(r),
    guestName: r.guest_name,
    thumbnailUrl: r.youtube_thumbnail_url ?? null,
    startedAt: r.started_at,
  };
}
function upNextSlot(r: LiveRow): UpNextSlot {
  return {
    title: requestDisplayTitle(r),
    guestName: r.guest_name,
    thumbnailUrl: r.youtube_thumbnail_url ?? null,
  };
}

/**
 * Resolve now-playing + up-next from the event's active rows (any order).
 * - now-playing: the single `playing` row (most-recently-started wins on anomaly)
 * - up-next: the first `waiting` row in canonical order, EXCLUDING now-playing
 * Never mutates its input.
 */
export function selectLivePresence(active: readonly LiveRow[]): {
  nowPlaying: NowPlayingSlot | null;
  upNext: UpNextSlot | null;
} {
  const playing = active.filter((r) => r.status === 'playing').slice().sort(byMostRecentlyStarted);
  const current = playing[0] ?? null;

  const waiting = active
    .filter((r) => r.status === 'waiting' && r.id !== current?.id)
    .slice()
    .sort(canonicalRank);
  const next = waiting[0] ?? null;

  return { nowPlaying: current ? nowSlot(current) : null, upNext: next ? upNextSlot(next) : null };
}

/** The presentation state a guest sees, derived from a resolved presence. */
export function presenceState(p: GuestLivePresence): PresenceState {
  if (p.event.status === 'ended' || p.event.status === 'archived') return 'ended';
  if (p.nowPlaying && p.upNext) return 'now_singing_up_next';
  if (p.nowPlaying) return 'now_singing';
  if (p.upNext) return 'up_next';
  return 'ready';
}

/**
 * Compact "how long the event has been live" label from its start instant, e.g.
 * "1h 24m" / "24m" / "<1m". Empty string when there is no start time. Pure so the
 * DJ header and the status sheet format duration identically (caller passes now).
 */
export function formatEventDuration(startIso: string | null, nowMs: number): string {
  if (!startIso) return '';
  const ms = nowMs - Date.parse(startIso);
  if (!Number.isFinite(ms) || ms < 0) return '0m';
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (totalMin > 0) return `${m}m`;
  return '<1m';
}
