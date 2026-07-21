// Single-room auto-entry bridge (Simplify Browser Host Entry V1).
//
// Pins: authenticated + authorized GET → 303 to EXACTLY /r/{slug}/admin with the
// account-bound Room cookie; unauthenticated → root; unknown/unauthorized room →
// root (no existence oracle); and the same minting primitive as the POST bridge is
// reused (issueRoomWebSession) with ZERO Event mutation and no Manager auth.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const state = {
  hostToken: 'host-token' as string | null,
  account: { id: 'acct-1' } as null | { id: string },
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
vi.mock('@/lib/room-web-session.server', () => ({
  issueRoomWebSession: (roomId: string, accountId: string) => issueSpy(roomId, accountId),
  roomSessionCookie: (_req: unknown, value: string) => ({ name: 'bty_room', value, path: '/' }),
}));
vi.mock('@/lib/rooms.server', () => ({ getPublicRoomBySlug: vi.fn(async () => state.room) }));

import { GET } from './route';

function makeReq() {
  return {
    nextUrl: { origin: 'https://norebang.btydaily.com', protocol: 'https:' },
  } as unknown as Parameters<typeof GET>[0];
}
const ctx = { params: Promise.resolve({ slug: 'bty-home' }) };

beforeEach(() => {
  state.hostToken = 'host-token';
  state.account = { id: 'acct-1' };
  state.room = { id: 'room-pilot', slug: 'bty-home', display_name: 'BTY Home' };
  state.hasAccess = true;
  issueSpy.mockClear();
});

describe('GET /host/rooms/[slug]/enter (single-room auto-entry)', () => {
  it('authenticated + authorized → 303 to /r/{slug}/admin with the Room cookie', async () => {
    const res = await GET(makeReq(), ctx);
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('https://norebang.btydaily.com/r/bty-home/admin');
    expect(res.headers.get('set-cookie')).toContain('bty_room=room-raw-token');
    expect(issueSpy).toHaveBeenCalledTimes(1);
    expect(issueSpy).toHaveBeenCalledWith('room-pilot', 'acct-1');
  });

  it('unauthenticated → redirect to root, no credential minted', async () => {
    state.account = null;
    const res = await GET(makeReq(), ctx);
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('https://norebang.btydaily.com/');
    expect(issueSpy).not.toHaveBeenCalled();
  });

  it('unknown Room → root (no existence oracle), no credential minted', async () => {
    state.room = null;
    const res = await GET(makeReq(), ctx);
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('https://norebang.btydaily.com/');
    expect(issueSpy).not.toHaveBeenCalled();
  });

  it('room the account cannot access → the SAME root redirect', async () => {
    state.hasAccess = false;
    const res = await GET(makeReq(), ctx);
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('https://norebang.btydaily.com/');
    expect(issueSpy).not.toHaveBeenCalled();
  });
});
