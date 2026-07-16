// V8 Admin YouTube Queue Assist — pure decisions for the semi-automatic TV-queue
// flow. No I/O: the server resolves rows and hands the minimal shape in, so the
// auto-promotion rule, the Ready/Queued label, and the reorder-drift detection are
// exhaustively testable and identical wherever they run.

/** The two independent signals a waiting song can carry before it plays. */
export interface QueueAssistSignals {
  status: string; // request status
  readyAt: string | null; // GUEST said "I'm ready"
  youtubeQueuedAt: string | null; // ADMIN added it to the TV queue
}

export type QueuePrepLabel = 'ready_queued' | 'ready' | 'queued' | 'none';

/**
 * The label the Admin Queue-Prep row shows:
 *  - ready_queued → auto-progression ready (singer ready AND queued on the TV);
 *  - ready        → singer ready, still needs adding to the TV queue;
 *  - queued       → on the TV queue, waiting on the singer;
 *  - none         → not prepared.
 * A non-waiting row is never "prepared".
 */
export function queuePrepLabel(s: QueueAssistSignals): QueuePrepLabel {
  if (s.status !== 'waiting') return 'none';
  const ready = s.readyAt != null;
  const queued = s.youtubeQueuedAt != null;
  if (ready && queued) return 'ready_queued';
  if (ready) return 'ready';
  if (queued) return 'queued';
  return 'none';
}

/**
 * Whether a candidate NEXT song may auto-start in BTY when the Admin passes the
 * turn (Option B). It must be the canonical first waiting song (the caller passes
 * exactly that row), still waiting, with the singer Ready AND the song Queued on
 * the TV. Ready-only or Queued-only never auto-starts — BTY never assumes the TV
 * is playing a song the Admin hasn't confirmed both signals for.
 */
export function isAutoPromotable(next: QueueAssistSignals | null | undefined): boolean {
  return (
    !!next &&
    next.status === 'waiting' &&
    next.readyAt != null &&
    next.youtubeQueuedAt != null
  );
}

/** Why the next song did NOT auto-start — drives the honest Admin message. */
export type NoPromoteReason = 'no_next' | 'needs_ready' | 'needs_queued' | 'needs_both';

export function noPromoteReason(next: QueueAssistSignals | null | undefined): NoPromoteReason {
  if (!next || next.status !== 'waiting') return 'no_next';
  const ready = next.readyAt != null;
  const queued = next.youtubeQueuedAt != null;
  if (!ready && !queued) return 'needs_both';
  if (!ready) return 'needs_ready';
  if (!queued) return 'needs_queued';
  return 'no_next'; // both present → it WOULD promote; caller shouldn't ask
}

/**
 * Detect whether the RELATIVE order of already-prepared (TV-queued) songs changed
 * after a reorder. BTY cannot reorder the real YouTube TV queue, so if the Admin
 * reorders two songs already added to the TV queue, BTY must warn (never silently
 * claim the TV queue changed, never auto-clear the prepared flags).
 *
 * `preparedIdsInPrevOrder` — queued song ids in their PREVIOUS canonical order.
 * `currentWaitingOrderIds` — the full waiting order AFTER the reorder.
 * Returns true iff the queued songs' relative sequence differs now.
 */
export function preparedOrderDrifted(
  preparedIdsInPrevOrder: readonly string[],
  currentWaitingOrderIds: readonly string[],
): boolean {
  const prev = preparedIdsInPrevOrder.filter((id) => currentWaitingOrderIds.includes(id));
  const now = currentWaitingOrderIds.filter((id) => prev.includes(id));
  if (prev.length !== now.length) return false; // a prepared song left the queue → not a reorder drift
  for (let i = 0; i < prev.length; i++) {
    if (prev[i] !== now[i]) return true;
  }
  return false;
}
