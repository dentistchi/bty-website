import { describe, it, expect } from 'vitest';
import { decideEventAccess, type EventLike } from './event-access';

const live: EventLike = { id: 'evt-1', status: 'active' };
const ended: EventLike = { id: 'evt-1', status: 'ended' };

describe('decideEventAccess — canonical-event gate (Event Lifecycle V1)', () => {
  it('409 NO_ACTIVE_EVENT for a room with NO event — the legacy eventless fallback is REMOVED', () => {
    expect(decideEventAccess(null)).toMatchObject({
      ok: false,
      status: 409,
      code: 'NO_ACTIVE_EVENT',
    });
  });

  it('allows a live event with no asserted id', () => {
    expect(decideEventAccess(live)).toEqual({ ok: true });
  });

  it('allows a live event when the asserted id matches', () => {
    expect(decideEventAccess(live, 'evt-1')).toEqual({ ok: true });
  });

  it('403 EVENT_MISMATCH when the asserted id differs (cross-room is a mismatch by construction)', () => {
    const d = decideEventAccess(live, 'evt-OTHER');
    expect(d).toMatchObject({ ok: false, status: 403, code: 'EVENT_MISMATCH' });
  });

  it('403 EVENT_MISMATCH when an id is asserted against a room that has no event', () => {
    const d = decideEventAccess(null, 'evt-1');
    expect(d).toMatchObject({ ok: false, status: 403, code: 'EVENT_MISMATCH' });
  });

  it('409 EVENT_ENDED for an ended event (honest), even with a matching id', () => {
    expect(decideEventAccess(ended)).toMatchObject({ ok: false, status: 409, code: 'EVENT_ENDED' });
    expect(decideEventAccess(ended, 'evt-1')).toMatchObject({ ok: false, status: 409, code: 'EVENT_ENDED' });
  });

  it('409 EVENT_ENDED for an archived event', () => {
    expect(decideEventAccess({ id: 'e', status: 'archived' })).toMatchObject({
      ok: false,
      status: 409,
      code: 'EVENT_ENDED',
    });
  });

  it('a mismatch is reported before an ended check (wrong event never leaks its state)', () => {
    const d = decideEventAccess(ended, 'evt-OTHER');
    expect(d).toMatchObject({ code: 'EVENT_MISMATCH' });
  });
});
