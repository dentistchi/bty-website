// BUILD 26U-R1 — the Premium Room route guard, exercised against a fake authority.
//
// This is the file the route tests point at when they stub the guard: the guard's own refusal
// and expiry behaviour is proven ONCE, here, rather than restated in every route.
//
// The property that matters most is the one in R1-F: when time runs out, the SESSION ends and
// the media does not. That is asserted by what the guard calls (`endEvent`, the proven canonical
// close) and by what it must never call.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const state = {
  entitlement: { outcome: 'ok', entitled: true, source: 'ACTIVE_PASS', basePlan: 'FREE',
                 passGrantId: 'g1', expiresAt: '2026-08-22T19:00:00Z', remainingSeconds: 1800,
                 armable: false } as Record<string, unknown>,
  live: null as { id: string } | null,
  ended: [] as string[],
};

vi.mock('@/lib/supabase.server', () => ({
  karaokeDb: () => ({
    rpc: (name: string) => {
      if (name === 'karaoke_room_premium_entitlement_at') {
        return Promise.resolve({ data: state.entitlement, error: null });
      }
      return Promise.resolve({ data: null, error: { message: `unknown rpc ${name}` } });
    },
  }),
}));

vi.mock('./events.server', () => ({
  getCanonicalEvent: vi.fn(async () => state.live),
  endEvent: vi.fn(async (id: string) => {
    state.ended.push(id);
    state.live = null;
    return { event: { id, status: 'ended' }, summary: { completedCount: 0, unfinishedClosedCount: 1 } };
  }),
}));

import { assertPremiumRoomSession } from './premium-room-guard.server';
import { endEvent } from './events.server';

const ROOM = { id: 'room-A' };

beforeEach(() => {
  state.entitlement = { outcome: 'ok', entitled: true, source: 'ACTIVE_PASS', basePlan: 'FREE',
                        passGrantId: 'g1', expiresAt: '2026-08-22T19:00:00Z',
                        remainingSeconds: 1800, armable: false };
  state.live = { id: 'evt-1' };
  state.ended = [];
  vi.clearAllMocks();
});

describe('assertPremiumRoomSession — entitled', () => {
  it('passes and ends nothing', async () => {
    const r = await assertPremiumRoomSession(ROOM);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.entitlement.remainingSeconds).toBe(1800);
    expect(endEvent).not.toHaveBeenCalled();
    expect(state.live).toEqual({ id: 'evt-1' });
  });

  it('a PRO account passes with no expiry', async () => {
    state.entitlement = { outcome: 'ok', entitled: true, source: 'PRO', basePlan: 'PRO',
                          passGrantId: null, expiresAt: null, remainingSeconds: null, armable: false };
    const r = await assertPremiumRoomSession(ROOM);
    expect(r.ok).toBe(true);
    expect(endEvent).not.toHaveBeenCalled();
  });
});

describe('assertPremiumRoomSession — time has run out (R1-F)', () => {
  beforeEach(() => {
    state.entitlement = { outcome: 'ok', entitled: false, source: 'NONE', basePlan: 'FREE',
                          passGrantId: null, expiresAt: null, remainingSeconds: null, armable: false };
  });

  it('ENDS the live hosted session and reports PREMIUM_ROOM_EXPIRED', async () => {
    const r = await assertPremiumRoomSession(ROOM);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe('PREMIUM_ROOM_EXPIRED');
      expect(r.endedEventId).toBe('evt-1');
    }
    expect(endEvent).toHaveBeenCalledWith('evt-1');
    expect(state.ended).toEqual(['evt-1']);
  });

  it('ends it through the CANONICAL endEvent — which does not stop playing media', async () => {
    // The guarantee lives in `end_karaoke_event` (WAITING→removed, PLAYING→skipped, event→ended,
    // "current media is NOT stopped"). What this asserts is that the guard reuses it rather than
    // inventing a second teardown that could forget that rule.
    await assertPremiumRoomSession(ROOM);
    expect(endEvent).toHaveBeenCalledTimes(1);
  });

  it('is idempotent — a second guard call after the end does not end again', async () => {
    await assertPremiumRoomSession(ROOM);
    vi.clearAllMocks();
    const r = await assertPremiumRoomSession(ROOM);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('PREMIUM_ROOM_REQUIRED'); // nothing left to end
    expect(endEvent).not.toHaveBeenCalled();
  });

  it('with NO live session it simply refuses — PREMIUM_ROOM_REQUIRED, no write', async () => {
    state.live = null;
    const r = await assertPremiumRoomSession(ROOM);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe('PREMIUM_ROOM_REQUIRED');
      expect(r.endedEventId).toBeNull();
    }
    expect(endEvent).not.toHaveBeenCalled();
  });
});

describe('assertPremiumRoomSession — fails CLOSED', () => {
  it('an ARMED pass is not entitlement: the guard still refuses', async () => {
    // Selecting a pass must never keep a session alive. Only ACTIVATING it does, and activation
    // happens in the session-start transaction, not here.
    state.entitlement = { outcome: 'ok', entitled: false, source: 'SELECTED_PASS', basePlan: 'FREE',
                          passGrantId: 'g2', expiresAt: null, remainingSeconds: null, armable: true,
                          effectiveWindowSeconds: 3600 };
    const r = await assertPremiumRoomSession(ROOM);
    expect(r.ok).toBe(false);
  });

  it('an ownership fault refuses rather than defaulting to permission', async () => {
    state.entitlement = { outcome: 'ownership_state_invalid', entitled: false, source: 'NONE' };
    const r = await assertPremiumRoomSession(ROOM);
    expect(r.ok).toBe(false);
  });

  it('a malformed authority answer refuses', async () => {
    for (const bad of [null, {}, { outcome: 'ok', entitled: 'true' }]) {
      state.entitlement = bad as Record<string, unknown>;
      state.live = { id: 'evt-1' };
      const r = await assertPremiumRoomSession(ROOM);
      expect(r.ok).toBe(false);
    }
  });
});
