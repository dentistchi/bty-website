// GET /api/host/plan — the authenticated, read-only plan contract (Host Plan V1).
//
// Pins: a Host reads only its OWN plan (account derived server-side from the session
// in either transport); unauthenticated is a uniform 401; the response never leaks a
// credential; and one canonical account returns the same plan whether it arrived via
// Apple (Bearer) or a linked Google web cookie.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const state = {
  account: { id: 'acct-1', email: 'secret@example.com', provider_subject: 'sub-XYZ' } as
    | null
    | { id: string; email: string; provider_subject: string },
  bearer: null as string | null,
  cookie: null as string | null,
};

vi.mock('@/lib/dj-auth.server', () => ({
  bearerFromHeader: () => state.bearer,
}));
vi.mock('@/lib/host-web-session.server', () => ({
  hostTokenFromRequest: () => state.cookie,
}));
vi.mock('@/lib/host-auth.server', () => ({
  // A session (either transport) resolves to the account; no token → null.
  authorizeHost: vi.fn(async (token: string | null) => (token ? state.account : null)),
}));
vi.mock('@/lib/host-plan.server', () => ({
  resolveNorebangHostEntitlements: vi.fn(async (_accountId: string) => ({
    planCode: 'FREE',
    planStatus: 'ACTIVE',
    source: 'SYSTEM_DEFAULT',
    capabilities: {
      canCreateRoom: true,
      canEditRoomSettings: true,
      canUsePresetBranding: true,
      canStartEvent: true,
      canManageQueue: true,
      canUseGuestQR: true,
    },
    fallback: false,
  })),
}));

import { GET } from './route';

function makeReq() {
  return { headers: { get: () => null } } as unknown as Parameters<typeof GET>[0];
}

beforeEach(() => {
  state.account = { id: 'acct-1', email: 'secret@example.com', provider_subject: 'sub-XYZ' };
  state.bearer = null;
  state.cookie = null;
});

describe('GET /api/host/plan', () => {
  it('(11) an authenticated Host (web cookie) reads its FREE plan + capabilities', async () => {
    state.cookie = 'web-token';
    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.plan).toEqual({ code: 'FREE', status: 'ACTIVE', source: 'SYSTEM_DEFAULT' });
    expect(body.capabilities.canCreateRoom).toBe(true);
    expect(Object.values(body.capabilities).every(Boolean)).toBe(true);
  });

  it('(12) an unauthenticated request → uniform 401, no plan body', async () => {
    // no bearer, no cookie
    const res = await GET(makeReq());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.ok).toBeUndefined();
    expect(body.plan).toBeUndefined();
  });

  it('(13) the response never leaks a credential (no email / subject / token / account id)', async () => {
    state.cookie = 'web-token';
    const res = await GET(makeReq());
    const raw = JSON.stringify(await res.json());
    expect(raw).not.toContain('secret@example.com');
    expect(raw).not.toContain('sub-XYZ');
    expect(raw).not.toContain('acct-1');
    expect(raw.toLowerCase()).not.toContain('token');
    expect(raw.toLowerCase()).not.toContain('provider_subject');
  });

  it('(14) same canonical account returns the SAME plan via Apple Bearer and Google web cookie', async () => {
    state.bearer = 'apple-native-token';
    const viaApple = await (await GET(makeReq())).json();
    state.bearer = null;
    state.cookie = 'google-web-token';
    const viaGoogle = await (await GET(makeReq())).json();
    expect(viaApple.plan).toEqual(viaGoogle.plan);
    expect(viaApple.capabilities).toEqual(viaGoogle.capabilities);
  });

  it('sets no-store so a plan is never cached across sessions', async () => {
    state.cookie = 'web-token';
    const res = await GET(makeReq());
    expect(res.headers.get('Cache-Control')).toContain('no-store');
  });
});
