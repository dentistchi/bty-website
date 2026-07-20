// Host Account V1 — the Room-claim HTTP boundary.
//
// Proves the order the contract demands: a verified personal account FIRST, then
// the Manager passcode, then the atomic claim. A wrong passcode must never reach
// the claim service at all, and unauthenticated failures must be indistinguishable.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const state = {
  account: { id: 'acct-1' } as null | { id: string },
  passcodeOk: true,
  managerOn: true,
  room: { id: 'room-pilot', slug: 'bty-home', display_name: 'BTY Home' } as
    | null
    | { id: string; slug: string; display_name: string },
  claim: { outcome: 'claimed', workspaceId: 'ws-1', roomId: 'room-pilot' } as Record<string, unknown>,
};

const claimSpy = vi.fn(async (_args: unknown) => state.claim);

vi.mock('@/lib/host-auth.server', () => ({
  authorizeHost: vi.fn(async () => state.account),
  claimRoomForAccount: (a: unknown) => claimSpy(a),
}));
vi.mock('@/lib/manager-auth.server', () => ({
  managerEnabled: () => state.managerOn,
  verifyManagerPasscode: () => state.passcodeOk,
}));
vi.mock('@/lib/rooms.server', () => ({ getPublicRoomBySlug: vi.fn(async () => state.room) }));
vi.mock('@/lib/rate-limit.server', () => ({
  makeLimiter: vi.fn(async () => null),
  isLockedOut: vi.fn(async () => false),
  recordFailure: vi.fn(async () => undefined),
  recordSuccess: vi.fn(async () => undefined),
}));

import { POST } from './route';

function makeReq(auth: string | undefined, body: unknown) {
  return {
    headers: { get: (k: string) => (k.toLowerCase() === 'authorization' ? auth ?? null : null) },
    json: async () => body,
  } as unknown as Parameters<typeof POST>[0];
}
const BODY = { passcode: 'correct-horse', roomSlug: 'bty-home' };

beforeEach(() => {
  state.account = { id: 'acct-1' };
  state.passcodeOk = true;
  state.managerOn = true;
  state.room = { id: 'room-pilot', slug: 'bty-home', display_name: 'BTY Home' };
  state.claim = { outcome: 'claimed', workspaceId: 'ws-1', roomId: 'room-pilot' };
  claimSpy.mockClear();
});

describe('POST /api/host/rooms/claim', () => {
  it('requires a verified Host account FIRST — a passcode alone claims nothing', async () => {
    state.account = null;
    const res = await POST(makeReq(undefined, BODY));
    expect(res.status).toBe(401);
    expect(claimSpy).not.toHaveBeenCalled();
  });

  it('(6) a WRONG passcode never reaches the claim service and creates no ownership', async () => {
    state.passcodeOk = false;
    const res = await POST(makeReq('Bearer host-sess', BODY));
    expect(res.status).toBe(401);
    expect(claimSpy).not.toHaveBeenCalled();
  });

  it('(5) a correct passcode claims the Room atomically', async () => {
    const res = await POST(makeReq('Bearer host-sess', BODY));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.outcome).toBe('claimed');
    expect(claimSpy).toHaveBeenCalledTimes(1);
    // The account comes from the SESSION, never from the request body.
    expect(claimSpy).toHaveBeenCalledWith(expect.objectContaining({ accountId: 'acct-1', roomId: 'room-pilot' }));
  });

  it('(8) a repeat claim by the same Host is idempotent success', async () => {
    state.claim = { outcome: 'idempotent', workspaceId: 'ws-1', roomId: 'room-pilot' };
    const res = await POST(makeReq('Bearer host-sess', BODY));
    expect(res.status).toBe(200);
    expect((await res.json()).outcome).toBe('idempotent');
  });

  it('(7) a Room already owned by another workspace returns an honest 409, never a steal', async () => {
    state.claim = { outcome: 'conflict' };
    const res = await POST(makeReq('Bearer host-sess', BODY));
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe('ALREADY_CLAIMED');
  });

  it('an unknown Room is the SAME uniform 401 as a bad passcode (no Room enumeration)', async () => {
    state.room = null;
    const res = await POST(makeReq('Bearer host-sess', { ...BODY, roomSlug: 'does-not-exist' }));
    expect(res.status).toBe(401);
    const data = await res.json();
    // Byte-identical to the wrong-passcode response.
    expect(data.error).toBe('That passcode is not valid.');
    expect(claimSpy).not.toHaveBeenCalled();
  });

  it('a disabled manager feature is also the same uniform 401', async () => {
    state.managerOn = false;
    const res = await POST(makeReq('Bearer host-sess', BODY));
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe('That passcode is not valid.');
  });
});
