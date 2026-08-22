// B2 — /dj/start (first-song ensure) returns 402 upgrade_required + usage when the
// FREE daily limit blocks the start. Nothing is started (§9).

import { describe, it, expect, vi, beforeEach } from 'vitest';

const state = {
  auth: { room: { id: 'room-1' } } as null | { room: { id: string } },
  access: { ok: true } as { ok: true } | { ok: false; status: number; code: string },
  ensure: { outcome: 'started', request: { id: 'req-1' } } as unknown,
};

const ENT_ZERO = {
  plan: 'FREE', unlimited: false, enforcementEnabled: true, limitSeconds: 900,
  usedSeconds: 900, remainingSeconds: 0, activePlaybackCount: 0,
  nextResetAt: '2026-07-24T11:00:00.000Z', windowStart: null,
  timezone: 'America/Los_Angeles', warnLevel: 'zero',
};

// BUILD 26U-R1 — the Premium Room guard now sits in front of this route. It is stubbed as
// ENTITLED here because this file's subject is what the route does once the session is
// authorized; the guard's own refusal and expiry behaviour are proven in
// src/lib/premium-room-guard.server.test.ts.
vi.mock('@/lib/premium-room-guard.server', () => ({
  assertPremiumRoomSession: vi.fn(async () => ({ ok: true, entitlement: { entitled: true } })),
}));
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
  return {
    headers: { get: () => 'Bearer x' },
    json: async () => body,
  } as unknown as Parameters<typeof POST>[0];
}
const ctx = { params: Promise.resolve({ slug: 'bty-home' }) };

beforeEach(() => {
  state.auth = { room: { id: 'room-1' } };
  state.access = { ok: true };
  state.ensure = { outcome: 'started', request: { id: 'req-1' } };
});

describe('POST /dj/start — FREE limit block', () => {
  it('upgrade_required → 402 with usage projection, no start', async () => {
    state.ensure = { outcome: 'upgrade_required', entitlement: ENT_ZERO };
    const res = await POST(makeReq({ requestId: 'req-1' }), ctx);
    expect(res.status).toBe(402);
    const data = await res.json();
    expect(data.code).toBe('upgrade_required');
    expect(data.usage.bannerKind).toBe('zero_idle');
  });

  it('a normal start still returns 200 started', async () => {
    const res = await POST(makeReq({ requestId: 'req-1' }), ctx);
    expect(res.status).toBe(200);
    expect((await res.json()).code).toBe('started');
  });
});
