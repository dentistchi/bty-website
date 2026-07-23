// B2 — the DJ single-request PATCH surfaces the FREE-limit block truthfully:
//  • manual play blocked → 402 upgrade_required + usage projection, no mutation echoed
//  • auto-next blocked → 200 (current completed) with upgradeRequired + usage, no promote

import { describe, it, expect, vi, beforeEach } from 'vitest';

const state = {
  auth: { room: { id: 'room-1' } } as null | { room: { id: string } },
  access: { ok: true, event: null } as
    | { ok: true; event: unknown }
    | { ok: false; status: 403 | 409; code: string; error: string },
  result: { outcome: 'ok', request: { id: 'req-1' }, from: 'playing' } as unknown,
  promote: { outcome: 'started', request: { id: 'next-1' } } as unknown,
};

const ENT_ZERO = {
  plan: 'FREE', unlimited: false, enforcementEnabled: true, limitSeconds: 900,
  usedSeconds: 900, remainingSeconds: 0, activePlaybackCount: 0,
  nextResetAt: '2026-07-24T11:00:00.000Z', windowStart: '2026-07-23T11:00:00.000Z',
  timezone: 'America/Los_Angeles', warnLevel: 'zero',
};

vi.mock('@/lib/rooms.server', () => ({
  authorizeDj: vi.fn(async () => state.auth),
  getGuestQueueStatus: vi.fn(),
  getPublicRoomBySlug: vi.fn(),
  setRequestStatus: vi.fn(async () => state.result),
  moveToNextWaiting: vi.fn(async () => state.result),
  promoteNextReady: vi.fn(async () => state.promote),
}));
vi.mock('@/lib/events.server', () => ({
  getCanonicalEvent: vi.fn(async () => ({ id: 'evt-1' })),
  resolveEventAccess: vi.fn(async () => state.access),
}));
vi.mock('@/lib/lyrics-resolver.server', () => ({ scheduleLyricsResolve: vi.fn() }));

import { PATCH } from './route';

function makeReq(authorization: string | undefined, body: unknown) {
  return {
    headers: { get: (k: string) => (k.toLowerCase() === 'authorization' ? authorization ?? null : null) },
    json: async () => body,
  } as unknown as Parameters<typeof PATCH>[0];
}
const ctx = { params: Promise.resolve({ slug: 'bty-home', id: 'req-1' }) };

beforeEach(() => {
  state.auth = { room: { id: 'room-1' } };
  state.access = { ok: true, event: null };
  state.result = { outcome: 'ok', request: { id: 'req-1' }, from: 'playing' };
  state.promote = { outcome: 'started', request: { id: 'next-1' } };
});

describe('PATCH — manual play blocked by FREE limit', () => {
  it('returns 402 upgrade_required with the usage projection', async () => {
    state.result = { outcome: 'upgrade_required', from: 'waiting', entitlement: ENT_ZERO };
    const res = await PATCH(makeReq('Bearer x', { action: 'play' }), ctx);
    expect(res.status).toBe(402);
    const data = await res.json();
    expect(data.code).toBe('upgrade_required');
    expect(data.usage.bannerKind).toBe('zero_idle');
    expect(data.usage.startBlocked).toBe(true);
    expect(data.usage.remainingSeconds).toBe(0);
  });
});

describe('PATCH — auto-next blocked after a completion', () => {
  it('completes the current song (200) but does not promote; surfaces upgradeRequired + usage', async () => {
    state.result = { outcome: 'ok', request: { id: 'req-1' }, from: 'playing' };
    state.promote = { outcome: 'upgrade_required', nextRequest: { id: 'next-1' }, entitlement: ENT_ZERO };
    const res = await PATCH(makeReq('Bearer x', { action: 'complete' }), ctx);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.promoted).toBeNull();
    expect(data.upgradeRequired).toBe(true);
    expect(data.usage.startBlocked).toBe(true);
  });

  it('a normal promotion still returns the promoted id with upgradeRequired false', async () => {
    state.result = { outcome: 'ok', request: { id: 'req-1' }, from: 'playing' };
    state.promote = { outcome: 'started', request: { id: 'next-1' } };
    const res = await PATCH(makeReq('Bearer x', { action: 'complete' }), ctx);
    const data = await res.json();
    expect(data.promoted).toEqual({ id: 'next-1' });
    expect(data.upgradeRequired).toBe(false);
    expect(data.usage).toBeNull();
  });
});
