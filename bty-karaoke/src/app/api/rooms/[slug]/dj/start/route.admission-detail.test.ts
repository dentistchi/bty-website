// BUILD 20M-GLOBAL-CUTOVER-R1 — /dj/start publishes the authoritative admission detail the v2
// transaction already computed, additively. These tests pin BOTH directions: the fields appear
// when the authority supplies them, and they are ABSENT (never zero-filled) when it does not —
// which is what keeps an older client, and the whole v1 path, working unchanged.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const state = {
  auth: { room: { id: 'room-1' } } as null | { room: { id: string } },
  access: { ok: true } as { ok: true } | { ok: false; status: number; code: string },
  ensure: { outcome: 'started', request: { id: 'req-1' } } as unknown,
};

const ENT_ZERO = {
  plan: 'FREE', unlimited: false, enforcementEnabled: true, limitSeconds: 900,
  usedSeconds: 900, remainingSeconds: 0, activePlaybackCount: 0,
  nextResetAt: '2026-07-31T11:00:00.000Z', windowStart: null,
  timezone: 'America/Los_Angeles', warnLevel: 'zero',
};

vi.mock('@/lib/dj-auth.server', () => ({ roomCredentialFromRequest: vi.fn(() => 'cred') }));
vi.mock('@/lib/rooms.server', () => ({
  authorizeDj: vi.fn(async () => state.auth),
  ensurePlaying: vi.fn(async () => state.ensure),
}));
vi.mock('@/lib/events.server', () => ({
  getCanonicalEvent: vi.fn(async () => ({ id: 'evt-1' })),
  resolveEventAccess: vi.fn(async () => state.access),
}));
vi.mock('@/lib/lyrics-resolver.server', () => ({ scheduleLyricsResolve: vi.fn() }));

import { POST } from './route';

function makeReq(body: unknown) {
  return { headers: { get: () => 'Bearer x' }, json: async () => body } as unknown as Parameters<typeof POST>[0];
}
const ctx = { params: Promise.resolve({ slug: 'bty-home' }) };

beforeEach(() => {
  state.auth = { room: { id: 'room-1' } };
  state.access = { ok: true };
  state.ensure = { outcome: 'started', request: { id: 'req-1' } };
});

describe('R1 — started', () => {
  it('A: publishes the authoritative leaseEndsAt and durationSeconds', async () => {
    state.ensure = {
      outcome: 'started', request: { id: 'req-1' },
      leaseEndsAt: '2026-07-31T00:05:00.000Z', durationSeconds: 230,
    };
    const res = await POST(makeReq({ requestId: 'req-1' }), ctx);
    expect(res.status).toBe(200);
    const d = await res.json();
    expect(d.code).toBe('started');
    expect(d.leaseEndsAt).toBe('2026-07-31T00:05:00.000Z');
    expect(d.durationSeconds).toBe(230);
  });

  it('M: a v1 start (no lease values) omits the fields entirely — older payload shape preserved', async () => {
    const res = await POST(makeReq({ requestId: 'req-1' }), ctx);
    expect(res.status).toBe(200);
    const d = await res.json();
    expect(d.code).toBe('started');
    expect(d.ok).toBe(true);
    expect('leaseEndsAt' in d).toBe(false);
    expect('durationSeconds' in d).toBe(false);
  });
});

describe('R1 — already_active', () => {
  it('D: reports the lease ALREADY in force so recovery keeps lease visibility', async () => {
    state.ensure = {
      outcome: 'already_active', request: { id: 'req-1' },
      leaseEndsAt: '2026-07-31T00:09:00.000Z', durationSeconds: 196,
    };
    const res = await POST(makeReq({ requestId: 'req-1' }), ctx);
    expect(res.status).toBe(200);
    const d = await res.json();
    expect(d.code).toBe('already_active');
    expect(d.leaseEndsAt).toBe('2026-07-31T00:09:00.000Z');
    expect(d.durationSeconds).toBe(196);
  });

  it('reports no lease end when no authoritative lease exists — never a guessed one', async () => {
    state.ensure = { outcome: 'already_active', request: { id: 'req-1' } };
    const d = await (await POST(makeReq({ requestId: 'req-1' }), ctx)).json();
    expect(d.code).toBe('already_active');
    expect('leaseEndsAt' in d).toBe(false);
  });
});

describe('R1 — pass_insufficient', () => {
  beforeEach(() => {
    state.ensure = {
      outcome: 'pass_insufficient',
      durationSeconds: 242, remainingSeconds: 190, passExpiresAt: '2026-07-31T00:03:10.000Z',
    };
  });

  it('F: returns durationSeconds, remainingSeconds and passExpiresAt at 402', async () => {
    const res = await POST(makeReq({ requestId: 'req-1' }), ctx);
    expect(res.status).toBe(402);
    const d = await res.json();
    expect(d.code).toBe('pass_insufficient');
    expect(d.durationSeconds).toBe(242);
    expect(d.remainingSeconds).toBe(190);
    expect(d.passExpiresAt).toBe('2026-07-31T00:03:10.000Z');
  });

  it('stays distinguishable from upgrade_required despite sharing HTTP 402', async () => {
    const d = await (await POST(makeReq({ requestId: 'req-1' }), ctx)).json();
    expect(d.code).toBe('pass_insufficient');
    expect(d.usage).toBeUndefined();
  });

  it('E: falls back to the bare payload when the authority supplied no detail', async () => {
    state.ensure = { outcome: 'pass_insufficient' };
    const res = await POST(makeReq({ requestId: 'req-1' }), ctx);
    expect(res.status).toBe(402);
    const d = await res.json();
    expect(d.code).toBe('pass_insufficient');
    expect('durationSeconds' in d).toBe(false);
    expect('remainingSeconds' in d).toBe(false);
    expect(typeof d.error).toBe('string');
  });

  it('exposes no account, pass, segment or billing internal', async () => {
    state.ensure = {
      outcome: 'pass_insufficient', durationSeconds: 242, remainingSeconds: 190,
      passExpiresAt: '2026-07-31T00:03:10.000Z',
      // These are present on the RPC row but must never reach the client.
      accountId: 'acct-1', passGrantId: 'pass-1', segmentId: 'seg-1',
      chargedWindowStart: '2026-07-30T07:00:00.000Z', passCovered: true,
    };
    const d = await (await POST(makeReq({ requestId: 'req-1' }), ctx)).json();
    for (const leak of ['accountId', 'passGrantId', 'segmentId', 'chargedWindowStart', 'passCovered']) {
      expect(leak in d).toBe(false);
    }
  });
});

describe('R1 — upgrade_required', () => {
  it('J: keeps the usage projection and adds duration + required charge + remaining', async () => {
    state.ensure = {
      outcome: 'upgrade_required', entitlement: ENT_ZERO,
      durationSeconds: 250, requiredChargeSeconds: 150, remainingSeconds: 149,
    };
    const res = await POST(makeReq({ requestId: 'req-1' }), ctx);
    expect(res.status).toBe(402);
    const d = await res.json();
    expect(d.code).toBe('upgrade_required');
    expect(d.usage.bannerKind).toBe('zero_idle');   // existing contract untouched
    expect(d.durationSeconds).toBe(250);
    expect(d.requiredChargeSeconds).toBe(150);
    expect(d.remainingSeconds).toBe(149);
  });

  it('K: requiredChargeSeconds keeps union semantics — it is NOT the raw song length', async () => {
    // An active lease already covers part of this song, so the charge is smaller than the
    // duration. Reporting duration as the required time would misinform the Host.
    state.ensure = {
      outcome: 'upgrade_required', entitlement: ENT_ZERO,
      durationSeconds: 250, requiredChargeSeconds: 150, remainingSeconds: 149,
    };
    const d = await (await POST(makeReq({ requestId: 'req-1' }), ctx)).json();
    expect(d.requiredChargeSeconds).toBeLessThan(d.durationSeconds);
  });

  it('M: an older upgrade_required (usage only) still returns the original shape', async () => {
    state.ensure = { outcome: 'upgrade_required', entitlement: ENT_ZERO };
    const d = await (await POST(makeReq({ requestId: 'req-1' }), ctx)).json();
    expect(d.usage.remainingSeconds).toBe(0);
    expect('requiredChargeSeconds' in d).toBe(false);
  });
});

describe('R1 — duration_unavailable', () => {
  it('L: stays generic at 503 with no fabricated duration field', async () => {
    state.ensure = { outcome: 'duration_unavailable' };
    const res = await POST(makeReq({ requestId: 'req-1' }), ctx);
    expect(res.status).toBe(503);
    const d = await res.json();
    expect(d.code).toBe('duration_unavailable');
    expect('durationSeconds' in d).toBe(false);
    expect('remainingSeconds' in d).toBe(false);
    expect(d.durationSeconds).toBeUndefined();
  });
});

describe('R1 — N: status codes are unchanged', () => {
  const cases: Array<[string, unknown, number]> = [
    ['started', { outcome: 'started', request: { id: 'r' } }, 200],
    ['already_active', { outcome: 'already_active', request: { id: 'r' } }, 200],
    ['upgrade_required', { outcome: 'upgrade_required', entitlement: ENT_ZERO }, 402],
    ['pass_insufficient', { outcome: 'pass_insufficient' }, 402],
    ['duration_unavailable', { outcome: 'duration_unavailable' }, 503],
    ['conflict', { outcome: 'conflict', playing: { id: 'other' } }, 409],
    ['not_ready', { outcome: 'not_ready' }, 409],
    ['not_found', { outcome: 'not_found' }, 404],
  ];
  for (const [name, ensure, status] of cases) {
    it(`${name} → ${status}`, async () => {
      state.ensure = ensure;
      expect((await POST(makeReq({ requestId: 'req-1' }), ctx)).status).toBe(status);
    });
  }
});
