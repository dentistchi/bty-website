// Host Room creation endpoint (New Host Onboarding V1 + PRO Multi-Room V1).
//
// Pins the route-level contract:
//   - identity is required FIRST (no session → 303 to the root login), then CSRF (403)
//   - the ONLY accepted input is a bounded display name; empty/invalid → back with a notice
//   - FIRST Room (kind 'entered', incl. idempotent has_room) mints an account-bound Room
//     credential and 303s to EXACTLY /r/{slug}/admin — unchanged shipped behavior
//   - ADDITIONAL Room (kind 'added') 303s to the hub chooser (/), no Room cookie
//   - at capacity (kind 'limit_reached') 303s to /?notice=room_limit, nothing created
//   - the owner is ALWAYS the authenticated account — no owner is ever read from the body
//
// The atomicity + plan-limit + zero-Event guarantees live in the RPCs (DB-enforced under
// an account-scoped advisory lock); here we assert the HTTP wiring + outcome routing.

import { describe, it, expect, vi, beforeEach } from 'vitest';

type CreateRoomResult =
  | { kind: 'entered'; slug: string; roomId: string }
  | { kind: 'added'; slug: string; roomId: string }
  | { kind: 'idempotency_conflict' }
  | { kind: 'blocked' };

const state = {
  hostToken: 'host-token' as string | null,
  account: { id: 'acct-1' } as null | { id: string },
  csrfOk: true,
  result: { kind: 'entered', slug: 'my-room-ab12cd34', roomId: 'room-new' } as CreateRoomResult,
};

const createSpy = vi.fn(async (_args: { accountId: string; displayName: string; idempotencyKey: string }) => state.result);
const issueSpy = vi.fn(async (_roomId: string, _accountId: string) => 'room-raw-token');

vi.mock('@/lib/host-auth.server', () => ({
  authorizeHost: vi.fn(async () => state.account),
  createRoomForAccount: (args: { accountId: string; displayName: string; idempotencyKey: string }) => createSpy(args),
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

function makeReq(fields: Record<string, string> = { csrf: 'csrf-token', name: 'Chi Family Norebang', idempotencyKey: 'idem-1' }) {
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
  state.result = { kind: 'entered', slug: 'my-room-ab12cd34', roomId: 'room-new' };
  createSpy.mockClear();
  issueSpy.mockClear();
});

describe('POST /api/host/rooms', () => {
  it('first Room (entered) → 303 to /r/{slug}/admin with the Room cookie; owner is the session account', async () => {
    const res = await POST(makeReq());
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('https://norebang.btydaily.com/r/my-room-ab12cd34/admin');
    expect(res.headers.get('set-cookie')).toContain('bty_room=room-raw-token');
    expect(createSpy).toHaveBeenCalledWith({ accountId: 'acct-1', displayName: 'Chi Family Norebang', idempotencyKey: 'idem-1' });
    expect(issueSpy).toHaveBeenCalledWith('room-new', 'acct-1');
  });

  it('additional Room (added) → 303 to the hub chooser (/?view=rooms), NO Room cookie, no admin bridge', async () => {
    state.result = { kind: 'added', slug: 'second-room', roomId: 'room-2' };
    const res = await POST(makeReq());
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('https://norebang.btydaily.com/?view=rooms');
    expect(res.headers.get('set-cookie')).toBeNull();
    expect(issueSpy).not.toHaveBeenCalled();
  });

  it('idempotency_conflict → 303 to /?notice=room_conflict&view=rooms, nothing created', async () => {
    state.result = { kind: 'idempotency_conflict' };
    const res = await POST(makeReq());
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('https://norebang.btydaily.com/?notice=room_conflict&view=rooms');
    expect(res.headers.get('set-cookie')).toBeNull();
    expect(issueSpy).not.toHaveBeenCalled();
  });

  it('blocked (fail-closed) → 303 to /?notice=room_blocked&view=rooms, nothing created', async () => {
    state.result = { kind: 'blocked' };
    const res = await POST(makeReq());
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('https://norebang.btydaily.com/?notice=room_blocked&view=rooms');
    expect(issueSpy).not.toHaveBeenCalled();
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
    await POST(makeReq({ csrf: 'csrf-token', name: 'Room X', idempotencyKey: 'idem-1', accountId: 'attacker', slug: 'pwned', ownerId: 'x' }));
    expect(createSpy).toHaveBeenCalledWith({ accountId: 'acct-1', displayName: 'Room X', idempotencyKey: 'idem-1' });
  });
});
