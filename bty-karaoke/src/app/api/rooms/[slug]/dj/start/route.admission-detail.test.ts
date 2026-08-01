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

describe('R4 — FREE Final Song Grace', () => {
  const GRACE = {
    outcome: 'started', request: { id: 'req-1' },
    leaseEndsAt: '2026-07-31T21:10:00.000Z', durationSeconds: 69,
    finalSongGraceApplied: true, finalSongGraceSeconds: 39,
    finalSongChargedSeconds: 30, remainingBeforeSeconds: 30,
  };

  it('publishes the grace fields on a graced start', async () => {
    state.ensure = GRACE;
    const res = await POST(makeReq({ requestId: 'req-1' }), ctx);
    expect(res.status).toBe(200);
    const d = await res.json();
    expect(d.code).toBe('started');
    expect(d.finalSongGraceApplied).toBe(true);
    expect(d.finalSongGraceSeconds).toBe(39);
    expect(d.finalSongChargedSeconds).toBe(30);
    expect(d.remainingBeforeSeconds).toBe(30);
    // The lease still covers the WHOLE song even though only 30s was charged.
    expect(d.durationSeconds).toBe(69);
    expect(d.leaseEndsAt).toBe('2026-07-31T21:10:00.000Z');
  });

  it('an ordinary start emits NO grace key at all (older clients unaffected)', async () => {
    state.ensure = { outcome: 'started', request: { id: 'req-1' }, leaseEndsAt: 'x', durationSeconds: 200 };
    const d = await (await POST(makeReq({ requestId: 'req-1' }), ctx)).json();
    expect('finalSongGraceApplied' in d).toBe(false);
    expect('finalSongGraceSeconds' in d).toBe(false);
  });

  it('finalSongGraceApplied:false is treated as "no grace" and omitted entirely', async () => {
    state.ensure = {
      outcome: 'started', request: { id: 'req-1' }, durationSeconds: 200,
      finalSongGraceApplied: false, finalSongGraceSeconds: null,
    };
    const d = await (await POST(makeReq({ requestId: 'req-1' }), ctx)).json();
    expect('finalSongGraceApplied' in d).toBe(false);
  });

  it('a response-loss retry reports the SAME grace facts via already_active', async () => {
    state.ensure = { ...GRACE, outcome: 'already_active' };
    const res = await POST(makeReq({ requestId: 'req-1' }), ctx);
    expect(res.status).toBe(200);
    const d = await res.json();
    expect(d.code).toBe('already_active');
    expect(d.finalSongGraceApplied).toBe(true);
    expect(d.finalSongGraceSeconds).toBe(39);
    expect(d.finalSongChargedSeconds).toBe(30);
    expect(d.leaseEndsAt).toBe('2026-07-31T21:10:00.000Z');
  });

  it('a blocked start never carries grace fields', async () => {
    state.ensure = {
      outcome: 'upgrade_required', entitlement: ENT_ZERO,
      durationSeconds: 291, requiredChargeSeconds: 291, remainingSeconds: 200,
    };
    const res = await POST(makeReq({ requestId: 'req-1' }), ctx);
    expect(res.status).toBe(402);
    const d = await res.json();
    expect('finalSongGraceApplied' in d).toBe(false);
    expect(d.requiredChargeSeconds).toBe(291);
  });

  it('exposes no ledger internals (account, segment, window)', async () => {
    state.ensure = {
      ...GRACE,
      accountId: 'acct-1', segmentId: 'seg-1', graceId: 'grace-1',
      chargedWindowStart: '2026-07-31T07:00:00.000Z',
    };
    const d = await (await POST(makeReq({ requestId: 'req-1' }), ctx)).json();
    for (const leak of ['accountId', 'segmentId', 'graceId', 'chargedWindowStart']) {
      expect(leak in d).toBe(false);
    }
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

// ---------------------------------------------------------------------------------------------
// BUILD 21 — the fail-closed duration block now explains itself.
//
// Every assertion below reads the RUNTIME SERIALIZED body (`await res.text()` / `res.json()`),
// never a TypeScript interface, because the contract that matters is the bytes an old iOS build
// and the web console actually receive. Two frozen facts are re-pinned on purpose: status 503 and
// `code: "duration_unavailable"`. `reason` is additive on top of them.
// ---------------------------------------------------------------------------------------------

const GENERIC_DURATION_COPY = '영상 길이를 확인하지 못했어요. 잠시 후 다시 시도해 주세요.';

describe('BUILD 21 — reason-specific duration-block copy', () => {
  it('too_long tells the Host to pick a shorter version — never "try again"', async () => {
    state.ensure = { outcome: 'duration_unavailable', durationFailureReason: 'too_long' };
    const res = await POST(makeReq({ requestId: 'req-1' }), ctx);
    expect(res.status).toBe(503);
    const raw = await res.text();
    const d = JSON.parse(raw);
    expect(d.code).toBe('duration_unavailable');
    expect(d.reason).toBe('too_long');
    expect(d.error).toContain('너무 길어요');
    expect(d.error).toContain('더 짧은 버전');
    expect(d.error).toContain('대기열에 그대로');
    // The whole point of BUILD 21: the false retry advice is gone from this branch.
    expect(d.error).not.toContain('잠시 후 다시 시도');
  });

  it('video_unavailable tells the Host to pick a different video', async () => {
    state.ensure = { outcome: 'duration_unavailable', durationFailureReason: 'video_unavailable' };
    const d = JSON.parse(await (await POST(makeReq({ requestId: 'req-1' }), ctx)).text());
    expect(d.reason).toBe('video_unavailable');
    expect(d.error).toContain('다른 영상');
    expect(d.error).not.toContain('잠시 후 다시 시도');
  });

  it('quota_exceeded names the daily limit and does NOT say "in a moment" (Gate G3)', async () => {
    state.ensure = { outcome: 'duration_unavailable', durationFailureReason: 'quota_exceeded' };
    const d = JSON.parse(await (await POST(makeReq({ requestId: 'req-1' }), ctx)).text());
    expect(d.reason).toBe('quota_exceeded');
    expect(d.error).toContain('일일');
    expect(d.error).not.toContain('잠시 후');
  });

  it('not_configured points at the operator, not the song', async () => {
    state.ensure = { outcome: 'duration_unavailable', durationFailureReason: 'not_configured' };
    const d = JSON.parse(await (await POST(makeReq({ requestId: 'req-1' }), ctx)).text());
    expect(d.reason).toBe('not_configured');
    expect(d.error).toContain('관리자');
  });

  it('lookup_failed KEEPS the shipped sentence — the one cause where retry is true', async () => {
    state.ensure = { outcome: 'duration_unavailable', durationFailureReason: 'lookup_failed' };
    const d = JSON.parse(await (await POST(makeReq({ requestId: 'req-1' }), ctx)).text());
    expect(d.reason).toBe('lookup_failed');
    expect(d.error).toBe(GENERIC_DURATION_COPY);
  });
});

describe('BUILD 21 — backward compatibility (no synchronized deploy required)', () => {
  it('an UNCLASSIFIED block is byte-identical to the shipped response — no `reason` key at all', async () => {
    state.ensure = { outcome: 'duration_unavailable' };
    const res = await POST(makeReq({ requestId: 'req-1' }), ctx);
    expect(res.status).toBe(503);
    const raw = await res.text();
    expect(JSON.parse(raw)).toEqual({ error: GENERIC_DURATION_COPY, code: 'duration_unavailable' });
    expect(raw).not.toContain('reason'); // absent, not undefined
  });

  it('an UNKNOWN future reason still serializes a usable generic sentence', async () => {
    state.ensure = { outcome: 'duration_unavailable', durationFailureReason: 'something_new' };
    const d = JSON.parse(await (await POST(makeReq({ requestId: 'req-1' }), ctx)).text());
    expect(d.code).toBe('duration_unavailable');
    expect(d.error).toBe(GENERIC_DURATION_COPY); // never blank, never "[object Object]"
    expect(d.reason).toBe('something_new');      // passed through for logs/newer clients
  });

  it('the frozen contract holds for EVERY reason: 503 + code, and no numbers are invented', async () => {
    for (const reason of ['too_long', 'video_unavailable', 'quota_exceeded', 'lookup_failed', 'not_configured']) {
      state.ensure = { outcome: 'duration_unavailable', durationFailureReason: reason };
      const res = await POST(makeReq({ requestId: 'req-1' }), ctx);
      expect(res.status).toBe(503);
      const d = await res.json();
      expect(d.code).toBe('duration_unavailable');
      expect(typeof d.error).toBe('string');
      expect(d.error.length).toBeGreaterThan(0);
      // An unknown duration must never be presented as a measured one.
      for (const numeric of ['durationSeconds', 'remainingSeconds', 'requiredChargeSeconds', 'leaseEndsAt']) {
        expect(numeric in d).toBe(false);
      }
    }
  });

  it('other blocked outcomes are untouched by BUILD 21', async () => {
    state.ensure = { outcome: 'pass_insufficient', durationSeconds: 242, remainingSeconds: 190 };
    const pass = await POST(makeReq({ requestId: 'req-1' }), ctx);
    expect(pass.status).toBe(402);
    expect('reason' in (await pass.json())).toBe(false);

    state.ensure = { outcome: 'upgrade_required', entitlement: ENT_ZERO };
    const upgrade = await POST(makeReq({ requestId: 'req-1' }), ctx);
    expect(upgrade.status).toBe(402);
    expect('reason' in (await upgrade.json())).toBe(false);
  });
});
