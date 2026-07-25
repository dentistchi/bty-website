import { describe, it, expect } from 'vitest';
import {
  DEFAULT_HANDOFF_TTL_MS,
  HANDOFF_PATH_PREFIX,
  handoffExpiry,
  resolveHandoffState,
  countsAsOpen,
  extractHandoffToken,
} from './guest-handoff';

describe('handoffExpiry', () => {
  it('adds the default 24h TTL', () => {
    expect(handoffExpiry(1000)).toBe(1000 + DEFAULT_HANDOFF_TTL_MS);
    expect(DEFAULT_HANDOFF_TTL_MS).toBe(24 * 60 * 60 * 1000);
  });
  it('honors an explicit TTL', () => {
    expect(handoffExpiry(0, 5000)).toBe(5000);
  });
});

describe('resolveHandoffState (server-truth, no enumeration signal)', () => {
  const now = 1_000_000;
  const future = now + 10_000;
  const past = now - 10_000;

  it('no row / bad status → invalid', () => {
    expect(resolveHandoffState({ handoffStatus: null }, now)).toBe('invalid');
    expect(resolveHandoffState({ handoffStatus: 'WHATEVER' }, now)).toBe('invalid');
  });
  it('revoked → revoked (before expiry check)', () => {
    expect(resolveHandoffState({ handoffStatus: 'REVOKED', expiresAtMs: future, eventStatus: 'active' }, now)).toBe('revoked');
  });
  it('past expiry → expired even if row still reads ACTIVE (lazy expiry)', () => {
    expect(resolveHandoffState({ handoffStatus: 'ACTIVE', expiresAtMs: past, eventStatus: 'active' }, now)).toBe('expired');
  });
  it('EXPIRED status → expired', () => {
    expect(resolveHandoffState({ handoffStatus: 'EXPIRED', expiresAtMs: future, eventStatus: 'active' }, now)).toBe('expired');
  });
  it('valid token but event not active → event_ended', () => {
    expect(resolveHandoffState({ handoffStatus: 'ACTIVE', expiresAtMs: future, eventStatus: 'ended' }, now)).toBe('event_ended');
    expect(resolveHandoffState({ handoffStatus: 'ACTIVE', expiresAtMs: future, eventStatus: null }, now)).toBe('event_ended');
  });
  it('active token + active event → active', () => {
    expect(resolveHandoffState({ handoffStatus: 'ACTIVE', expiresAtMs: future, eventStatus: 'active' }, now)).toBe('active');
  });
});

describe('countsAsOpen', () => {
  it('counts genuine navigations only', () => {
    expect(countsAsOpen('active')).toBe(true);
    expect(countsAsOpen('event_ended')).toBe(true);
    expect(countsAsOpen('expired')).toBe(false);
    expect(countsAsOpen('revoked')).toBe(false);
    expect(countsAsOpen('invalid')).toBe(false);
  });
});

describe('extractHandoffToken (no open redirect / no arbitrary routing)', () => {
  it('accepts exactly /app/join/{token}', () => {
    expect(extractHandoffToken('/app/join/AbC-123_xyz')).toBe('AbC-123_xyz');
    expect(HANDOFF_PATH_PREFIX).toBe('/app/join/');
  });
  it('rejects wrong prefix', () => {
    expect(extractHandoffToken('/app/other/tok')).toBeNull();
    expect(extractHandoffToken('/r/joy')).toBeNull();
  });
  it('rejects empty, nested, or non-URL-safe tokens', () => {
    expect(extractHandoffToken('/app/join/')).toBeNull();
    expect(extractHandoffToken('/app/join/a/b')).toBeNull();
    expect(extractHandoffToken('/app/join/tok en')).toBeNull();
    expect(extractHandoffToken('/app/join/../etc')).toBeNull();
    expect(extractHandoffToken('/app/join/tok?x=1')).toBeNull();
  });
});
