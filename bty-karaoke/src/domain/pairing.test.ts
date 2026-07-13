import { describe, it, expect } from 'vitest';
import {
  PAIRING_TTL_MS,
  pairingExpiryIso,
  isPairingRedeemable,
  pairingSecondsRemaining,
  formatCountdown,
  defaultDeviceLabel,
} from './pairing';

const NOW = Date.parse('2026-07-13T20:00:00.000Z');

describe('pairingExpiryIso', () => {
  it('is exactly 5 minutes after mint', () => {
    expect(pairingExpiryIso(NOW)).toBe(new Date(NOW + PAIRING_TTL_MS).toISOString());
  });
});

describe('isPairingRedeemable', () => {
  const fresh = { expires_at: pairingExpiryIso(NOW), redeemed_at: null };

  it('accepts a fresh, unredeemed token', () => {
    expect(isPairingRedeemable(fresh, NOW)).toBe(true);
  });

  it('rejects an already-redeemed token', () => {
    expect(isPairingRedeemable({ ...fresh, redeemed_at: new Date(NOW).toISOString() }, NOW)).toBe(false);
  });

  it('rejects an expired token', () => {
    expect(isPairingRedeemable(fresh, NOW + PAIRING_TTL_MS + 1)).toBe(false);
  });

  it('rejects exactly at expiry (not strictly greater)', () => {
    expect(isPairingRedeemable(fresh, NOW + PAIRING_TTL_MS)).toBe(false);
  });
});

describe('pairingSecondsRemaining', () => {
  it('counts down whole seconds', () => {
    const exp = pairingExpiryIso(NOW);
    expect(pairingSecondsRemaining(exp, NOW)).toBe(300);
    expect(pairingSecondsRemaining(exp, NOW + 8000)).toBe(292);
  });

  it('clamps to 0 once expired', () => {
    expect(pairingSecondsRemaining(pairingExpiryIso(NOW), NOW + 999_999)).toBe(0);
  });
});

describe('formatCountdown', () => {
  it('formats mm:ss with zero-padding', () => {
    expect(formatCountdown(292)).toBe('4:52');
    expect(formatCountdown(300)).toBe('5:00');
    expect(formatCountdown(9)).toBe('0:09');
    expect(formatCountdown(0)).toBe('0:00');
    expect(formatCountdown(-5)).toBe('0:00');
  });
});

describe('defaultDeviceLabel', () => {
  it('recognises an iPad as the DJ device', () => {
    expect(defaultDeviceLabel('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)')).toBe('iPad DJ');
  });

  it('recognises an iPhone for the admin role', () => {
    expect(defaultDeviceLabel('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)', 'admin')).toBe('iPhone Admin');
  });

  it('falls back gracefully with no UA', () => {
    expect(defaultDeviceLabel(null)).toBe('DJ device');
    expect(defaultDeviceLabel(undefined, 'admin')).toBe('Admin device');
  });
});
