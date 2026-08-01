// BUILD 23 — PATCH /requests/{id} (complete/skip) advance parity.
//
// This route drives the SAME `promoteNextReady` seam as /dj/pass-turn, and it was silently worse:
// a fail-closed refusal of the next song produced `promoted:null, upgradeRequired:false` with no
// field of any kind saying why. A5 requires both endpoints to expose equivalent admission
// classifications, so these mirror the pass-turn tests against this route's own envelope.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const state = {
  auth: { room: { id: 'room-1' } } as null | { room: { id: string } },
  access: { ok: true } as { ok: true } | { ok: false; status: number; code: string; error?: string },
  status: { outcome: 'ok', from: 'playing', request: { id: 'req-cur' } } as Record<string, unknown>,
  promote: { outcome: 'blocked_not_ready' } as Record<string, unknown>,
};

vi.mock('@/lib/dj-auth.server', () => ({ roomCredentialFromRequest: vi.fn(() => 'cred') }));
vi.mock('@/lib/rooms.server', () => ({
  authorizeDj: vi.fn(async () => state.auth),
  getPublicRoomBySlug: vi.fn(async () => ({ id: 'room-1' })),
  getGuestQueueStatus: vi.fn(async () => null),
  setRequestStatus: vi.fn(async () => state.status),
  moveToNextWaiting: vi.fn(async () => null),
  promoteNextReady: vi.fn(async () => state.promote),
}));
vi.mock('@/lib/events.server', () => ({
  getCanonicalEvent: vi.fn(async () => ({ id: 'evt-1' })),
  resolveEventAccess: vi.fn(async () => state.access),
}));
vi.mock('@/lib/lyrics-resolver.server', () => ({ scheduleLyricsResolve: vi.fn() }));

import { PATCH } from './route';

function makeReq(body: unknown) {
  return { headers: { get: () => 'Bearer x' }, json: async () => body } as unknown as Parameters<typeof PATCH>[0];
}
const ctx = { params: Promise.resolve({ slug: 'bty-home', id: 'req-cur' }) };
const patch = (action: 'complete' | 'skip' = 'complete') => PATCH(makeReq({ action }), ctx);

const ALLOWED_KEYS = new Set([
  'ok', 'request', 'promoted', 'upgradeRequired', 'usage',
  'reason', 'blockedRequestId', 'message', 'durationFailureReason',
  'leaseEndsAt', 'durationSeconds', 'requiredChargeSeconds', 'remainingSeconds', 'passExpiresAt',
  'finalSongGraceApplied', 'finalSongGraceSeconds', 'finalSongChargedSeconds', 'remainingBeforeSeconds',
]);

beforeEach(() => {
  state.auth = { room: { id: 'room-1' } };
  state.access = { ok: true };
  state.status = { outcome: 'ok', from: 'playing', request: { id: 'req-cur' } };
  state.promote = { outcome: 'blocked_not_ready', nextRequest: { id: 'req-next' } };
});

describe('BUILD 23 — PATCH complete parity', () => {
  it('duration_unavailable is reported with reason, blocked id, and wording', async () => {
    state.promote = {
      outcome: 'duration_unavailable',
      nextRequest: { id: 'req-next' },
      durationFailureReason: 'too_long',
    };
    const res = await patch('complete');
    expect(res.status).toBe(200);
    const d = await res.json();
    expect(d.ok).toBe(true);
    expect(d.promoted).toBeNull();
    expect(d.upgradeRequired).toBe(false);
    expect(d.reason).toBe('duration_unavailable');
    expect(d.blockedRequestId).toBe('req-next');
    expect(d.durationFailureReason).toBe('too_long');
    expect(d.message).toContain('15분');
  });

  it('pass_insufficient is reported with its boundary detail', async () => {
    state.promote = {
      outcome: 'pass_insufficient',
      nextRequest: { id: 'req-next' },
      passExpiresAt: '2026-08-01T01:00:00.000Z',
    };
    const d = await (await patch('complete')).json();
    expect(d.reason).toBe('pass_insufficient');
    expect(d.passExpiresAt).toBe('2026-08-01T01:00:00.000Z');
    expect(d.message).toBe('남은 이용권 시간으로는 이 곡 전체를 재생할 수 없어요.');
    expect('durationFailureReason' in d).toBe(false);
  });

  it('omits an unclassified duration reason and never fabricates one', async () => {
    state.promote = { outcome: 'duration_unavailable', nextRequest: { id: 'req-next' } };
    const d = await (await patch('complete')).json();
    expect('durationFailureReason' in d).toBe(false);
    expect(d.message).toBe('영상 길이를 확인하지 못했어요. 잠시 후 다시 시도해 주세요.');
  });
});

describe('BUILD 23 — PATCH skip parity', () => {
  it('skip surfaces the same classification as complete', async () => {
    state.promote = {
      outcome: 'pass_insufficient',
      nextRequest: { id: 'req-next' },
      passExpiresAt: '2026-08-01T01:00:00.000Z',
    };
    const d = await (await patch('skip')).json();
    expect(d.reason).toBe('pass_insufficient');
    expect(d.blockedRequestId).toBe('req-next');
  });

  it('skip surfaces a duration block identically', async () => {
    state.promote = {
      outcome: 'duration_unavailable',
      nextRequest: { id: 'req-next' },
      durationFailureReason: 'quota_exceeded',
    };
    const d = await (await patch('skip')).json();
    expect(d.reason).toBe('duration_unavailable');
    expect(d.durationFailureReason).toBe('quota_exceeded');
  });
});

describe('BUILD 23 — PATCH frozen behaviour', () => {
  it('a genuine not-ready next song emits no admission keys at all', async () => {
    const res = await patch('complete');
    expect(res.status).toBe(200);
    const d = await res.json();
    expect(d.promoted).toBeNull();
    expect(d.upgradeRequired).toBe(false);
    for (const k of ['reason', 'blockedRequestId', 'message', 'durationFailureReason']) {
      expect(k in d).toBe(false);
    }
  });

  it('upgrade_required keeps its shipped shape', async () => {
    state.promote = { outcome: 'upgrade_required', entitlement: { plan: 'FREE', remainingSeconds: 0 } };
    const d = await (await patch('complete')).json();
    expect(d.upgradeRequired).toBe(true);
    expect(d.usage).not.toBeNull();
    expect('reason' in d).toBe(false);
  });

  it('a successful promotion keeps its shipped shape', async () => {
    state.promote = { outcome: 'started', request: { id: 'req-next' } };
    const d = await (await patch('complete')).json();
    expect(d.promoted).toEqual({ id: 'req-next' });
    expect(d.upgradeRequired).toBe(false);
    expect('message' in d).toBe(false);
  });

  it('a waiting-song removal never runs the advance seam', async () => {
    state.status = { outcome: 'ok', from: 'waiting', request: { id: 'req-x' } };
    const d = await (await patch('complete')).json();
    expect(d.promoted).toBeNull();
    expect('reason' in d).toBe(false);
  });
});

describe('BUILD 23 — PATCH leakage', () => {
  it('emits only allowlisted keys', async () => {
    state.promote = {
      outcome: 'pass_insufficient',
      nextRequest: { id: 'req-next', room_id: 'room-1', session_id: 'sess-1' },
      passExpiresAt: '2026-08-01T01:00:00.000Z',
      accountId: 'acct-1', passGrantId: 'pass-1', chargedWindowStart: 'w',
    };
    const d = await (await patch('complete')).json();
    for (const k of Object.keys(d)) expect(ALLOWED_KEYS.has(k)).toBe(true);
    expect(JSON.stringify(d)).not.toContain('acct-1');
    expect(JSON.stringify(d)).not.toContain('pass-1');
  });
});
