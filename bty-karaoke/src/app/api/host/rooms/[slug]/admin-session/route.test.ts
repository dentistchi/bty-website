// Room Web Auth Bridge — the HTTP boundary that turns an authenticated web Host
// into an account-bound Admin session for ONE room.
//
// Pins the route-level invariants the product relies on (recorded because a Host
// who signs in at /host is expected to reach their canonical room admin):
//   - success → 303 redirect to EXACTLY /r/{slug}/admin, with the Room cookie set
//   - identity is required FIRST (401), then CSRF (403)
//   - unknown Room and unauthorized Room are the SAME 404 (no room-existence oracle)
//   - the bridge mints a Room credential and creates ZERO Events
//
// The full authorization chain (Host session → account → active membership →
// workspace owns room) is proven in host-auth.test.ts; here we assert the route
// wiring and its redirect target so a refactor can't silently move it.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const state = {
  hostToken: 'host-token' as string | null,
  account: { id: 'acct-1' } as null | { id: string },
  csrfOk: true,
  room: { id: 'room-pilot', slug: 'bty-home', display_name: 'BTY Home' } as
    | null
    | { id: string; slug: string; display_name: string },
  hasAccess: true,
};

const issueSpy = vi.fn(async (_roomId: string, _accountId: string) => 'room-raw-token');

vi.mock('@/lib/host-auth.server', () => ({
  authorizeHost: vi.fn(async () => state.account),
  accountHasRoomAccess: vi.fn(async () => state.hasAccess),
}));
vi.mock('@/lib/host-web-session.server', () => ({
  hostTokenFromRequest: () => state.hostToken,
}));
vi.mock('@/lib/host-csrf.server', () => ({
  verifyHostCsrf: vi.fn(async () => (state.csrfOk ? { ok: true } : { ok: false, reason: 'bad_token' })),
  csrfFromForm: () => 'csrf-token',
}));
vi.mock('@/lib/room-web-session.server', () => ({
  issueRoomWebSession: (roomId: string, accountId: string) => issueSpy(roomId, accountId),
  roomSessionCookie: (_req: unknown, value: string) => ({ name: 'bty_room', value, path: '/' }),
}));
vi.mock('@/lib/rooms.server', () => ({ getPublicRoomBySlug: vi.fn(async () => state.room) }));

import { POST } from './route';

function makeReq() {
  return {
    formData: async () => new Map([['csrf', 'csrf-token']]),
    headers: { get: () => null },
    nextUrl: { origin: 'https://norebang.btydaily.com', protocol: 'https:' },
  } as unknown as Parameters<typeof POST>[0];
}
const ctx = { params: Promise.resolve({ slug: 'bty-home' }) };

beforeEach(() => {
  state.hostToken = 'host-token';
  state.account = { id: 'acct-1' };
  state.csrfOk = true;
  state.room = { id: 'room-pilot', slug: 'bty-home', display_name: 'BTY Home' };
  state.hasAccess = true;
  issueSpy.mockClear();
});

describe('POST /api/host/rooms/[slug]/admin-session', () => {
  it('authenticated + authorized + valid CSRF → 303 to /r/{slug}/admin with the Room cookie', async () => {
    const res = await POST(makeReq(), ctx);
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('https://norebang.btydaily.com/r/bty-home/admin');
    expect(res.headers.get('set-cookie')).toContain('bty_room=room-raw-token');
    // The bridge mints exactly one account-bound Room credential…
    expect(issueSpy).toHaveBeenCalledTimes(1);
    expect(issueSpy).toHaveBeenCalledWith('room-pilot', 'acct-1');
  });

  it('unauthenticated → 401 and no credential minted (identity is checked FIRST)', async () => {
    state.account = null;
    const res = await POST(makeReq(), ctx);
    expect(res.status).toBe(401);
    expect(issueSpy).not.toHaveBeenCalled();
  });

  it('bad CSRF → 403 and no credential minted', async () => {
    state.csrfOk = false;
    const res = await POST(makeReq(), ctx);
    expect(res.status).toBe(403);
    expect(issueSpy).not.toHaveBeenCalled();
  });

  it('unknown Room → 404', async () => {
    state.room = null;
    const res = await POST(makeReq(), ctx);
    expect(res.status).toBe(404);
    expect(issueSpy).not.toHaveBeenCalled();
  });

  it('authorized-elsewhere Room (no access) → the SAME 404, no existence oracle', async () => {
    state.hasAccess = false;
    const res = await POST(makeReq(), ctx);
    expect(res.status).toBe(404);
    expect(issueSpy).not.toHaveBeenCalled();
  });
});
