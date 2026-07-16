import { describe, it, expect, vi, beforeEach } from 'vitest';

// authorizeDj returns a room only for a credential valid FOR THIS room. Guests
// (no bearer) and other-room DJ tokens resolve to null here.
const s = {
  auth: { room: { id: 'room-1', slug: 'evt-x', display_name: 'Friday Night', status: 'open' }, role: 'dj', deviceId: 'd1' } as unknown,
  event: { id: 'evt-1', status: 'active' } as unknown,
  ended: { id: 'evt-1', status: 'ended', name: 'Friday Night', host_name: null, public_code: 'X', guest_slug: 'g', starts_at: null, ended_at: 'now', created_by: null, created_at: 'c', updated_at: 'u' } as unknown,
};

vi.mock('@/lib/rooms.server', () => ({ authorizeDj: vi.fn(async () => s.auth) }));
vi.mock('@/lib/events.server', () => ({
  // V7 PART K: the route now ends only the LIVE event (getCanonicalEvent), never
  // an all-status lookup that would throw once ended + live coexist after rotation.
  getCanonicalEvent: vi.fn(async () => s.event),
  endEvent: vi.fn(async () => s.ended),
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

  it('the linked DJ credential ends this event (200, status ended)', async () => {
    const res = await POST(makeReq('Bearer good-dj-token'), ctx());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.event.status).toBe('ended');
  });

  it('legacy non-event room returns 404 (nothing to end)', async () => {
    s.event = null;
    const res = await POST(makeReq('Bearer good-dj-token'), ctx());
    expect(res.status).toBe(404);
  });
});
