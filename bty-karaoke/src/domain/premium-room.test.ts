// BUILD 26U-R1 — the pure Premium Room vocabulary.
//
// The one rule worth stating twice: an ARMED (SELECTED) pass is not entitlement. Every other
// assertion here exists to stop that distinction eroding.

import { describe, it, expect } from 'vitest';
import {
  parsePremiumRoomEntitlement,
  premiumRoomCapabilities,
  freeCapabilities,
  PREMIUM_ROOM_CAPABILITY_KEYS,
} from './premium-room';

const ok = (over: Record<string, unknown> = {}) => ({
  outcome: 'ok',
  entitled: false,
  source: 'NONE',
  basePlan: 'FREE',
  passGrantId: null,
  expiresAt: null,
  remainingSeconds: null,
  armable: false,
  ...over,
});

describe('parsePremiumRoomEntitlement', () => {
  it('reads a PRO account as entitled with no expiry', () => {
    const e = parsePremiumRoomEntitlement(ok({ entitled: true, source: 'PRO', basePlan: 'PRO' }));
    expect(e.entitled).toBe(true);
    expect(e.source).toBe('PRO');
    expect(e.expiresAt).toBeNull();
    expect(e.remainingSeconds).toBeNull();
  });

  it('reads a running ACTIVE pass as entitled, with its wall-clock remainder', () => {
    const e = parsePremiumRoomEntitlement(
      ok({ entitled: true, source: 'ACTIVE_PASS', passGrantId: 'g1', expiresAt: '2026-08-22T19:00:00Z', remainingSeconds: 1800 }),
    );
    expect(e.entitled).toBe(true);
    expect(e.remainingSeconds).toBe(1800);
  });

  it('an ARMED pass is NOT entitlement — it is only armable', () => {
    const e = parsePremiumRoomEntitlement(
      ok({ source: 'SELECTED_PASS', armable: true, passGrantId: 'g2', effectiveWindowSeconds: 3600 }),
    );
    expect(e.entitled).toBe(false); // <- the whole point
    expect(e.armable).toBe(true);
    expect(e.effectiveWindowSeconds).toBe(3600);
  });

  it('fails CLOSED on every unusable shape rather than returning null', () => {
    for (const bad of [null, undefined, 42, 'nope', {}, { outcome: 'ownership_state_invalid' }, { outcome: 'failed' }]) {
      const e = parsePremiumRoomEntitlement(bad);
      expect(e.entitled).toBe(false);
      expect(e.source).toBe('NONE');
      expect(e.armable).toBe(false);
    }
  });

  it('never infers entitlement from a truthy-looking value', () => {
    // `entitled` must be exactly true. A string, a 1, or a present-but-wrong field is refusal.
    for (const v of ['true', 1, 'yes', {}]) {
      expect(parsePremiumRoomEntitlement(ok({ entitled: v })).entitled).toBe(false);
    }
  });

  it('an unrecognised future source degrades to NONE, never to permission', () => {
    const e = parsePremiumRoomEntitlement(ok({ entitled: false, source: 'SOME_FUTURE_THING' }));
    expect(e.source).toBe('NONE');
  });

  it('clamps a negative remainder to zero rather than reporting negative time', () => {
    expect(parsePremiumRoomEntitlement(ok({ remainingSeconds: -30 })).remainingSeconds).toBe(0);
  });
});

describe('premiumRoomCapabilities — one fact, all keys', () => {
  it('grants every premium capability exactly when entitled', () => {
    const on = premiumRoomCapabilities(true);
    const off = premiumRoomCapabilities(false);
    for (const k of PREMIUM_ROOM_CAPABILITY_KEYS) {
      expect(on[k]).toBe(true);
      expect(off[k]).toBe(false);
    }
  });

  it('has no partially-premium state — the keys never disagree', () => {
    for (const entitled of [true, false]) {
      const values = new Set(Object.values(premiumRoomCapabilities(entitled)));
      expect(values.size).toBe(1);
    }
  });

  it('does NOT contain any YouTube capability — those are never withheld', () => {
    const keys = PREMIUM_ROOM_CAPABILITY_KEYS.join(' ').toLowerCase();
    expect(keys).not.toContain('youtube');
    expect(keys).not.toContain('search');
    expect(keys).not.toContain('play');
    expect(keys).not.toContain('watch');
    expect(keys).not.toContain('video');
  });
});

describe('freeCapabilities — YT-1 / YT-2 as a product fact', () => {
  it('is unconditional: search, seeing results and opening on YouTube are always true', () => {
    const f = freeCapabilities();
    expect(f.canSearchYouTube).toBe(true);
    expect(f.canSeeSearchResults).toBe(true);
    expect(f.canOpenOnYouTube).toBe(true);
  });

  it('takes NO arguments — the signature is the guarantee', () => {
    // A gate would need an input. There is nowhere to put one, so a future edit that wanted to
    // gate a free capability would have to change this arity, which is a reviewable event.
    expect(freeCapabilities.length).toBe(0);
  });

  it('every free capability is literally true, with no false among them', () => {
    expect(Object.values(freeCapabilities()).every((v) => v === true)).toBe(true);
  });
});
