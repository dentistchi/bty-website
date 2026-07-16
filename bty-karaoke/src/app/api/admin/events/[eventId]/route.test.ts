// Manager event detail returns the CANONICAL room slug (from room_id) so the client
// links Open Admin Player to a room that actually exists — and returns null (→ the
// client disables the button) when the event has no mapped room.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const state = {
  enabled: true,
  authed: true,
  summary: null as null | { event: { id: string; room_id: string; public_code: string }; stats: unknown; dj: unknown },
  roomSlug: null as string | null,
};

vi.mock('@/lib/manager-auth.server', () => ({
  managerEnabled: () => state.enabled,
  managerAuthorized: async () => state.authed,
}));
vi.mock('@/lib/events.server', () => ({
  getEventSummary: async () => state.summary,
  publicEvent: (e: { id: string; public_code: string }) => ({ id: e.id, publicCode: e.public_code, status: 'active' }),
  eventRoomSlugOf: async () => state.roomSlug,
}));
vi.mock('@/lib/event-links.server', () => ({
  guestQrFor: async () => ({ url: 'https://x.test/j/g-vzqrpz', qrSvg: '<svg/>' }),
}));

import { GET } from './route';

const req = { nextUrl: { origin: 'https://x.test' } } as unknown as Parameters<typeof GET>[0];
const ctx = { params: Promise.resolve({ eventId: 'e1' }) };

beforeEach(() => {
  state.enabled = true;
  state.authed = true;
  state.summary = { event: { id: 'e1', room_id: 'room-abc', public_code: 'VZQRPZ' }, stats: {}, dj: {} };
  state.roomSlug = 'bty-home';
});

describe('GET /api/admin/events/[eventId]', () => {
  it('returns the CANONICAL room slug (not evt-<public_code>)', async () => {
    const res = await GET(req, ctx);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.roomSlug).toBe('bty-home');
    expect(data.roomSlug).not.toBe('evt-vzqrpz');
  });

  it('returns roomSlug: null when the event has no mapped room (button disables)', async () => {
    state.roomSlug = null;
    const res = await GET(req, ctx);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.roomSlug).toBeNull();
  });

  it('401 when not manager-authorized (auth preserved)', async () => {
    state.authed = false;
    const res = await GET(req, ctx);
    expect(res.status).toBe(401);
  });

  it('404 for an unknown event', async () => {
    state.summary = null;
    const res = await GET(req, ctx);
    expect(res.status).toBe(404);
  });
});
