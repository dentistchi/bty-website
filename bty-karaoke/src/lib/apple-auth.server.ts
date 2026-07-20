// Server-only verification of an Apple identity token (Host Account V1).
//
// NON-NEGOTIABLE: the device's claim of identity is never trusted. The token is
// verified here, on the server, against Apple's published public keys:
//   1. parse the JWS and require RS256 (never 'none', never a symmetric alg —
//      an attacker-chosen alg is the classic JWT forgery);
//   2. fetch Apple's JWKS and select the key by `kid`;
//   3. verify the RSASSA-PKCS1-v1_5 / SHA-256 signature over header.payload;
//   4. only then validate the claims (issuer / audience / expiry / subject /
//      nonce) via the pure domain validator.
//
// No Apple SECRET is required for this: verifying an identity token needs only
// Apple's PUBLIC keys. We therefore store no Apple private key, no Services ID
// secret, and no client secret anywhere in this deployment.

import { validateAppleClaims, type AppleIdentityClaims } from '@/domain/apple-identity';
import { sha256Hex } from './dj-auth.server';
import { optionalEnv } from './env.server';

const APPLE_JWKS_URL = 'https://appleid.apple.com/auth/keys';

/** The audience Apple issues native tokens for: the iOS app's bundle id. */
export function appleAudience(): string {
  return optionalEnv('KARAOKE_APPLE_BUNDLE_ID') ?? 'com.bty.BTYNorebangAdmin';
}

interface AppleJwk {
  kty: string;
  kid: string;
  use?: string;
  alg?: string;
  n: string;
  e: string;
}

// Apple rotates keys rarely; cache briefly so a burst of sign-ins is one fetch,
// but never so long that a rotation locks users out for an extended period.
const JWKS_TTL_MS = 10 * 60 * 1000;
let jwksCache: { fetchedAt: number; keys: AppleJwk[] } | null = null;

async function fetchAppleKeys(forceRefresh = false): Promise<AppleJwk[]> {
  const fresh = jwksCache && Date.now() - jwksCache.fetchedAt < JWKS_TTL_MS;
  if (fresh && !forceRefresh) return jwksCache!.keys;

  const res = await fetch(APPLE_JWKS_URL, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Apple JWKS fetch failed: ${res.status}`);
  const body = (await res.json()) as { keys?: AppleJwk[] };
  const keys = Array.isArray(body.keys) ? body.keys : [];
  if (keys.length === 0) throw new Error('Apple JWKS returned no keys');
  jwksCache = { fetchedAt: Date.now(), keys };
  return keys;
}

/** Test seam: reset the module-level JWKS cache. */
export function __resetAppleKeyCache() {
  jwksCache = null;
}

// Allocate over an explicit ArrayBuffer so the result is a BufferSource WebCrypto
// accepts (a plain `new Uint8Array(n)` widens to ArrayBufferLike under strict TS).
function b64urlToBytes(input: string): Uint8Array<ArrayBuffer> {
  const pad = input.length % 4 === 0 ? '' : '='.repeat(4 - (input.length % 4));
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/') + pad;
  const bin = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function b64urlToJson<T>(input: string): T | null {
  try {
    return JSON.parse(new TextDecoder().decode(b64urlToBytes(input))) as T;
  } catch {
    return null;
  }
}

export type AppleVerifyResult =
  | { ok: true; subject: string; email: string | null }
  | { ok: false; code: string; error: string };

export interface VerifyAppleTokenArgs {
  identityToken: string;
  /** The raw nonce the device generated (it hashed it before sending to Apple). */
  rawNonce?: string | null;
  nowMs?: number;
  audience?: string;
}

/**
 * Verify an Apple identity token end-to-end. Returns the stable Apple subject on
 * success; every failure is a distinct code for logging but callers MUST collapse
 * them to one opaque client-facing error so the endpoint never reveals which part
 * of a token was wrong.
 */
export async function verifyAppleIdentityToken(
  args: VerifyAppleTokenArgs,
): Promise<AppleVerifyResult> {
  const { identityToken, rawNonce = null, nowMs = Date.now() } = args;
  const audience = args.audience ?? appleAudience();

  if (typeof identityToken !== 'string' || identityToken.length === 0) {
    return { ok: false, code: 'NO_TOKEN', error: 'Missing identity token' };
  }

  const parts = identityToken.split('.');
  if (parts.length !== 3) {
    return { ok: false, code: 'MALFORMED', error: 'Identity token is malformed' };
  }
  const [headerB64, payloadB64, signatureB64] = parts;

  const header = b64urlToJson<{ alg?: unknown; kid?: unknown }>(headerB64);
  if (!header) return { ok: false, code: 'MALFORMED', error: 'Identity token header is unreadable' };

  // Pin the algorithm. Accepting the token's own `alg` blindly is how 'none' and
  // HS256-with-public-key forgeries succeed.
  if (header.alg !== 'RS256') {
    return { ok: false, code: 'BAD_ALG', error: 'Unsupported identity token algorithm' };
  }
  const kid = typeof header.kid === 'string' ? header.kid : null;
  if (!kid) return { ok: false, code: 'NO_KID', error: 'Identity token has no key id' };

  // Select Apple's key. If the kid is unknown, refresh once — Apple may have
  // rotated since our cache was populated.
  let keys = await fetchAppleKeys();
  let jwk = keys.find((k) => k.kid === kid);
  if (!jwk) {
    keys = await fetchAppleKeys(true);
    jwk = keys.find((k) => k.kid === kid);
  }
  if (!jwk) return { ok: false, code: 'UNKNOWN_KID', error: 'Identity token key is not recognised' };

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
    return { ok: false, code: 'VERIFY_ERROR', error: 'Identity token could not be verified' };
  }
  if (!verified) {
    return { ok: false, code: 'BAD_SIGNATURE', error: 'Identity token signature is invalid' };
  }

  const claims = b64urlToJson<AppleIdentityClaims>(payloadB64);
  if (!claims) return { ok: false, code: 'MALFORMED', error: 'Identity token payload is unreadable' };

  // The device hashes its raw nonce before handing it to Apple, so Apple echoes
  // the HASH. Hash the raw nonce the client just gave us and compare.
  const expectedNonceHash = rawNonce ? await sha256Hex(rawNonce) : null;

  return validateAppleClaims({
    claims,
    expectedAudience: audience,
    expectedNonceHash,
    nowSeconds: Math.floor(nowMs / 1000),
  });
}
