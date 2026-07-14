// Pure event-code / slug helpers for btyNorebang events. No I/O, no crypto side
// effects — the server passes random bytes in, so these stay deterministic and
// unit-testable. Collision handling (retry on a taken code) lives in the server.

// Human-readable short code alphabet. EXCLUDES the confusable glyphs 0 O 1 I L,
// so a code read off a screen can't be mistyped into a different valid code.
export const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
export const CODE_LENGTH = 6;

/**
 * Map random bytes to a `CODE_LENGTH` public code over `CODE_ALPHABET`, e.g.
 * "7K4M2P". Needs at least `CODE_LENGTH` bytes; the modulo bias across a 31-char
 * alphabet is negligible for a display code (entropy is not the security
 * boundary — the code only names an event; DJ/manager authority is separate).
 */
export function publicCodeFromBytes(bytes: Uint8Array): string {
  if (bytes.length < CODE_LENGTH) {
    throw new Error(`publicCodeFromBytes needs >= ${CODE_LENGTH} bytes`);
  }
  let out = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return out;
}

const SLUG_MAX_BASE = 32;

/**
 * ASCII-safe kebab base for an event name: NFKD-fold, keep [a-z0-9], collapse to
 * single dashes, cap length. Returns '' when nothing usable survives (e.g. a
 * purely Korean name) — the caller then uses the "event" fallback base.
 */
export function slugifyName(name: string): string {
  return name
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SLUG_MAX_BASE)
    .replace(/-+$/g, '');
}

/**
 * Build the guest-URL slug from a name + public code, e.g.
 *   "Friday Night" + "7K4M2P" -> "friday-night-7k4m2p"
 *   "금요일 밤"      + "7K4M2P" -> "event-7k4m2p"   (non-ASCII fallback)
 * The code is always appended so the slug is unique whenever the code is.
 */
export function buildGuestSlug(name: string, publicCode: string): string {
  const base = slugifyName(name) || 'event';
  return `${base}-${publicCode.toLowerCase()}`;
}

/** Internal room slug for an event's owned room. Never shown to guests. */
export function eventRoomSlug(publicCode: string): string {
  return `evt-${publicCode.toLowerCase()}`;
}
