// Server-only Admin PIN handling. The PIN gates enrollment ONLY — it is never a
// bearer credential. We store a self-describing, upgradeable KDF record:
//   pbkdf2_sha256$<iterations>$<salt_b64url>$<hash_b64url>
// so iterations/algorithm can be raised later with no schema change. A dummy
// verify path runs equivalent KDF work so missing-room / no-PIN states are not
// distinguishable by timing.

// Work factor. Cloudflare workerd HARD-CAPS PBKDF2 at 100_000 iterations
// (higher requests throw "iteration counts above 100000 are not supported"), so
// 100_000 is the platform maximum. Layered rate-limit + lockout + the
// high-entropy setup nonce cover the rest. The self-describing record means this
// can be raised later (with no schema change) if the platform cap ever lifts.
export const PBKDF2_ITERATIONS = 100_000;
export const PBKDF2_PREFIX = 'pbkdf2_sha256';

const enc = new TextEncoder();

function b64url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromB64url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  const bin = atob(b64);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a[i] ^ b[i];
  return r === 0;
}

async function pbkdf2(pin: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', enc.encode(pin), { name: 'PBKDF2' }, false, [
    'deriveBits',
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as unknown as ArrayBuffer, iterations },
    key,
    256,
  );
  return new Uint8Array(bits);
}

export type PinCheck = { ok: true; pin: string } | { ok: false };

/**
 * Explicit normalization (no silent trim). NFC first; REJECT any leading/trailing
 * whitespace; then all-digit PINs need ≥6, anything containing a non-digit
 * (passphrase) needs ≥8; max 128. Returns the exact NFC string to hash.
 */
export function normalizePin(raw: unknown): PinCheck {
  if (typeof raw !== 'string') return { ok: false };
  const nfc = raw.normalize('NFC');
  if (nfc !== nfc.trim()) return { ok: false }; // whitespace is rejected, not trimmed
  if (nfc.length === 0 || nfc.length > 128) return { ok: false };
  const allDigits = /^[0-9]+$/.test(nfc);
  if (allDigits ? nfc.length < 6 : nfc.length < 8) return { ok: false };
  return { ok: true, pin: nfc };
}

/** Hash an already-normalized PIN into the encoded record. */
export async function hashPin(pin: string, iterations = PBKDF2_ITERATIONS): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(pin, salt, iterations);
  return `${PBKDF2_PREFIX}$${iterations}$${b64url(salt)}$${b64url(hash)}`;
}

export interface PinVerifyResult {
  ok: boolean;
  /** True when the stored record used fewer iterations than the current target. */
  needsRehash: boolean;
}

/** Verify a PIN against an encoded record. Constant-time; parses the record's own params. */
export async function verifyPin(
  encoded: string | null | undefined,
  pin: string,
  target = PBKDF2_ITERATIONS,
): Promise<PinVerifyResult> {
  const parts = (encoded ?? '').split('$');
  if (parts.length !== 4 || parts[0] !== PBKDF2_PREFIX) {
    await dummyVerify(target);
    return { ok: false, needsRehash: false };
  }
  const iterations = Number.parseInt(parts[1], 10);
  if (!Number.isFinite(iterations) || iterations < 1 || iterations > 5_000_000) {
    await dummyVerify(target);
    return { ok: false, needsRehash: false };
  }
  let salt: Uint8Array;
  let expected: Uint8Array;
  try {
    salt = fromB64url(parts[2]);
    expected = fromB64url(parts[3]);
  } catch {
    await dummyVerify(target);
    return { ok: false, needsRehash: false };
  }
  const got = await pbkdf2(pin, salt, iterations);
  const ok = timingSafeEqual(got, expected);
  return { ok, needsRehash: ok && iterations < target };
}

/** Equivalent KDF work for the no-PIN / no-room path — keeps failure timing uniform. */
export async function dummyVerify(iterations = PBKDF2_ITERATIONS): Promise<void> {
  await pbkdf2('uniform-timing-dummy', new Uint8Array(16), iterations);
}
