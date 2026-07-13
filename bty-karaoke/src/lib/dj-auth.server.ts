// Server-only DJ credential hashing/verification. The raw credential is NEVER
// stored or logged; Supabase holds only the SHA-256 hash (in the legacy
// karaoke_rooms.dj_secret column). Rotating that hash revokes all devices.

/** SHA-256 hex of the input (Web Crypto — available in Node 18+ and Workers). */
export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Constant-time string comparison (both operands are fixed-length hex here). */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

/** True iff the raw credential hashes to the stored hash. */
export async function credentialMatches(
  storedHash: string | null | undefined,
  rawCredential: string,
): Promise<boolean> {
  if (!storedHash || !rawCredential) return false;
  const hashed = await sha256Hex(rawCredential);
  return timingSafeEqual(hashed, storedHash);
}

/** Extract a bearer token from an Authorization header. */
export function bearerFromHeader(header: string | null): string | null {
  if (!header) return null;
  const m = /^Bearer\s+(.+)$/i.exec(header.trim());
  return m ? m[1].trim() : null;
}

/**
 * A high-entropy, URL-safe opaque token (base64url). Used for one-use pairing
 * tokens and durable device-session tokens. Web Crypto works in Node 18+ and the
 * Cloudflare Workers runtime. The RAW token is returned to exactly one caller and
 * is never persisted — only its SHA-256 hash is stored.
 */
export function randomToken(bytes = 24): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  let bin = '';
  for (const b of buf) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
