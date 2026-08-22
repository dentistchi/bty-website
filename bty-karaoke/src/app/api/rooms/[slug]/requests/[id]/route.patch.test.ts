// Event Lifecycle V1 — the DJ single-request PATCH (play/complete/skip/move_next)
// rejects an ENDED event HONESTLY (409 EVENT_ENDED) after auth, instead of only
// failing once the row is already terminal. Live events still transition.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const state = {
  auth: { room: { id: 'room-1' } } as null | { room: { id: string } },
  access: { ok: true, event: null } as
    | { ok: true; event: unknown }
    | { ok: false; status: 403 | 409; code: string; error: string },
  result: { outcome: 'ok', request: { id: 'req-1' }, from: 'playing' } as
    | { outcome: 'ok'; request: { id: string }; from: string }
    | { outcome: 'not_found' }
    | { outcome: 'invalid'; from: string },
};

// BUILD 26U-R1 — the Premium Room guard now sits in front of this route. It is stubbed as
// ENTITLED here because this file's subject is what the route does once the session is
// authorized; the guard's own refusal and expiry behaviour are proven in
// src/lib/premium-room-guard.server.test.ts.
vi.mock('@/lib/premium-room-guard.server', () => ({
  assertPremiumRoomSession: vi.fn(async () => ({ ok: true, entitlement: { entitled: true } })),
}));
vi.mock('@/lib/rooms.server', () => ({
  authorizeDj: vi.fn(async () => state.auth),
  getGuestQueueStatus: vi.fn(),
  getPublicRoomBySlug: vi.fn(),
  setRequestStatus: vi.fn(async () => state.result),
  moveToNextWaiting: vi.fn(async () => state.result),
  promoteNextReady: vi.fn(async () => ({ outcome: 'none' })),
}));
vi.mock('@/lib/events.server', () => ({
  getCanonicalEvent: vi.fn(async () => ({ id: 'evt-1' })),
  resolveEventAccess: vi.fn(async () => state.access),
}));
vi.mock('@/lib/lyrics-resolver.server', () => ({ scheduleLyricsResolve: vi.fn() }));

import { PATCH } from './route';

function makeReq(authorization: string | undefined, body: unknown) {
  return {
    headers: { get: (k: string) => (k.toLowerCase() === 'authorization' ? authorization ?? null : null) },
    json: async () => body,
  } as unknown as Parameters<typeof PATCH>[0];
}
const ctx = { params: Promise.resolve({ slug: 'bty-home', id: 'req-1' }) };

beforeEach(() => {
  state.auth = { room: { id: 'room-1' } };
  state.access = { ok: true, event: null };
  state.result = { outcome: 'ok', request: { id: 'req-1' }, from: 'playing' };
});

describe('PATCH /api/rooms/[slug]/requests/[id] — ended-event gate', () => {
  it('a live event completes a playing request (200 ok)', async () => {
    const res = await PATCH(makeReq('Bearer x', { action: 'complete' }), ctx);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
  });

  it('an ended event refuses the transition HONESTLY with 409 EVENT_ENDED', async () => {
    state.access = { ok: false, status: 409, code: 'EVENT_ENDED', error: 'This event has ended' };
    const res = await PATCH(makeReq('Bearer x', { action: 'complete' }), ctx);
    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.code).toBe('EVENT_ENDED');
  });

  it('rejects a caller not authorized for this room (401) before the event gate', async () => {
    state.auth = null;
    const res = await PATCH(makeReq('Bearer x', { action: 'complete' }), ctx);
    expect(res.status).toBe(401);
  });
});
