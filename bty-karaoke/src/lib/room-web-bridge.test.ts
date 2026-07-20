// Room Web Auth Bridge (Phase 2 §9) — the additive cookie path must never widen
// authority. Bearer keeps working unchanged; a cookie authorizes ONLY its Room.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { roomCredentialFromRequest } from './dj-auth.server';

function req(headers: Record<string, string>, cookies: Record<string, string> = {}) {
  return {
    headers: { get: (k: string) => headers[k.toLowerCase()] ?? null },
    cookies: { get: (n: string) => (cookies[n] ? { value: cookies[n] } : undefined) },
  };
}

describe('roomCredentialFromRequest — shared additive resolver', () => {
  it('prefers the existing Bearer credential (native + paired browsers unchanged)', () => {
    expect(roomCredentialFromRequest(req({ authorization: 'Bearer dev-tok' }))).toBe('dev-tok');
  });

  it('Bearer WINS even when a Room cookie is also present (no silent takeover)', () => {
    expect(roomCredentialFromRequest(req({ authorization: 'Bearer dev-tok' }, { bty_room: 'cookie-tok' })))
      .toBe('dev-tok');
  });

  it('falls back to the Room cookie only when no Bearer exists', () => {
    expect(roomCredentialFromRequest(req({}, { bty_room: 'cookie-tok' }))).toBe('cookie-tok');
  });

  it('returns null with neither credential (missing credential fails)', () => {
    expect(roomCredentialFromRequest(req({}))).toBeNull();
    expect(roomCredentialFromRequest(req({}, {}))).toBeNull();
  });

  it('ignores unrelated cookies — only the Room cookie is a credential', () => {
    expect(roomCredentialFromRequest(req({}, { bty_host: 'host-sess', bty_mgr: 'mgr' }))).toBeNull();
  });

  it('ignores a malformed Authorization header rather than passing it through', () => {
    expect(roomCredentialFromRequest(req({ authorization: 'Basic abc' }))).toBeNull();
  });
});

// ---- authorization binding: a credential is never authority by itself ----------

const state = {
  device: { id: 'dev-1', role: 'admin' as 'admin' | 'dj', label: 'web', accountId: 'acct-1' as string | null },
  deviceRoom: 'room-A',
  ownerWorkspace: 'ws-1' as string | null,
  hasAccess: true,
};

vi.mock('./devices.server', () => ({
  // Models the real room_id filter: a token minted for room X resolves ONLY on X.
  authorizeDevice: vi.fn(async (roomId: string) =>
    roomId === state.deviceRoom ? state.device : null),
}));
vi.mock('./host-auth.server', () => ({
  roomOwnerWorkspace: vi.fn(async () => state.ownerWorkspace),
  accountHasRoomAccess: vi.fn(async () => state.hasAccess),
}));
vi.mock('./dj-auth.server', async (orig) => ({
  ...(await orig<typeof import('./dj-auth.server')>()),
  credentialMatches: vi.fn(async () => false),
}));
vi.mock('./supabase.server', () => ({
  karaokeDb: () => ({
    from: () => {
      const b = {
        select: () => b, eq: (c: string, v: unknown) => { if (c === 'slug') b._slug = v; return b; },
        maybeSingle: async () => ({
          data: { id: b._slug === 'room-a-slug' ? 'room-A' : 'room-B',
                  slug: b._slug, display_name: 'R', status: 'open', dj_secret: 's' },
          error: null,
        }),
        _slug: '' as unknown,
      };
      return b;
    },
  }),
}));

import { authorizeDj } from './rooms.server';

beforeEach(() => {
  state.device = { id: 'dev-1', role: 'admin', label: 'web', accountId: 'acct-1' };
  state.deviceRoom = 'room-A'; state.ownerWorkspace = 'ws-1'; state.hasAccess = true;
});

describe('cookie credentials are bound to ONE Room', () => {
  it('a valid Room-A credential authorizes Room A', async () => {
    expect(await authorizeDj('room-a-slug', 'cookie-tok')).not.toBeNull();
  });

  it('a Room-A credential CANNOT access Room B (identifier swapping fails)', async () => {
    // Same credential, different slug -> resolves to room-B, where the device does
    // not exist. Presence of a cookie is never authority for another Room.
    expect(await authorizeDj('room-b-slug', 'cookie-tok')).toBeNull();
  });

  it('revoked membership blocks the account-bound credential immediately', async () => {
    state.hasAccess = false;
    expect(await authorizeDj('room-a-slug', 'cookie-tok')).toBeNull();
  });

  it('removed Room ownership falls back to legacy behaviour, not elevated access', async () => {
    state.ownerWorkspace = null;             // unclaimed room
    expect(await authorizeDj('room-a-slug', 'cookie-tok')).not.toBeNull();
    state.ownerWorkspace = 'ws-1'; state.hasAccess = false;
    expect(await authorizeDj('room-a-slug', 'cookie-tok')).toBeNull();
  });

  it('an invalid/unknown credential does not fall back to any authorization', async () => {
    state.deviceRoom = 'room-NONE';          // token resolves nowhere
    expect(await authorizeDj('room-a-slug', 'bogus')).toBeNull();
  });

  it('provider type plays no part — authorization is account+room only', async () => {
    // The device carries no provider field at all; authorization succeeds purely on
    // membership + room binding.
    expect(Object.keys(state.device)).not.toContain('provider');
    expect(await authorizeDj('room-a-slug', 'cookie-tok')).not.toBeNull();
  });
});
