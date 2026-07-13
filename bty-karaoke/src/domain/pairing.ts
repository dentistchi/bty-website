// Pure pairing/session logic for btyNorebang. No I/O, no DB, no crypto side
// effects — token minting/hashing lives in the server layer. Callers pass the
// current time in, so these stay deterministic and unit-testable.

/** A pairing token is valid for 5 minutes and may be redeemed exactly once. */
export const PAIRING_TTL_MS = 5 * 60 * 1000;

export interface PairingRow {
  expires_at: string; // ISO
  redeemed_at: string | null;
}

/** Expiry instant (ISO) for a token minted at `nowMs`. */
export function pairingExpiryIso(nowMs: number): string {
  return new Date(nowMs + PAIRING_TTL_MS).toISOString();
}

/**
 * A token may still be redeemed iff it has not been redeemed and has not
 * expired. The authoritative single-use guarantee is the atomic DB update; this
 * mirror is used for pre-checks and UI.
 */
export function isPairingRedeemable(row: PairingRow, nowMs: number): boolean {
  if (row.redeemed_at) return false;
  return Date.parse(row.expires_at) > nowMs;
}

/** Whole seconds left before a token expires (clamped at 0). For the countdown. */
export function pairingSecondsRemaining(expiresAtIso: string, nowMs: number): number {
  const ms = Date.parse(expiresAtIso) - nowMs;
  return ms <= 0 ? 0 : Math.floor(ms / 1000);
}

/** "4:52"-style mm:ss for a remaining-seconds value. */
export function formatCountdown(secondsRemaining: number): string {
  const s = Math.max(0, Math.floor(secondsRemaining));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

export type DeviceRole = 'dj' | 'admin';

/**
 * A friendly default label for a newly paired device, inferred from its
 * User-Agent. Never includes anything sensitive — just the device family.
 */
export function defaultDeviceLabel(userAgent: string | null | undefined, role: DeviceRole = 'dj'): string {
  const ua = (userAgent ?? '').toLowerCase();
  const suffix = role === 'admin' ? 'Admin' : 'DJ';
  if (ua.includes('ipad')) return `iPad ${suffix}`;
  if (ua.includes('iphone')) return `iPhone ${suffix}`;
  if (ua.includes('android')) return `Android ${suffix}`;
  if (ua.includes('macintosh') || ua.includes('mac os')) return `Mac ${suffix}`;
  if (ua.includes('windows')) return `Windows ${suffix}`;
  return role === 'admin' ? 'Admin device' : 'DJ device';
}
