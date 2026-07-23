// B2 — /dj/pass-turn completes the current song (§6, never force-stopped) and, when the
// FREE limit blocks the next start, returns reason='upgrade_required' + usage. The next
// request is NOT promoted and no YouTube handoff occurs.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const state = {
  auth: { room: { id: 'room-1' } } as null | { room: { id: string } },
  access: { ok: true } as { ok: true } | { ok: false; status: number; code: string },
  pass: { completed: true, promoted: null, reason: 'promoted' } as unknown,
};

const ENT_ZERO = {
  plan: 'FREE', unlimited: false, enforcementEnabled: true, limitSeconds: 900,
  usedSeconds: 900, remainingSeconds: 0, activePlaybackCount: 0,
  nextResetAt: '2026-07-24T11:00:00.000Z', windowStart: null,
  timezone: 'America/Los_Angeles', warnLevel: 'zero',
};

vi.mock('@/lib/dj-auth.server', () => ({ roomCredentialFromRequest: vi.fn(() => 'cred') }));
vi.mock('@/lib/rooms.server', () => ({
  authorizeDj: vi.fn(async () => state.auth),
  passTurnAndPromote: vi.fn(async () => state.pass),
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
  state.pass = { completed: true, promoted: null, reason: 'promoted' };
});

describe('POST /dj/pass-turn — FREE limit block on next', () => {
  it('current completed, next blocked → reason upgrade_required + usage, promoted null', async () => {
    state.pass = { completed: true, promoted: null, reason: 'upgrade_required', entitlement: ENT_ZERO };
    const res = await POST(makeReq({ currentId: 'req-1' }), ctx);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.completed).toBe(true); // current song was NOT force-stopped — it completed
    expect(data.promoted).toBeNull();
    expect(data.reason).toBe('upgrade_required');
    expect(data.usage.startBlocked).toBe(true);
  });

  it('a normal promotion carries no usage payload', async () => {
    state.pass = { completed: true, promoted: { id: 'next-1' }, reason: 'promoted' };
    const res = await POST(makeReq({ currentId: 'req-1' }), ctx);
    const data = await res.json();
    expect(data.promoted).toEqual({ id: 'next-1' });
    expect(data.usage).toBeNull();
  });
});
