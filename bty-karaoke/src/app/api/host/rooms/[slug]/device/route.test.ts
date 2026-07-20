// Host Account V1 — the account→Room credential exchange boundary.
//
// This is where horizontal access would leak if the Room came from anywhere other
// than the URL + the caller's own memberships. Proves a signed-in Host cannot mint
// a credential for a Room their workspace does not own, and cannot even tell such
// a Room apart from one that does not exist.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const state = {
  account: { id: 'acct-1' } as null | { id: string },
  room: { id: 'room-pilot', slug: 'bty-home', display_name: 'BTY Home' } as
    | null
    | { id: string; slug: string; display_name: string },
  hasAccess: true,
};

const createDeviceSpy = vi.fn(async (_args: unknown) => ({ id: 'dev-1' }));

vi.mock('@/lib/host-auth.server', () => ({
  authorizeHost: vi.fn(async () => state.account),
  accountHasRoomAccess: vi.fn(async () => state.hasAccess),
}));
vi.mock('@/lib/rooms.server', () => ({ getPublicRoomBySlug: vi.fn(async () => state.room) }));
vi.mock('@/lib/devices.server', () => ({
  createDeviceSession: (a: unknown) => createDeviceSpy(a),
}));

import { POST } from './route';

function makeReq(auth?: string) {
  return {
    headers: { get: (k: string) => (k.toLowerCase() === 'authorization' ? auth ?? null : null) },
  } as unknown as Parameters<typeof POST>[0];
}
const ctx = (slug: string) => ({ params: Promise.resolve({ slug }) });

beforeEach(() => {
  state.account = { id: 'acct-1' };
  state.room = { id: 'room-pilot', slug: 'bty-home', display_name: 'BTY Home' };
  state.hasAccess = true;
  createDeviceSpy.mockClear();
});

describe('POST /api/host/rooms/[slug]/device', () => {
  it('rejects an unauthenticated caller (401), minting nothing', async () => {
    state.account = null;
    const res = await POST(makeReq(undefined), ctx('bty-home'));
    expect(res.status).toBe(401);
    expect(createDeviceSpy).not.toHaveBeenCalled();
  });

  it('(4) a signed-in Host WITHOUT membership gets 404 and no credential', async () => {
    state.hasAccess = false;
    const res = await POST(makeReq('Bearer host-sess'), ctx('bty-home'));
    expect(res.status).toBe(404);
    expect(createDeviceSpy).not.toHaveBeenCalled();
  });

  it('(10) an unowned Room is indistinguishable from a missing Room (no enumeration)', async () => {
    state.hasAccess = false;
    const unowned = await POST(makeReq('Bearer host-sess'), ctx('someone-elses-room'));
    state.room = null;
    const missing = await POST(makeReq('Bearer host-sess'), ctx('does-not-exist'));
    expect(unowned.status).toBe(404);
    expect(missing.status).toBe(404);
    expect(await unowned.json()).toEqual(await missing.json());
  });

  it('mints an ACCOUNT-BOUND admin credential for an owned Room', async () => {
    const res = await POST(makeReq('Bearer host-sess'), ctx('bty-home'));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(typeof data.deviceToken).toBe('string');
    expect(data.deviceToken.length).toBeGreaterThan(20);
    expect(createDeviceSpy).toHaveBeenCalledTimes(1);
    // The binding is what makes membership revocation kill the device's access.
    expect(createDeviceSpy).toHaveBeenCalledWith(
      expect.objectContaining({ roomId: 'room-pilot', role: 'admin', accountId: 'acct-1' }),
    );
  });

  it('never echoes the credential into the response beyond the token itself', async () => {
    const res = await POST(makeReq('Bearer host-sess'), ctx('bty-home'));
    const data = await res.json();
    expect(Object.keys(data).sort()).toEqual(['deviceToken', 'ok', 'room']);
  });
});
