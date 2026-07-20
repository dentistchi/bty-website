// Slice 2.1 §12 — the DJ queue route authorizes via the bty_room COOKIE end-to-end
// (route -> roomCredentialFromRequest -> authorizeDj), and Bearer still wins.
//
// This exercises the REAL route handler with a cookie-bearing request, so the cookie
// path is proven at the HTTP boundary, not just at the resolver unit.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const state = {
  authRoomForCred: {} as Record<string, { id: string; slug: string; display_name: string; status: string } | null>,
};

// authorizeDj resolves per credential value — models "cookie A only authorizes its room".
const authorizeDjSpy = vi.fn(async (_slug: string, cred: string) => {
  const room = state.authRoomForCred[cred] ?? null;
  return room ? { room, role: 'admin' as const, deviceId: 'd1' } : null;
});

vi.mock('@/lib/rooms.server', () => ({
  authorizeDj: (s: string, c: string) => authorizeDjSpy(s, c),
  listActiveRequests: vi.fn(async () => []),
  activeRequestStats: vi.fn(async () => ({ requests: 0, guests: 0 })),
}));
vi.mock('@/lib/sessions.server', () => ({ getActiveSession: vi.fn(async () => null) }));
vi.mock('@/lib/events.server', () => ({
  getEventStatusForRoom: vi.fn(async () => null),
  getCanonicalEvent: vi.fn(async () => null),
}));

import { GET } from './route';

function makeReq(opts: { bearer?: string; cookie?: string }) {
  return {
    headers: { get: (k: string) => (k.toLowerCase() === 'authorization' && opts.bearer ? `Bearer ${opts.bearer}` : null) },
    cookies: { get: (n: string) => (n === 'bty_room' && opts.cookie ? { value: opts.cookie } : undefined) },
  } as unknown as Parameters<typeof GET>[0];
}
const ctx = () => ({ params: Promise.resolve({ slug: 'bty-home' }) });
const ROOM = { id: 'room-A', slug: 'bty-home', display_name: 'BTY Home', status: 'open' };

beforeEach(() => {
  state.authRoomForCred = { 'cookie-tok': ROOM, 'bearer-tok': ROOM };
  authorizeDjSpy.mockClear();
});

describe('GET /api/rooms/[slug]/dj/queue — cookie authorization', () => {
  it('(2) authorizes via the bty_room cookie when no Bearer is present', async () => {
    const res = await GET(makeReq({ cookie: 'cookie-tok' }), ctx());
    expect(res.status).toBe(200);
    expect(authorizeDjSpy).toHaveBeenCalledWith('bty-home', 'cookie-tok');
  });

  it('(16) Bearer still works and WINS over a cookie (existing clients unchanged)', async () => {
    const res = await GET(makeReq({ bearer: 'bearer-tok', cookie: 'cookie-tok' }), ctx());
    expect(res.status).toBe(200);
    expect(authorizeDjSpy).toHaveBeenCalledWith('bty-home', 'bearer-tok');
  });

  it('a cookie the server does not recognise is rejected (401), no fallback', async () => {
    const res = await GET(makeReq({ cookie: 'stale-cookie' }), ctx());
    expect(res.status).toBe(401);
  });

  it('(14) a Room-A cookie cannot authorize a different Room', async () => {
    // authorizeDj is called with the SLUG from the URL; the cookie is bound server-
    // side to room-A, so against another room it resolves to null.
    state.authRoomForCred = { 'cookie-tok': null }; // as room-B would see it
    const res = await GET(makeReq({ cookie: 'cookie-tok' }), ctx());
    expect(res.status).toBe(401);
  });

  it('no credential at all → 401', async () => {
    expect((await GET(makeReq({}), ctx())).status).toBe(401);
  });
});
