// Pure client-side model for the guest's OWN requests this room/session. Used for
// presentation only — never canonical queue truth (each status still comes from
// the server resolver). Bounded: entries expire with the cancel-capability TTL.

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
  else if (nearestPosition != null) label = count > 1 ? `가장 빠른 순번 ${nearestPosition}번` : `지금 대기 ${nearestPosition}번`;
  else if (onStage) label = '무대 위';
  return { count, nearestPosition, label };
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
