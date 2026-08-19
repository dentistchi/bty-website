// BUILD R3 — the quota bands, exactly at their edges.
//
// These boundaries decide whether the Founder sees NORMAL or CRITICAL, so each one is asserted at
// the value itself, one below, and one above. An off-by-one here is not cosmetic: it is the
// difference between noticing a drain on the day it happens and noticing it the day after.

import { describe, it, expect } from 'vitest';
import {
  SEARCH_DAILY_LIMIT,
  pacificHourLabel,
  remainingCalls,
  usagePercent,
  usageStatus,
} from './youtube-usage';

describe('R3 — the approved allocation is 1,000 CALLS', () => {
  it('is 1000, and the old 100-units-per-call model appears nowhere', () => {
    expect(SEARCH_DAILY_LIMIT).toBe(1000);
    expect(usagePercent(42)).toBe(4.2);   // 42 calls = 4.2%, not 4200 units
    expect(usagePercent(1000)).toBe(100);
  });
});

describe('R3 — status bands', () => {
  it('69% is NORMAL and 70% is WATCH', () => {
    expect(usageStatus(0)).toBe('NORMAL');
    expect(usageStatus(69)).toBe('NORMAL');
    expect(usageStatus(69.9)).toBe('NORMAL');
    expect(usageStatus(70)).toBe('WATCH');
  });
  it('84% is WATCH and 85% is HIGH', () => {
    expect(usageStatus(84)).toBe('WATCH');
    expect(usageStatus(84.9)).toBe('WATCH');
    expect(usageStatus(85)).toBe('HIGH');
  });
  it('94% is HIGH and 95% is CRITICAL', () => {
    expect(usageStatus(94)).toBe('HIGH');
    expect(usageStatus(94.9)).toBe('HIGH');
    expect(usageStatus(95)).toBe('CRITICAL');
    expect(usageStatus(100)).toBe('CRITICAL');
    expect(usageStatus(120)).toBe('CRITICAL');
  });
  it('an unreadable number bands as NORMAL rather than a false emergency', () => {
    expect(usageStatus(Number.NaN)).toBe('NORMAL');
    expect(usageStatus(-5)).toBe('NORMAL');
  });
});

describe('R3 — remaining never goes negative', () => {
  it('reports 0 rather than a negative overshoot', () => {
    expect(remainingCalls(0)).toBe(1000);
    expect(remainingCalls(42)).toBe(958);
    expect(remainingCalls(1000)).toBe(0);
    expect(remainingCalls(1200)).toBe(0);
  });
});

describe('R3 — the peak hour is labelled in Pacific, never local', () => {
  it('converts a UTC hour bucket to Pacific time', () => {
    // 2026-08-18T23:00Z is 4 PM PDT on Aug 18 — the same quota day, not the next one.
    const label = pacificHourLabel('2026-08-18T23:00:00+00:00');
    expect(label).toMatch(/Aug 18/);
    expect(label).toMatch(/4\s?PM/i);
    expect(label).toMatch(/PT$/);
  });
  it('a UTC hour after midnight still belongs to the PREVIOUS Pacific day', () => {
    // 2026-08-19T01:00Z is 6 PM PDT on Aug 18 — bucketing this as Aug 19 is the classic error.
    expect(pacificHourLabel('2026-08-19T01:00:00+00:00')).toMatch(/Aug 18/);
  });
  it('returns null rather than inventing a label', () => {
    expect(pacificHourLabel(null)).toBeNull();
    expect(pacificHourLabel('')).toBeNull();
    expect(pacificHourLabel('not-a-date')).toBeNull();
  });
});
