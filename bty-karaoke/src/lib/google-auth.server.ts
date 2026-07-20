// Server-only verification of a Google ID token (Cross-Platform Identity V1).
//
// Identical posture to apple-auth.server.ts — the device's claim of identity is
// never trusted:
//   1. parse the JWS and require RS256 (never 'none', never a symmetric alg);
//   2. fetch Google's JWKS and select the key by `kid`;
//   3. verify the RSASSA-PKCS1-v1_5 / SHA-256 signature;
//   4. only then validate issuer / audience / expiry / nbf / subject / nonce.
//
// Verifying an ID token needs only Google's PUBLIC keys, so no Google client
// SECRET is stored in this deployment. The allowed audiences (the OAuth client IDs
// for iOS / Android / Web) come from configuration — an ID token minted for any
// other client must be refused, which is the check that stops a token obtained by
// an unrelated app from signing anyone in here.

import { optionalEnv } from './env.server';
import { sha256Hex } from './dj-auth.server';

const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
/** Google mints tokens under either form; both are legitimate. */
const GOOGLE_ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];

/**
 * Every OAuth client ID allowed to authenticate against this deployment (iOS,
 * Android, Web). Configured via KARAOKE_GOOGLE_CLIENT_IDS (comma-separated).
 * Empty = Google sign-in is NOT configured and every token is refused, rather than
 * silently accepting any audience.
 */
export function googleAudiences(): string[] {
  return (optionalEnv('KARAOKE_GOOGLE_CLIENT_IDS') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function googleEnabled(): boolean {
  return googleAudiences().length > 0;
}

interface GoogleJwk { kty: string; kid: string; alg?: string; n: string; e: string }

const JWKS_TTL_MS = 10 * 60 * 1000;
let jwksCache: { fetchedAt: number; keys: GoogleJwk[] } | null = null;

export function __resetGoogleKeyCache() { jwksCache = null; }

async function fetchGoogleKeys(force = false): Promise<GoogleJwk[]> {
  const fresh = jwksCache && Date.now() - jwksCache.fetchedAt < JWKS_TTL_MS;
  if (fresh && !force) return jwksCache!.keys;
  const res = await fetch(GOOGLE_JWKS_URL, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Google JWKS fetch failed: ${res.status}`);
  const body = (await res.json()) as { keys?: GoogleJwk[] };
  const keys = Array.isArray(body.keys) ? body.keys : [];
  if (keys.length === 0) throw new Error('Google JWKS returned no keys');
  jwksCache = { fetchedAt: Date.now(), keys };
  return keys;
}

function b64urlToBytes(input: string): Uint8Array<ArrayBuffer> {
  const pad = input.length % 4 === 0 ? '' : '='.repeat(4 - (input.length % 4));
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/') + pad;
  const bin = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function b64urlToJson<T>(input: string): T | null {
  try { return JSON.parse(new TextDecoder().decode(b64urlToBytes(input))) as T; } catch { return null; }
}

export type GoogleVerifyResult =
  | { ok: true; subject: string; email: string | null }
  | { ok: false; code: string; error: string };

export const GOOGLE_CLOCK_SKEW_SECONDS = 60;

/**
 * Verify a Google ID token end-to-end. Returns the stable `sub` on success. Every
 * failure carries a distinct code for server logs, but callers MUST collapse them
 * to one opaque client-facing error.
 */
export async function verifyGoogleIdToken(args: {
  idToken: string;
  rawNonce?: string | null;
  nowMs?: number;
  audiences?: string[];
}): Promise<GoogleVerifyResult> {
  const { idToken, rawNonce = null, nowMs = Date.now() } = args;
  const allowed = args.audiences ?? googleAudiences();

  if (allowed.length === 0) {
    return { ok: false, code: 'NOT_CONFIGURED', error: 'Google sign-in is not configured' };
  }
  if (typeof idToken !== 'string' || idToken.length === 0) {
    return { ok: false, code: 'NO_TOKEN', error: 'Missing id token' };
  }

  const parts = idToken.split('.');
  if (parts.length !== 3) return { ok: false, code: 'MALFORMED', error: 'Id token is malformed' };
  const [headerB64, payloadB64, signatureB64] = parts;

  const header = b64urlToJson<{ alg?: unknown; kid?: unknown }>(headerB64);
  if (!header) return { ok: false, code: 'MALFORMED', error: 'Id token header is unreadable' };
  if (header.alg !== 'RS256') {
    return { ok: false, code: 'BAD_ALG', error: 'Unsupported id token algorithm' };
  }
  const kid = typeof header.kid === 'string' ? header.kid : null;
  if (!kid) return { ok: false, code: 'NO_KID', error: 'Id token has no key id' };

  let keys = await fetchGoogleKeys();
  let jwk = keys.find((k) => k.kid === kid);
  if (!jwk) { keys = await fetchGoogleKeys(true); jwk = keys.find((k) => k.kid === kid); }
  if (!jwk) return { ok: false, code: 'UNKNOWN_KID', error: 'Id token key is not recognised' };

  let verified = false;
  try {
    const key = await crypto.subtle.importKey(
      'jwk',
      { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: 'RS256', ext: true },
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify'],
    );
    verified = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      key,
      b64urlToBytes(signatureB64),
      new TextEncoder().encode(`${headerB64}.${payloadB64}`),
    );
  } catch {
    return { ok: false, code: 'VERIFY_ERROR', error: 'Id token could not be verified' };
  }
  if (!verified) return { ok: false, code: 'BAD_SIGNATURE', error: 'Id token signature is invalid' };

  const claims = b64urlToJson<Record<string, unknown>>(payloadB64);
  if (!claims) return { ok: false, code: 'MALFORMED', error: 'Id token payload is unreadable' };

  const nowSeconds = Math.floor(nowMs / 1000);
  const str = (v: unknown) => (typeof v === 'string' && v.length > 0 ? v : null);
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

  const iss = str(claims.iss);
  if (!iss || !GOOGLE_ISSUERS.includes(iss)) {
    return { ok: false, code: 'BAD_ISSUER', error: 'Issuer is not Google' };
  }
  // EXACT audience match against the configured client IDs.
  const aud = str(claims.aud);
  if (!aud || !allowed.includes(aud)) {
    return { ok: false, code: 'BAD_AUDIENCE', error: 'Id token was not issued for this app' };
  }
  const exp = num(claims.exp);
  if (exp === null || exp + GOOGLE_CLOCK_SKEW_SECONDS <= nowSeconds) {
    return { ok: false, code: 'EXPIRED', error: 'Id token has expired' };
  }
  const iat = num(claims.iat);
  if (iat !== null && iat - GOOGLE_CLOCK_SKEW_SECONDS > nowSeconds) {
    return { ok: false, code: 'BAD_ISSUED_AT', error: 'Id token is not yet valid' };
  }
  const nbf = num(claims.nbf);
  if (nbf !== null && nbf - GOOGLE_CLOCK_SKEW_SECONDS > nowSeconds) {
    return { ok: false, code: 'NOT_BEFORE', error: 'Id token is not yet valid' };
  }
  const sub = str(claims.sub);
  if (!sub) return { ok: false, code: 'NO_SUBJECT', error: 'Id token has no subject' };

  // Nonce, when the client flow supplied one. Google echoes whatever was sent, so
  // we accept either the raw nonce or its SHA-256 (clients differ).
  if (rawNonce) {
    const got = str(claims.nonce);
    const hashed = await sha256Hex(rawNonce);
    if (!got || (got !== rawNonce && got !== hashed)) {
      return { ok: false, code: 'BAD_NONCE', error: 'Id token nonce does not match' };
    }
  }

  // NOTE: email is returned for display only. Authorization never uses it.
  return { ok: true, subject: sub, email: str(claims.email) };
}
