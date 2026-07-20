import { describe, it, expect, vi, beforeEach } from 'vitest';

// authorizeDj returns a room only for a credential valid FOR THIS room. Guests
// (no bearer) and other-room DJ tokens resolve to null here.
const s = {
  auth: { room: { id: 'room-1', slug: 'evt-x', display_name: 'Friday Night', status: 'open' }, role: 'dj', deviceId: 'd1' } as unknown,
  event: { id: 'evt-1', status: 'active' } as unknown,
  latestEnded: null as unknown, // fallback resolved when no live event (idempotent repeat-end)
  ended: { id: 'evt-1', status: 'ended', name: 'Friday Night', host_name: null, public_code: 'X', guest_slug: 'g', starts_at: null, ended_at: 'now', created_by: null, created_at: 'c', updated_at: 'u' } as unknown,
};

vi.mock('@/lib/rooms.server', () => ({ authorizeDj: vi.fn(async () => s.auth) }));
vi.mock('@/lib/events.server', () => ({
  // V7 PART K: the route ends the LIVE event, or (repeat-end) the most-recent ended
  // event so a second tap is idempotent success rather than a false 404.
  getCanonicalEvent: vi.fn(async () => s.event),
  getLatestEndedEvent: vi.fn(async () => s.latestEnded),
  endEvent: vi.fn(async () =>
    s.ended ? { event: s.ended, summary: { completedCount: 3, unfinishedClosedCount: 1 } } : null,
  ),
  publicEvent: (e: { id: string; status: string }) => ({ id: e.id, status: e.status }),
}));

import { POST } from './route';

function makeReq(authorization?: string) {
  return {
    headers: { get: (k: string) => (k.toLowerCase() === 'authorization' ? authorization ?? null : null) },
  } as unknown as Parameters<typeof POST>[0];
}
const ctx = () => ({ params: Promise.resolve({ slug: 'evt-x' }) });

beforeEach(() => {
  s.auth = { room: { id: 'room-1', slug: 'evt-x', display_name: 'Friday Night', status: 'open' }, role: 'dj', deviceId: 'd1' };
  s.event = { id: 'evt-1', status: 'active' };
  s.latestEnded = null;
  s.ended = { id: 'evt-1', status: 'ended', name: 'Friday Night', host_name: null, public_code: 'X', guest_slug: 'g', starts_at: null, ended_at: 'now', created_by: null, created_at: 'c', updated_at: 'u' };
});

describe('POST /api/rooms/[slug]/dj/end-event', () => {
  it('guest with no credential cannot end (401)', async () => {
    const res = await POST(makeReq(undefined), ctx());
    expect(res.status).toBe(401);
  });

  it('wrong-room / invalid DJ credential cannot end (401)', async () => {
    s.auth = null; // authorizeDj rejects a token that is not for this room
    const res = await POST(makeReq('Bearer other-room-token'), ctx());
    expect(res.status).toBe(401);
  });

  it('the linked DJ credential ends this event (200, status ended + summary)', async () => {
    const res = await POST(makeReq('Bearer good-dj-token'), ctx());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.event.status).toBe('ended');
    expect(data.summary).toEqual({ completedCount: 3, unfinishedClosedCount: 1 });
  });

  it('repeat end (no live event, but a recently ended one) is idempotent success (200 ended)', async () => {
    s.event = null; // getCanonicalEvent → null (already ended)
    s.latestEnded = { id: 'evt-1', status: 'ended' }; // most-recent ended round resolves
    const res = await POST(makeReq('Bearer good-dj-token'), ctx());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.event.status).toBe('ended');
  });

  it('legacy room that NEVER had an event returns 404 (nothing to end)', async () => {
    s.event = null;
    s.latestEnded = null;
    const res = await POST(makeReq('Bearer good-dj-token'), ctx());
    expect(res.status).toBe(404);
  });
});
