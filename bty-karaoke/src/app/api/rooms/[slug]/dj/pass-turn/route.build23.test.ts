// BUILD 23 — /dj/pass-turn publishes the auto-advance admission block.
//
// The shipped route emitted only `reason` + FREE `usage`, so a fail-closed refusal of the NEXT
// song arrived as `reason:'needs_ready'` — telling the Host to wait for a Ready signal that had
// already been given. These tests pin the honest contract AND the three things that must not
// change, because getting any of them wrong is worse than the original defect:
//
//   • HTTP 200 — the current song genuinely completed. A 4xx/5xx would make every shipped client
//     treat a successful terminal transition as a failure and re-fire it.
//   • completed: true — same reason.
//   • needs_ready / no_next / upgrade_required — frozen, byte-for-byte.
//
// Leakage is pinned explicitly: the response is checked against a CLOSED key allowlist, so a
// future field added anywhere upstream cannot ride out to a room-scoped DJ credential unnoticed.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const state = {
  auth: { room: { id: 'room-1' } } as null | { room: { id: string } },
  access: { ok: true } as { ok: true } | { ok: false; status: number; code: string; error?: string },
  result: {} as Record<string, unknown>,
};

vi.mock('@/lib/dj-auth.server', () => ({ roomCredentialFromRequest: vi.fn(() => 'cred') }));
vi.mock('@/lib/rooms.server', () => ({
  authorizeDj: vi.fn(async () => state.auth),
  passTurnAndPromote: vi.fn(async () => state.result),
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
const post = () => POST(makeReq({ currentId: 'req-cur' }), ctx);

/** Every key this route is permitted to emit. Anything else is a leak. */
const ALLOWED_KEYS = new Set([
  'ok', 'completed', 'promoted', 'reason', 'usage',
  'blockedRequestId', 'message', 'durationFailureReason',
  'leaseEndsAt', 'durationSeconds', 'requiredChargeSeconds', 'remainingSeconds', 'passExpiresAt',
  'finalSongGraceApplied', 'finalSongGraceSeconds', 'finalSongChargedSeconds', 'remainingBeforeSeconds',
]);

beforeEach(() => {
  state.auth = { room: { id: 'room-1' } };
  state.access = { ok: true };
  state.result = { completed: true, promoted: null, reason: 'needs_ready' };
});

describe('BUILD 23 — duration_unavailable', () => {
  beforeEach(() => {
    state.result = {
      completed: true,
      promoted: null,
      reason: 'duration_unavailable',
      blocked: { id: 'req-next' },
      durationFailureReason: 'too_long',
    };
  });

  it('A1: 200 + completed true + promoted null + the distinct reason', async () => {
    const res = await post();
    expect(res.status).toBe(200);
    const d = await res.json();
    expect(d.ok).toBe(true);
    expect(d.completed).toBe(true);
    expect(d.promoted).toBeNull();
    expect(d.reason).toBe('duration_unavailable');
  });

  it('publishes the blocked request id so the notice is keyed to canonical truth', async () => {
    const d = await (await post()).json();
    expect(d.blockedRequestId).toBe('req-next');
  });

  it.each([
    ['too_long', '15분'],
    ['video_unavailable', '다른 영상'],
    ['quota_exceeded', '한도'],
    ['not_configured', '관리자'],
  ])('reason %s selects its own sentence', async (reason, fragment) => {
    state.result = { ...state.result, durationFailureReason: reason };
    const d = await (await post()).json();
    expect(d.durationFailureReason).toBe(reason);
    expect(d.message).toContain(fragment);
  });

  it('lookup_failed uses the generic retryable sentence', async () => {
    state.result = { ...state.result, durationFailureReason: 'lookup_failed' };
    const d = await (await post()).json();
    expect(d.message).toBe('영상 길이를 확인하지 못했어요. 잠시 후 다시 시도해 주세요.');
  });

  it('omits durationFailureReason when unclassified, and still explains generically', async () => {
    state.result = { completed: true, promoted: null, reason: 'duration_unavailable', blocked: { id: 'req-next' } };
    const d = await (await post()).json();
    expect('durationFailureReason' in d).toBe(false);
    expect(d.message).toBe('영상 길이를 확인하지 못했어요. 잠시 후 다시 시도해 주세요.');
  });

  it('never emits too_long copy for an unclassified block (A6)', async () => {
    state.result = { completed: true, promoted: null, reason: 'duration_unavailable', blocked: { id: 'req-next' } };
    const d = await (await post()).json();
    expect(d.message).not.toContain('15분');
  });

  it('omits every admission number the authority did not supply', async () => {
    const d = await (await post()).json();
    for (const k of ['durationSeconds', 'passExpiresAt', 'remainingSeconds', 'requiredChargeSeconds', 'leaseEndsAt']) {
      expect(k in d).toBe(false);
    }
  });
});

describe('BUILD 23 — pass_insufficient', () => {
  beforeEach(() => {
    state.result = {
      completed: true,
      promoted: null,
      reason: 'pass_insufficient',
      blocked: { id: 'req-next' },
      passExpiresAt: '2026-08-01T01:00:00.000Z',
      durationSeconds: 242,
    };
  });

  it('A2: 200 + completed true + promoted null + reason + boundary detail', async () => {
    const res = await post();
    expect(res.status).toBe(200);
    const d = await res.json();
    expect(d.completed).toBe(true);
    expect(d.promoted).toBeNull();
    expect(d.reason).toBe('pass_insufficient');
    expect(d.passExpiresAt).toBe('2026-08-01T01:00:00.000Z');
    expect(d.durationSeconds).toBe(242);
    expect(d.blockedRequestId).toBe('req-next');
  });

  it('uses the pass wording, never a duration sentence', async () => {
    const d = await (await post()).json();
    expect(d.message).toBe('남은 이용권 시간으로는 이 곡 전체를 재생할 수 없어요.');
    expect('durationFailureReason' in d).toBe(false);
  });

  it('omits the boundary detail entirely when the authority sent none', async () => {
    state.result = { completed: true, promoted: null, reason: 'pass_insufficient', blocked: { id: 'req-next' } };
    const d = await (await post()).json();
    expect('passExpiresAt' in d).toBe(false);
    expect('durationSeconds' in d).toBe(false);
    expect(d.message).toBe('남은 이용권 시간으로는 이 곡 전체를 재생할 수 없어요.');
  });
});

describe('BUILD 23 — no billing or security internal may leak', () => {
  it('emits only allowlisted keys on a duration block', async () => {
    state.result = {
      completed: true, promoted: null, reason: 'duration_unavailable',
      blocked: { id: 'req-next', room_id: 'room-1', session_id: 'sess-1', idempotency_key: 'k' },
      durationFailureReason: 'quota_exceeded',
      // Upstream internals that must NEVER reach a room-scoped DJ credential:
      accountId: 'acct-1', passGrantId: 'pass-1', chargedWindowStart: 'w', passCovered: true,
      entitlement: { accountId: 'acct-1' },
    };
    const d = await (await post()).json();
    for (const k of Object.keys(d)) expect(ALLOWED_KEYS.has(k)).toBe(true);
    expect(JSON.stringify(d)).not.toContain('acct-1');
    expect(JSON.stringify(d)).not.toContain('pass-1');
    expect(JSON.stringify(d)).not.toContain('sess-1');
  });

  it('emits only allowlisted keys on a pass block', async () => {
    state.result = {
      completed: true, promoted: null, reason: 'pass_insufficient',
      blocked: { id: 'req-next' }, passExpiresAt: '2026-08-01T01:00:00.000Z',
      accountId: 'acct-1', passGrantId: 'pass-1',
    };
    const d = await (await post()).json();
    for (const k of Object.keys(d)) expect(ALLOWED_KEYS.has(k)).toBe(true);
    expect(JSON.stringify(d)).not.toContain('pass-1');
  });
});

describe('BUILD 23 — frozen behaviour (A3/A4/A10)', () => {
  it('needs_ready is unchanged and carries no admission keys', async () => {
    const res = await post();
    expect(res.status).toBe(200);
    const d = await res.json();
    expect(d.reason).toBe('needs_ready');
    expect(d.usage).toBeNull();
    for (const k of ['blockedRequestId', 'message', 'durationFailureReason', 'passExpiresAt']) {
      expect(k in d).toBe(false);
    }
  });

  it('no_next is unchanged', async () => {
    state.result = { completed: true, promoted: null, reason: 'no_next' };
    const d = await (await post()).json();
    expect(d.reason).toBe('no_next');
    expect('message' in d).toBe(false);
  });

  it('upgrade_required still carries its usage projection and no admission keys', async () => {
    state.result = {
      completed: true, promoted: null, reason: 'upgrade_required',
      entitlement: { plan: 'FREE', unlimited: false, remainingSeconds: 0, limitSeconds: 900, usedSeconds: 900 },
    };
    const res = await post();
    expect(res.status).toBe(200);
    const d = await res.json();
    expect(d.reason).toBe('upgrade_required');
    expect(d.usage).not.toBeNull();
    expect('blockedRequestId' in d).toBe(false);
  });

  it('a normal promotion is unchanged', async () => {
    state.result = { completed: true, promoted: { id: 'req-next' }, reason: 'promoted' };
    const res = await post();
    expect(res.status).toBe(200);
    const d = await res.json();
    expect(d.reason).toBe('promoted');
    expect(d.promoted).toEqual({ id: 'req-next' });
    expect('message' in d).toBe(false);
  });

  it('an ended event still 4xxs before any advance is attempted', async () => {
    state.access = { ok: false, status: 409, code: 'EVENT_ENDED', error: 'ended' };
    const res = await post();
    expect(res.status).toBe(409);
  });
});

describe('BUILD 23 — older-client compatibility', () => {
  it('an unknown reason still parses as an ordinary 200 success envelope', async () => {
    // What a pre-BUILD-23 client does: reads ok/completed/promoted/reason, and because
    // `reason !== 'promoted'` it shows its existing "waiting" copy and does NOT retry the
    // completed mutation. The keys it relies on are all present and unchanged in type.
    state.result = {
      completed: true, promoted: null, reason: 'duration_unavailable',
      blocked: { id: 'req-next' }, durationFailureReason: 'too_long',
    };
    const res = await post();
    expect(res.status).toBe(200);
    const d = await res.json();
    expect(typeof d.ok).toBe('boolean');
    expect(typeof d.completed).toBe('boolean');
    expect(d.promoted).toBeNull();
    expect(typeof d.reason).toBe('string');
    expect(d.reason).not.toBe('promoted'); // → the old client's non-promoted branch, no retry
  });
});
