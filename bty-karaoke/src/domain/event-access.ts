// Pure access decision for the canonical-event gate (V5). No I/O — the server
// resolves the room's ONE canonical event (deterministic 1:1) and hands it in;
// this decides whether an operational caller may act. Keeping it pure makes the
// honest-rejection rules (mismatch / ended / eventless) exhaustively testable.

export type EventAccessStatus = 'draft' | 'active' | 'ended' | 'archived';

export interface EventLike {
  id: string;
  status: EventAccessStatus;
}

export type EventAccessDecision =
  | { ok: true }
  | { ok: false; status: 403 | 409; code: string; error: string };

/**
 * Decide access given the room's canonical event (live, else most-recent ended, else
 * null when the room has NEVER had one) and an OPTIONAL asserted event id (from a
 * URL or a signed capability):
 *
 *  - asserted id present → it MUST equal the canonical event's id, else 403
 *    EVENT_MISMATCH. Because the canonical event is resolved from THIS room, a
 *    foreign/other-room event id can never match → cross-room access is a
 *    mismatch by construction.
 *  - canonical event ended/archived → 409 EVENT_ENDED (honest).
 *  - NO event at all → 409 NO_ACTIVE_EVENT (Event Lifecycle V1). The legacy V4
 *    "eventless room is open for business" fallback is REMOVED: since nothing
 *    auto-creates an Event any more, a room with zero Events is simply not running
 *    karaoke, and every operational mutation must refuse honestly rather than
 *    silently accept requests into no Event.
 */
export function decideEventAccess(
  event: EventLike | null,
  assertedEventId?: string | null,
): EventAccessDecision {
  if (assertedEventId) {
    if (!event || event.id !== assertedEventId) {
      return {
        ok: false,
        status: 403,
        code: 'EVENT_MISMATCH',
        error: 'This link is for a different event',
      };
    }
  }
  if (!event) {
    return {
      ok: false,
      status: 409,
      code: 'NO_ACTIVE_EVENT',
      error: '지금 진행 중인 노래방이 없습니다',
    };
  }
  if (event.status === 'ended' || event.status === 'archived') {
    return { ok: false, status: 409, code: 'EVENT_ENDED', error: 'This event has ended' };
  }
  return { ok: true };
}
