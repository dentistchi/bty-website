// BUILD 26U-R2 — COMPAT-1 / COMPAT-2: the public v1.0 binary must not break.
//
// WHAT THIS SIMULATES. `/dj/start-event` is called by build 109 as ordinary operation: the app
// enters a room, finds no active Event, and starts one (`AppSession.startNewEvent` →
// `APIClient.startEvent`). Build 109 sends exactly three headers — Authorization, Content-Type,
// Accept — and NO version information of any kind, because no such header existed when it
// shipped. That absence is reproduced here literally: the request carries no `x-bty-client`.
//
// THE DEFECT THIS GUARDS. Under R1 alone, that call returns 402 `PREMIUM_ROOM_REQUIRED` to a
// binary that was approved as free, has no purchase surface, and cannot be updated in place.
// The final case below asserts the defect is real rather than hypothetical, by driving the same
// request through the premium contract.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const state = {
  mode: 'dual' as 'legacy_free' | 'dual' | 'premium_all',
  /** Contracts the session-start authority was actually asked for. */
  contracts: [] as (string | undefined)[],
  /** Entitlement the account holds. Build 109's owner has none — it never could buy any. */
  entitled: false,
};

vi.mock('@/lib/rooms.server', () => ({
  authorizeDj: vi.fn(async () => ({
    room: { id: 'room-A', slug: 'room-a', display_name: 'Room A', status: 'open' },
    role: 'dj',
    deviceId: 'd1',
  })),
}));

vi.mock('@/lib/sessions.server', () => ({ startSession: vi.fn(async () => ({ id: 'sess-1' })) }));

vi.mock('@/lib/events.server', () => ({
  publicEvent: (e: { id: string; status: string }) => ({ id: e.id, status: e.status }),
  startHostedRoomSession: vi.fn(
    async (_roomId: string, _name: string, _by: string, contract?: string) => {
      state.contracts.push(contract);
      // The REAL rule, mirrored from the RPC: the legacy contract never asks about entitlement;
      // the premium contract refuses without it.
      if (contract === 'legacy') {
        return {
          ok: true as const,
          event: { id: 'evt-1', status: 'active' },
          activated: false,
          expiresAt: null,
          source: 'LEGACY_FREE',
        };
      }
      if (!state.entitled) return { ok: false as const, code: 'PREMIUM_ROOM_REQUIRED' as const };
      return {
        ok: true as const,
        event: { id: 'evt-1', status: 'active' },
        activated: true,
        expiresAt: '2026-08-23T18:00:00Z',
        source: 'ACTIVATED_PASS',
      };
    },
  ),
}));

vi.mock('@/lib/supabase.server', () => ({
  karaokeDb: () => ({
    rpc: (name: string) =>
      name === 'karaoke_premium_room_mode'
        ? Promise.resolve({ data: state.mode, error: null })
        : Promise.resolve({ data: null, error: null }),
  }),
}));

import { POST } from './route';

/** A request shaped exactly like build 109's: a Bearer token and nothing else. */
function build109Request(): Parameters<typeof POST>[0] {
  const headers = new Headers({
    authorization: 'Bearer tok',
    'content-type': 'application/json',
    accept: 'application/json',
  });
  return { headers } as unknown as Parameters<typeof POST>[0];
}

/** A v1.1 request: the same, plus the release-client discriminator. */
function nativeRequest(build: number): Parameters<typeof POST>[0] {
  const headers = new Headers({
    authorization: 'Bearer tok',
    'content-type': 'application/json',
    accept: 'application/json',
    'x-bty-client': `native/${build}`,
  });
  return { headers } as unknown as Parameters<typeof POST>[0];
}

const ctx = { params: Promise.resolve({ slug: 'room-a' }) };

beforeEach(() => {
  state.mode = 'dual';
  state.contracts = [];
  state.entitled = false;
  vi.clearAllMocks();
});

describe('COMPAT-1 — build 109 under DUAL keeps the legacy hosted-session behaviour', () => {
  it('starts a hosted Event and is NEVER told to pay', async () => {
    const res = await POST(build109Request(), ctx);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.event.id).toBe('evt-1');
    expect(state.contracts).toEqual(['legacy']);
  });

  it('receives no 402 and no Premium Room code, in any form', async () => {
    const res = await POST(build109Request(), ctx);
    expect(res.status).not.toBe(402);
    const text = JSON.stringify(await res.json());
    for (const token of ['PREMIUM_ROOM_REQUIRED', 'PREMIUM_ROOM_EXPIRED', 'premium_room_required']) {
      expect(text).not.toContain(token);
    }
  });

  it('the 201 body is a SUPERSET of what build 109 already parses — nothing it needs is gone', async () => {
    // Build 109 decodes nothing from this response (APIClient.startEvent discards the body and
    // rebuilds from device context), but the shape it saw must remain intact regardless.
    const body = await (await POST(build109Request(), ctx)).json();
    expect(body).toMatchObject({ ok: true, event: { id: expect.any(String) }, session: { id: 'sess-1' } });
  });

  it('activates nothing — a legacy Host cannot have their pass spent', async () => {
    const body = await (await POST(build109Request(), ctx)).json();
    expect(body.premiumRoom.activated).toBe(false);
    expect(body.premiumRoom.source).toBe('LEGACY_FREE');
  });

  it('is unaffected by whether the account happens to hold entitlement', async () => {
    for (const entitled of [false, true]) {
      state.entitled = entitled;
      state.contracts = [];
      const res = await POST(build109Request(), ctx);
      expect(res.status).toBe(201);
      expect(state.contracts).toEqual(['legacy']);
    }
  });
});

describe('COMPAT-1b — build 109 under LEGACY_FREE (the deploy-safe state)', () => {
  it('behaves identically — this is the state R1+R2 deploy into', async () => {
    state.mode = 'legacy_free';
    const res = await POST(build109Request(), ctx);
    expect(res.status).toBe(201);
    expect(state.contracts).toEqual(['legacy']);
  });

  it('and so does a v1.1 client — nobody is gated until the mode is deliberately changed', async () => {
    state.mode = 'legacy_free';
    const res = await POST(nativeRequest(110), ctx);
    expect(res.status).toBe(201);
    expect(state.contracts).toEqual(['legacy']);
  });
});

describe('COMPAT-2 — build 110 under DUAL requires Premium Room', () => {
  it('a v1.1 Host with no entitlement is refused with the Premium Room code', async () => {
    const res = await POST(nativeRequest(110), ctx);
    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.code).toBe('PREMIUM_ROOM_REQUIRED');
    expect(state.contracts).toEqual(['premium']);
  });

  it('the refusal names BTY Room and says the free YouTube path still works', () => {
    // (asserted on the copy module so the sentence is pinned in one place)
    return POST(nativeRequest(110), ctx)
      .then((r) => r.json())
      .then((body) => {
        expect(body.error).toContain('BTY');
        expect(body.error).toContain('YouTube');
        expect(body.error).not.toContain('곡');
      });
  });

  it('a v1.1 Host WITH entitlement starts the session and activates the armed pass', async () => {
    state.entitled = true;
    const res = await POST(nativeRequest(110), ctx);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.premiumRoom).toMatchObject({ activated: true, source: 'ACTIVATED_PASS' });
  });

  it('every future build is premium, not just 110 exactly', async () => {
    for (const build of [110, 111, 250, 9999]) {
      state.contracts = [];
      await POST(nativeRequest(build), ctx);
      expect(state.contracts, `build ${build}`).toEqual(['premium']);
    }
  });
});

describe('THE MEASURED DEFECT — why R2 exists at all', () => {
  it('under PREMIUM_ALL, the unchanged build-109 request is refused', async () => {
    // This is precisely what deploying R1 without R2 would do to the public app on day one.
    // It is asserted so the compatibility layer can never be removed by accident: if someone
    // deletes it, THIS case stops being the only way to reach the refusal.
    state.mode = 'premium_all';
    const res = await POST(build109Request(), ctx);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe('CLIENT_UPDATE_REQUIRED');
    // It is told to UPDATE, never to pay: this client cannot buy anything.
    expect(body.error).not.toContain('구매');
    expect(body.error).toContain('업데이트');
    expect(state.contracts).toEqual([]); // the session authority is never even reached
  });
});
