// Host Account V1 — (9) REVOCATION REACHES THE DURABLE DEVICE TOKEN.
//
// The whole point of binding a device credential to an account: possession of a
// historical Room-scoped token must stop working the moment the Host's workspace
// membership is revoked. Because this is enforced inside authorizeDj/authorizeAdmin,
// all 22 credential-protected routes inherit it — this test pins that seam.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const state = {
  device: { id: 'dev-1', role: 'admin' as 'admin' | 'dj', label: 'iPad', accountId: null as string | null },
  ownerWorkspace: null as string | null,
  hasAccess: false,
  masterMatches: false,
};

vi.mock('./devices.server', () => ({
  authorizeDevice: vi.fn(async () => state.device),
}));
vi.mock('./host-auth.server', () => ({
  roomOwnerWorkspace: vi.fn(async () => state.ownerWorkspace),
  accountHasRoomAccess: vi.fn(async () => state.hasAccess),
}));
vi.mock('./dj-auth.server', () => ({
  credentialMatches: vi.fn(async () => state.masterMatches),
  sha256Hex: vi.fn(async (s: string) => `h(${s})`),
  randomToken: vi.fn(() => 'tok'),
  bearerFromHeader: vi.fn(() => null),
  timingSafeEqual: vi.fn(() => false),
}));
vi.mock('./supabase.server', () => ({
  karaokeDb: () => ({
    from: () => {
      const b = {
        select: () => b,
        eq: () => b,
        maybeSingle: async () => ({
          data: { id: 'room-1', slug: 'bty-home', display_name: 'BTY Home', status: 'open', dj_secret: 'secret' },
          error: null,
        }),
      };
      return b;
    },
  }),
}));

import { authorizeDj, authorizeAdmin } from './rooms.server';

beforeEach(() => {
  state.device = { id: 'dev-1', role: 'admin', label: 'iPad', accountId: null };
  state.ownerWorkspace = null;
  state.hasAccess = false;
  state.masterMatches = false;
});

describe('device credentials are subordinate to workspace membership', () => {
  it('a LEGACY (unbound) device still works on an unclaimed Room — transitional path', async () => {
    state.device.accountId = null;
    state.ownerWorkspace = null;
    expect(await authorizeDj('bty-home', 'tok')).not.toBeNull();
  });

  it('an ACCOUNT-BOUND device works while its Host holds ACTIVE membership', async () => {
    state.device.accountId = 'acct-1';
    state.ownerWorkspace = 'ws-1';
    state.hasAccess = true;
    expect(await authorizeDj('bty-home', 'tok')).not.toBeNull();
    expect(await authorizeAdmin('bty-home', 'tok')).not.toBeNull();
  });

  it('(9) REVOKED membership kills the durable device token on the very next call', async () => {
    state.device.accountId = 'acct-1';
    state.ownerWorkspace = 'ws-1';
    state.hasAccess = false; // membership revoked server-side
    expect(await authorizeDj('bty-home', 'tok')).toBeNull();
    expect(await authorizeAdmin('bty-home', 'tok')).toBeNull();
  });

  it('a device bound to a Host of a DIFFERENT workspace cannot use this Room', async () => {
    state.device.accountId = 'acct-other';
    state.ownerWorkspace = 'ws-1';
    state.hasAccess = false; // not a member of the OWNING workspace
    expect(await authorizeDj('bty-home', 'tok')).toBeNull();
  });

  it('an account-bound device still works on a Room nobody has claimed yet', async () => {
    state.device.accountId = 'acct-1';
    state.ownerWorkspace = null; // unclaimed → no workspace to be a member of
    expect(await authorizeDj('bty-home', 'tok')).not.toBeNull();
  });

  it('a dj-role device is still refused ADMIN authority regardless of membership', async () => {
    state.device = { id: 'dev-1', role: 'dj', label: 'iPad', accountId: 'acct-1' };
    state.ownerWorkspace = 'ws-1';
    state.hasAccess = true;
    expect(await authorizeDj('bty-home', 'tok')).not.toBeNull();
    expect(await authorizeAdmin('bty-home', 'tok')).toBeNull();
  });
});
