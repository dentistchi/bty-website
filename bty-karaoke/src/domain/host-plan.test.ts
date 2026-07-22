// Host Plan Foundation V1 — pure plan vocabulary + capability map.

import { describe, it, expect } from 'vitest';
import {
  PLAN_CODES,
  DEFAULT_PLAN_CODE,
  CAPABILITY_KEYS,
  isPlanCode,
  normalizePlanCode,
  isPlanSource,
  capabilitiesForPlan,
  decidePlanChange,
} from './host-plan';

describe('plan codes', () => {
  it('defines exactly FREE and PRO', () => {
    expect([...PLAN_CODES]).toEqual(['FREE', 'PRO']);
  });

  it('the default plan is FREE', () => {
    expect(DEFAULT_PLAN_CODE).toBe('FREE');
  });

  it('isPlanCode accepts only the two codes', () => {
    expect(isPlanCode('FREE')).toBe(true);
    expect(isPlanCode('PRO')).toBe(true);
    expect(isPlanCode('free')).toBe(false); // case-sensitive on the stored value
    expect(isPlanCode('ENTERPRISE')).toBe(false);
    expect(isPlanCode(null)).toBe(false);
    expect(isPlanCode(undefined)).toBe(false);
  });

  it('normalizePlanCode coerces anything invalid to FREE — never invents a paid plan', () => {
    expect(normalizePlanCode('PRO')).toBe('PRO');
    expect(normalizePlanCode('FREE')).toBe('FREE');
    expect(normalizePlanCode('ENTERPRISE')).toBe('FREE');
    expect(normalizePlanCode('')).toBe('FREE');
    expect(normalizePlanCode(null)).toBe('FREE');
    expect(normalizePlanCode(42)).toBe('FREE');
  });

  it('isPlanSource accepts only the three sources', () => {
    expect(isPlanSource('SYSTEM_DEFAULT')).toBe(true);
    expect(isPlanSource('MANUAL')).toBe(true);
    expect(isPlanSource('BILLING')).toBe(true);
    expect(isPlanSource('OTHER')).toBe(false);
    expect(isPlanSource(null)).toBe(false);
  });
});

describe('capabilitiesForPlan (V1: every current feature, every plan)', () => {
  it('FREE grants every current Host capability', () => {
    const caps = capabilitiesForPlan('FREE');
    for (const key of CAPABILITY_KEYS) expect(caps[key]).toBe(true);
  });

  it('PRO grants exactly the same set as FREE (no fabricated PRO-only capability)', () => {
    expect(capabilitiesForPlan('PRO')).toEqual(capabilitiesForPlan('FREE'));
  });

  it('exposes the six named capabilities and no others', () => {
    expect(Object.keys(capabilitiesForPlan('FREE')).sort()).toEqual(
      [
        'canCreateRoom',
        'canEditRoomSettings',
        'canManageQueue',
        'canStartEvent',
        'canUseGuestQR',
        'canUsePresetBranding',
      ].sort(),
    );
  });
});

describe('decidePlanChange (the pure no-op vs change rule)', () => {
  it('FREE → PRO is a real change', () => {
    expect(decidePlanChange('FREE', 'PRO')).toEqual({ kind: 'change', from: 'FREE', to: 'PRO' });
  });

  it('PRO → FREE is a real change (downgrade)', () => {
    expect(decidePlanChange('PRO', 'FREE')).toEqual({ kind: 'change', from: 'PRO', to: 'FREE' });
  });

  it('same-plan request is an idempotent no-op (FREE→FREE, PRO→PRO)', () => {
    expect(decidePlanChange('FREE', 'FREE')).toEqual({ kind: 'noop', plan: 'FREE' });
    expect(decidePlanChange('PRO', 'PRO')).toEqual({ kind: 'noop', plan: 'PRO' });
  });

  it('no current active assignment is always a real change (never a no-op)', () => {
    expect(decidePlanChange(null, 'FREE')).toEqual({ kind: 'change', from: null, to: 'FREE' });
    expect(decidePlanChange(null, 'PRO')).toEqual({ kind: 'change', from: null, to: 'PRO' });
  });
});
