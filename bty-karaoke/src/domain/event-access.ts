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
 * Decide access given the room's canonical event (or null for a legacy room) and
 * an OPTIONAL asserted event id (from a URL or a signed capability):
 *
 *  - asserted id present → it MUST equal the canonical event's id, else 403
 *    EVENT_MISMATCH. Because the canonical event is resolved from THIS room, a
 *    foreign/other-room event id can never match → cross-room access is a
 *    mismatch by construction.
 *  - canonical event ended/archived → 409 EVENT_ENDED (honest).
 *  - legacy room, no asserted id → ok (V4 self-service is untouched).
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
  if (event && (event.status === 'ended' || event.status === 'archived')) {
    return { ok: false, status: 409, code: 'EVENT_ENDED', error: 'This event has ended' };
  }
  return { ok: true };
}
