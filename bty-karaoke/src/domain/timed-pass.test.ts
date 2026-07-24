// Timed Access Pass — pure vocabulary + effective-entitlement projection. Deterministic;
// no I/O. Pins §1.7 (PRO > TIMED_ACCESS > FREE), fixed durations, and selectability.

import { describe, it, expect } from 'vitest';
import {
  PASS_TYPES,
  PASS_DURATION_SECONDS,
  durationForPassType,
  isPassType,
  isSelectable,
  isRevocable,
  resolveEffectiveEntitlement,
  parseTimedPassState,
} from './timed-pass';

describe('fixed durations', () => {
  it('maps each pass type to its exact second budget', () => {
    expect(PASS_DURATION_SECONDS.ONE_HOUR).toBe(3600);
    expect(PASS_DURATION_SECONDS.FOUR_HOURS).toBe(14400);
    expect(PASS_DURATION_SECONDS.TWENTY_FOUR_HOURS).toBe(86400);
    for (const t of PASS_TYPES) expect(durationForPassType(t)).toBe(PASS_DURATION_SECONDS[t]);
  });

  it('rejects arbitrary pass types', () => {
    expect(isPassType('ONE_HOUR')).toBe(true);
    expect(isPassType('TWO_HOURS')).toBe(false);
    expect(isPassType(3600)).toBe(false);
  });
});

describe('selectability / revocability (§1.3)', () => {
  it('only AVAILABLE is selectable', () => {
    expect(isSelectable('AVAILABLE')).toBe(true);
    for (const s of ['SELECTED', 'ACTIVE', 'EXPIRED', 'REVOKED'] as const) expect(isSelectable(s)).toBe(false);
  });
  it('only AVAILABLE/SELECTED are revocable (never an ACTIVE pass in V1)', () => {
    expect(isRevocable('AVAILABLE')).toBe(true);
    expect(isRevocable('SELECTED')).toBe(true);
    for (const s of ['ACTIVE', 'EXPIRED', 'REVOKED'] as const) expect(isRevocable(s)).toBe(false);
  });
});

describe('resolveEffectiveEntitlement (§1.7)', () => {
  it('PRO base always wins — a pass never changes it', () => {
    expect(resolveEffectiveEntitlement('PRO', false)).toBe('PRO');
    expect(resolveEffectiveEntitlement('PRO', true)).toBe('PRO');
  });
  it('FREE base + valid ACTIVE pass = TIMED_ACCESS', () => {
    expect(resolveEffectiveEntitlement('FREE', true)).toBe('TIMED_ACCESS');
  });
  it('FREE base + no active pass = FREE', () => {
    expect(resolveEffectiveEntitlement('FREE', false)).toBe('FREE');
  });
});

describe('parseTimedPassState', () => {
  it('parses an ACTIVE TIMED_ACCESS state with server-truth remaining', () => {
    const state = parseTimedPassState({
      outcome: 'ok',
      basePlan: 'FREE',
      effectiveEntitlement: 'TIMED_ACCESS',
      activePass: {
        id: 'p1',
        passType: 'ONE_HOUR',
        durationSeconds: 3600,
        activatedAt: '2026-07-23T10:00:00Z',
        expiresAt: '2026-07-23T11:00:00Z',
        remainingSeconds: 1800,
      },
      selectedPass: null,
    });
    expect(state).not.toBeNull();
    expect(state!.effectiveEntitlement).toBe('TIMED_ACCESS');
    expect(state!.activePass?.remainingSeconds).toBe(1800);
    expect(state!.selectedPass).toBeNull();
  });

  it('SELECTED alone does NOT yield TIMED_ACCESS', () => {
    const state = parseTimedPassState({
      outcome: 'ok',
      basePlan: 'FREE',
      effectiveEntitlement: 'FREE',
      activePass: null,
      selectedPass: { id: 'p2', passType: 'FOUR_HOURS', durationSeconds: 14400, selectedAt: '2026-07-23T09:00:00Z' },
    });
    expect(state!.effectiveEntitlement).toBe('FREE');
    expect(state!.selectedPass?.passType).toBe('FOUR_HOURS');
    expect(state!.activePass).toBeNull();
  });

  it('clamps a negative remaining to 0 and never trusts a client clock', () => {
    const state = parseTimedPassState({
      outcome: 'ok',
      basePlan: 'FREE',
      effectiveEntitlement: 'TIMED_ACCESS',
      activePass: {
        id: 'p3', passType: 'ONE_HOUR', durationSeconds: 3600,
        activatedAt: '2026-07-23T10:00:00Z', expiresAt: '2026-07-23T11:00:00Z', remainingSeconds: -5,
      },
      selectedPass: null,
    });
    expect(state!.activePass?.remainingSeconds).toBe(0);
  });

  it('falls back to the pure rule when the server omits effectiveEntitlement', () => {
    const state = parseTimedPassState({
      outcome: 'ok',
      basePlan: 'FREE',
      activePass: {
        id: 'p4', passType: 'ONE_HOUR', durationSeconds: 3600,
        activatedAt: '2026-07-23T10:00:00Z', expiresAt: '2026-07-23T11:00:00Z', remainingSeconds: 10,
      },
      selectedPass: null,
    });
    expect(state!.effectiveEntitlement).toBe('TIMED_ACCESS');
  });

  it('returns null on a failed/absent outcome (fail safe)', () => {
    expect(parseTimedPassState({ outcome: 'account_not_found' })).toBeNull();
    expect(parseTimedPassState(null)).toBeNull();
    expect(parseTimedPassState('nope')).toBeNull();
  });
});
