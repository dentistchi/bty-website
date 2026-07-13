// Pure client-side model for the guest's OWN requests this room/session. Used for
// presentation only — never canonical queue truth (each status still comes from
// the server resolver). Bounded: entries expire with the cancel-capability TTL.

import type { GuestQueueState } from './queue';

export const MY_REQUESTS_TTL_MS = 12 * 60 * 60 * 1000;

export interface MyRequest {
  requestId: string;
  cancelToken: string | null;
  title: string;
  artist: string | null;
  submittedAt: number; // epoch ms
}

/** localStorage key for retained request IDs, scoped by room slug. */
export function myRequestsKey(slug: string): string {
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
  label: string;
}

/**
 * Compact label for the collapsed dock pill given each active row's live status.
 * Leads with the soonest waiting position; notes when one is on stage.
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

  let label: string;
  if (count === 0) label = '내 신청곡';
  else if (waiting.length) label = count > 1 ? `대기 ${waiting[0].position}번 · ${count}곡` : `대기 ${waiting[0].position}번`;
  else if (onStage) label = count > 1 ? `무대 위 · ${count}곡` : '무대 위';
  else label = `${count}곡`;
  return { count, label };
}
