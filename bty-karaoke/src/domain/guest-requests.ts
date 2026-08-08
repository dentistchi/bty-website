// Pure client-side model for the guest's OWN requests this room/session. Used for
// presentation only — never canonical queue truth (each status still comes from
// the server resolver). Bounded: entries expire with the cancel-capability TTL.

import type { GuestLocale } from './guest-locale';
import { guestT } from './guest-messages';

import { canGuestCancel, type GuestQueueState } from './queue';

export const MY_REQUESTS_TTL_MS = 12 * 60 * 60 * 1000;

export interface MyRequest {
  requestId: string;
  cancelToken: string | null;
  title: string;
  artist: string | null;
  /** The selected YouTube video id — used to hand off to YouTube on Start. */
  videoId?: string | null;
  submittedAt: number; // epoch ms
}

/**
 * localStorage key for retained request IDs + cancel/owner capabilities. This
 * holds OWNERSHIP data, so V5 namespaces it by the canonical event when one is
 * known: `bty-karaoke:{slug}:{eventId}:my-requests`. Without an event id it falls
 * back to the legacy room-scoped key (V4 behavior) so nothing breaks during the
 * transition. Ownership must NEVER cross an event boundary — a different eventId
 * yields a different key, so a new event can never surface a prior event's
 * requests or capabilities.
 */
export function myRequestsKey(slug: string, eventId?: string | null): string {
  return eventId
    ? `bty-karaoke:${slug}:${eventId}:my-requests`
    : `bty-karaoke:${slug}:my-requests`;
}

/** The legacy room-scoped key (pre-V5) — read once as a transition fallback. */
export function legacyMyRequestsKey(slug: string): string {
  return `bty-karaoke:${slug}:my-requests`;
}

/** A state the guest can no longer act on (drops out of the active list). */
export function isTerminalState(state: GuestQueueState): boolean {
  return state === 'done' || state === 'removed' || state === 'not_found';
}

/**
 * A state that should be DROPPED from the owned list entirely (cancelled / gone).
 * `done` is intentionally EXCLUDED — completed requests are KEPT as today's history
 * (the "오늘 부른 노래" section), not pruned away.
 */
export function shouldDropOwned(state: GuestQueueState): boolean {
  return state === 'removed' || state === 'not_found';
}

/** Drop stale entries older than the TTL (their cancel capability has expired). */
export function pruneMyRequests(
  list: readonly MyRequest[],
  nowMs: number,
  ttl = MY_REQUESTS_TTL_MS,
): MyRequest[] {
  return list.filter((r) => r.requestId && nowMs - r.submittedAt < ttl);
}

/** Merge a new submission in, newest last, de-duplicating by requestId. */
export function addMyRequest(list: readonly MyRequest[], entry: MyRequest): MyRequest[] {
  return [...list.filter((r) => r.requestId !== entry.requestId), entry];
}

export interface CollapsedSummary {
  count: number;
  /** Soonest waiting position among the guest's own requests, or null. */
  nearestPosition: number | null;
  /** Sub-line for the collapsed pill. Unambiguous — never "N번 · N곡". */
  label: string;
}

/**
 * Compact summary for the collapsed dock pill given each active row's live
 * status. The count is shown separately ("내 신청곡 N"); this `label` is the
 * sub-line and states the NEAREST position without implying all songs share it.
 * Terminal rows never inflate the count.
 */
export function collapsedSummary(
  locale: GuestLocale,
  rows: readonly { state: GuestQueueState; position: number }[],
): CollapsedSummary {
  const active = rows.filter((r) => !isTerminalState(r.state));
  const count = active.length;
  const onStage = active.some((r) => r.state === 'now_playing');
  const waiting = active
    .filter((r) => r.state === 'waiting' || r.state === 'up_next')
    .sort((a, b) => a.position - b.position);
  const nearestPosition = waiting.length ? waiting[0].position : null;

  let label = '';
  if (count === 0) label = '';
  else if (nearestPosition != null)
    label = guestT(locale, count > 1 ? 'guest.summary.earliest' : 'guest.summary.waiting_at', {
      position: nearestPosition,
    });
  else if (onStage) label = guestT(locale, 'guest.summary.on_stage');
  return { count, nearestPosition, label };
}

// ── Queue Truth V1 — owned-request grouping, counts, honest copy, duplicates ──────
//
// The Guest sheet must show the SAME truth its count uses: current requests
// (waiting/playing) and completed HISTORY are distinct collections, and cancelled/
// removed requests belong to neither. All of this derives from canonical `state`.

export interface OwnedRow {
  requestId: string;
  state: GuestQueueState;
  /** Canonical `ready_at` presence — Ready vs Not-Ready among waiting rows. */
  readyAt?: string | null;
  /** Media identity for duplicate detection (youtube_video_id). */
  videoId?: string | null;
}

export interface OwnedGroups {
  /** Current requests — waiting / up_next / now_playing (the "내 신청곡" list). */
  activeIds: string[];
  /** Completed history — done (the "오늘 부른 노래" list). */
  completedIds: string[];
  /**
   * BUILD 25 — resolved requests: cancelled by the Guest, removed or stopped by the Host, or
   * closed by the Event ("신청 결과"). Previously these were DROPPED here, which is precisely how
   * a Guest's song could vanish with no explanation. They are now a first-class collection.
   */
  resolvedIds: string[];
}

/**
 * Split owned rows into the current-request list, completed history, and resolved results.
 *
 * BUILD 25 — THE DROP THAT CAUSED THE DEFECT. This function used to `continue` past every
 * `removed` / `not_found` row with the comment "belongs to NEITHER". The server had been
 * publishing that terminal state all along; discarding it here is what made a Host removal look
 * like the song had simply disappeared. The three collections are MUTUALLY EXCLUSIVE — a request
 * id appears in exactly one — and order is preserved from the input.
 *
 * `not_found` is grouped with `removed` deliberately: from the Guest's side "the server no longer
 * has this row" and "the row is terminal" are the same experience, and both deserve an
 * explanation rather than silence. The reason itself comes from the owner-only projection; a row
 * with no reason renders the honest `unknown_resolution` sentence.
 */
export function groupOwned(rows: readonly OwnedRow[]): OwnedGroups {
  const activeIds: string[] = [];
  const completedIds: string[] = [];
  const resolvedIds: string[] = [];
  for (const r of rows) {
    if (r.state === 'done') completedIds.push(r.requestId);
    else if (r.state === 'removed' || r.state === 'not_found') resolvedIds.push(r.requestId);
    else activeIds.push(r.requestId); // waiting / up_next / now_playing
  }
  return { activeIds, completedIds, resolvedIds };
}

export interface OwnedCounts {
  active: number; // waiting + playing
  completed: number; // done history
  ready: number; // waiting AND ready_at set
}

/** Canonical guest counts from owned rows — never derived from array length/position. */
export function ownedCounts(rows: readonly OwnedRow[]): OwnedCounts {
  let active = 0;
  let completed = 0;
  let ready = 0;
  for (const r of rows) {
    if (r.state === 'done') completed++;
    else if (r.state === 'removed' || r.state === 'not_found') continue;
    else {
      active++;
      if ((r.state === 'waiting' || r.state === 'up_next') && r.readyAt != null) ready++;
    }
  }
  return { active, completed, ready };
}

/** Context for the honest, state-derived Ready sub-copy on a guest row. */
export interface ReadyCopyContext {
  state: GuestQueueState;
  ready: boolean; // this row's ready_at is set
  stageOpen: boolean | null; // no song is playing anywhere (from /display)
  isEarliestReady: boolean; // this row is the earliest eligible Ready song
  readyAheadCount: number; // eligible Ready songs strictly ahead of this one
}

/**
 * State-derived copy — NEVER the old static "앞의 무대가 끝나면 자동으로 이어집니다"
 * regardless of stage. When the stage is idle there is no previous stage to finish,
 * so that copy would be false.
 */
export function readyStageCopy(locale: GuestLocale, ctx: ReadyCopyContext): string {
  if (ctx.state === 'now_playing') return guestT(locale, 'guest.subtitle.now_playing');
  if (ctx.state === 'done') return guestT(locale, 'guest.subtitle.done');
  if (!ctx.ready) return guestT(locale, 'guest.subtitle.not_ready');
  // Ready + waiting:
  if (ctx.readyAheadCount > 0)
    return guestT(locale, 'guest.subtitle.ready_ahead', { count: ctx.readyAheadCount });
  if (ctx.stageOpen === true && ctx.isEarliestReady) return guestT(locale, 'guest.subtitle.first_up');
  // A song is playing (or stage state unknown) and this is the next eligible Ready.
  return guestT(locale, 'guest.subtitle.auto_follow');
}

/**
 * Duplicate guard for "다시 신청": true when the same media (youtube_video_id) is
 * ALREADY in the guest's active list (waiting/up_next/now_playing). Completed history
 * does NOT count — that's the whole point of re-requesting.
 */
export function hasActiveMedia(videoId: string | null | undefined, rows: readonly OwnedRow[]): boolean {
  if (!videoId) return false;
  return rows.some(
    (r) =>
      r.videoId === videoId &&
      (r.state === 'waiting' || r.state === 'up_next' || r.state === 'now_playing'),
  );
}

export type CancelAction = 'cancel' | 'unavailable' | 'none';

/**
 * What the cancel control should show for a request row:
 *  - 'cancel'      → still cancellable AND this device holds the capability
 *  - 'unavailable' → cancellable state but no token (older entry) → honest note,
 *                    never an unauthorized request
 *  - 'none'        → playing/terminal → no cancel affordance
 */
export function cancelRowAction(state: GuestQueueState, hasToken: boolean): CancelAction {
  if (!canGuestCancel(state)) return 'none';
  return hasToken ? 'cancel' : 'unavailable';
}
