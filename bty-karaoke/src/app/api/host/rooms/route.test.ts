// First-room onboarding endpoint (New Host Onboarding V1).
//
// Pins the route-level contract a brand-new zero-Room Host relies on:
//   - identity is required FIRST (no session → 303 to the root login), then CSRF (403)
//   - the ONLY accepted input is a bounded display name; empty/invalid → back with a notice
//   - success mints an account-bound Room credential and 303s to EXACTLY /r/{slug}/admin
//   - the owner is ALWAYS the authenticated account — no owner is ever read from the body
//   - 'has_room' (already owns a Room) enters that SAME Room — a duplicate is never created
//
// The atomicity + duplicate + zero-Event guarantees live in the create_karaoke_room
// RPC (DB-enforced under an account-scoped advisory lock); here we assert the HTTP
// wiring and that it forwards nothing but the session account + typed name.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const state = {
  hostToken: 'host-token' as string | null,
  account: { id: 'acct-1' } as null | { id: string },
  csrfOk: true,
  create: { outcome: 'created', slug: 'my-room-ab12cd34', roomId: 'room-new' } as {
    outcome: 'created' | 'has_room';
    slug: string;
    roomId: string;
  },
};

const createSpy = vi.fn(async (_args: { accountId: string; displayName: string }) => state.create);
const issueSpy = vi.fn(async (_roomId: string, _accountId: string) => 'room-raw-token');

vi.mock('@/lib/host-auth.server', () => ({
  authorizeHost: vi.fn(async () => state.account),
  createFirstRoomForAccount: (args: { accountId: string; displayName: string }) => createSpy(args),
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

import { POST } from './route';

function makeReq(fields: Record<string, string> = { csrf: 'csrf-token', name: 'Chi Family Norebang' }) {
  return {
    formData: async () => new Map(Object.entries(fields)),
    headers: { get: () => null },
    nextUrl: { origin: 'https://norebang.btydaily.com', protocol: 'https:' },
  } as unknown as Parameters<typeof POST>[0];
}

beforeEach(() => {
  state.hostToken = 'host-token';
  state.account = { id: 'acct-1' };
  state.csrfOk = true;
  state.create = { outcome: 'created', slug: 'my-room-ab12cd34', roomId: 'room-new' };
  createSpy.mockClear();
  issueSpy.mockClear();
});

describe('POST /api/host/rooms', () => {
  it('created → 303 to /r/{slug}/admin with the Room cookie; owner is the session account', async () => {
    const res = await POST(makeReq());
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('https://norebang.btydaily.com/r/my-room-ab12cd34/admin');
    expect(res.headers.get('set-cookie')).toContain('bty_room=room-raw-token');
    // Owner derived from the authenticated session, and ONLY the typed name forwarded.
    expect(createSpy).toHaveBeenCalledWith({ accountId: 'acct-1', displayName: 'Chi Family Norebang' });
    expect(issueSpy).toHaveBeenCalledWith('room-new', 'acct-1');
  });

  it('already owns a Room (has_room) → enters that SAME Room; no duplicate created', async () => {
    state.create = { outcome: 'has_room', slug: 'existing-room', roomId: 'room-existing' };
    const res = await POST(makeReq());
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('https://norebang.btydaily.com/r/existing-room/admin');
    expect(issueSpy).toHaveBeenCalledWith('room-existing', 'acct-1');
  });

  it('unauthenticated → 303 to the root login, and nothing is created', async () => {
    state.account = null;
    const res = await POST(makeReq());
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('https://norebang.btydaily.com/');
    expect(createSpy).not.toHaveBeenCalled();
    expect(issueSpy).not.toHaveBeenCalled();
  });

  it('bad CSRF → 403 and nothing is created (identity passed, token failed)', async () => {
    state.csrfOk = false;
    const res = await POST(makeReq());
    expect(res.status).toBe(403);
    expect(createSpy).not.toHaveBeenCalled();
    expect(issueSpy).not.toHaveBeenCalled();
  });

  it('empty name → 303 back to onboarding with a notice, nothing created', async () => {
    const res = await POST(makeReq({ csrf: 'csrf-token', name: '   ' }));
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('https://norebang.btydaily.com/?notice=bad_name');
    expect(createSpy).not.toHaveBeenCalled();
  });

  it('missing name → 303 back with a notice (the only accepted input is the name)', async () => {
    const res = await POST(makeReq({ csrf: 'csrf-token' }));
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('https://norebang.btydaily.com/?notice=bad_name');
    expect(createSpy).not.toHaveBeenCalled();
  });

  it('ignores any client-supplied owner/slug — only account + name reach the service', async () => {
    await POST(makeReq({ csrf: 'csrf-token', name: 'Room X', accountId: 'attacker', slug: 'pwned', ownerId: 'x' }));
    expect(createSpy).toHaveBeenCalledWith({ accountId: 'acct-1', displayName: 'Room X' });
  });
});
