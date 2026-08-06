// BUILD 26E — programmatic Sign in with Apple revocation authority (server-only).
//
// POLICY (Founder-authorized): programmatic revocation is the REQUIRED NORMAL PATH.
// Manual Apple-Settings revocation is a fallback for a real Apple refusal ONLY. Missing
// or malformed Worker secrets are a DEPLOYMENT BLOCKER: an Apple-linked deletion refuses
// to start rather than completing while recording that revocation was unavailable. A
// permanent audit must never present a configuration mistake as a user-level outcome.
//
// Nothing here is ever logged or returned: not the private key, the client secret, the
// authorization code, the identity token, the access token, or the refresh token. Errors
// carry short machine codes, never Apple response bodies.

import { optionalEnv } from './env.server';
import { verifyAppleIdentityToken } from './apple-auth.server';

const APPLE_TOKEN_URL = 'https://appleid.apple.com/auth/token';
const APPLE_REVOKE_URL = 'https://appleid.apple.com/auth/revoke';
const APPLE_AUDIENCE = 'https://appleid.apple.com';

/** Client secrets are single-use and short-lived; Apple permits up to 6 months, which is
 *  far more standing authority than one revocation needs. */
const CLIENT_SECRET_TTL_SECONDS = 300;

/** Bump when the encryption scheme or key changes; stored per job row. */
export const TOKEN_ENCRYPTION_KEY_VERSION = 'v1';

// ── 1. Configuration (the deployment blocker) ────────────────────────────────

export interface AppleRevocationConfig {
  privateKeyPem: string;
  keyId: string;
  teamId: string;
  /** The NATIVE Sign in with Apple client (the app's bundle id). */
  clientId: string;
  encryptionKey: string;
}

export type AppleConfigResult =
  | { ok: true; config: AppleRevocationConfig }
  | { ok: false; missing: string[] };

/**
 * Resolve and VALIDATE every Apple revocation secret.
 *
 * Validation is deliberately more than a presence check: a malformed key or a Services-ID
 * shaped client id would fail only at Apple, after the deletion had already committed. The
 * point of this function is that such a deployment cannot begin an Apple-linked deletion
 * at all.
 *
 * `clientId` MUST be the native client (the app bundle id, which is what the
 * authorization code was issued to). Silently falling back to a Services ID or web client
 * would make the token exchange fail with an opaque `invalid_client` at the worst moment.
 */
export function appleRevocationConfig(): AppleConfigResult {
  const missing: string[] = [];

  const privateKeyPem = optionalEnv('KARAOKE_APPLE_REVOCATION_PRIVATE_KEY');
  const keyId = optionalEnv('KARAOKE_APPLE_REVOCATION_KEY_ID');
  const teamId = optionalEnv('KARAOKE_APPLE_REVOCATION_TEAM_ID');
  const clientId = optionalEnv('KARAOKE_APPLE_REVOCATION_CLIENT_ID');
  const encryptionKey = optionalEnv('KARAOKE_APPLE_TOKEN_ENCRYPTION_KEY');

  // A .p8 is a PKCS#8 PEM. Anything else is a paste error, not a key.
  if (!privateKeyPem || !/-----BEGIN PRIVATE KEY-----/.test(privateKeyPem)) {
    missing.push('KARAOKE_APPLE_REVOCATION_PRIVATE_KEY');
  }
  // Apple Key IDs and Team IDs are 10-character alphanumerics.
  if (!keyId || !/^[A-Z0-9]{10}$/i.test(keyId.trim())) missing.push('KARAOKE_APPLE_REVOCATION_KEY_ID');
  if (!teamId || !/^[A-Z0-9]{10}$/i.test(teamId.trim())) missing.push('KARAOKE_APPLE_REVOCATION_TEAM_ID');
  // Reverse-DNS bundle id. Never blank, never a URL, never a Services-ID placeholder.
  if (!clientId || !/^[A-Za-z0-9.-]+\.[A-Za-z0-9.-]+$/.test(clientId.trim())) {
    missing.push('KARAOKE_APPLE_REVOCATION_CLIENT_ID');
  }
  // 32 bytes as 64 hex chars → AES-256.
  if (!encryptionKey || !/^[0-9a-f]{64}$/i.test(encryptionKey.trim())) {
    missing.push('KARAOKE_APPLE_TOKEN_ENCRYPTION_KEY');
  }

  if (missing.length > 0) return { ok: false, missing };
  return {
    ok: true,
    config: {
      privateKeyPem: privateKeyPem!,
      keyId: keyId!.trim(),
      teamId: teamId!.trim(),
      clientId: clientId!.trim(),
      encryptionKey: encryptionKey!.trim(),
    },
  };
}

/** Cheap predicate for route-level gating. Never reveals WHICH secret is absent. */
export function appleRevocationConfigured(): boolean {
  return appleRevocationConfig().ok;
}

// ── 2. Client secret (ES256 JWT) ─────────────────────────────────────────────

function b64url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlJson(obj: unknown): string {
  return b64url(new TextEncoder().encode(JSON.stringify(obj)));
}

/** Decode a PKCS#8 PEM body to DER bytes. */
function pemToPkcs8(pem: string): Uint8Array {
  const body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s+/g, '');
  const bin = atob(body);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/**
 * The Apple client secret: an ES256 JWT signed with the .p8 key.
 *
 *   iss = Team ID · sub = the NATIVE client id · aud = https://appleid.apple.com
 *   kid = Key ID  · short bounded expiry
 *
 * Generated per call and never persisted — it is a credential, not configuration.
 */
export async function appleClientSecret(
  config: AppleRevocationConfig,
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<string> {
  const header = { alg: 'ES256', kid: config.keyId, typ: 'JWT' };
  const payload = {
    iss: config.teamId,
    iat: nowSeconds,
    exp: nowSeconds + CLIENT_SECRET_TTL_SECONDS,
    aud: APPLE_AUDIENCE,
    sub: config.clientId,
  };
  const signingInput = `${b64urlJson(header)}.${b64urlJson(payload)}`;

  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToPkcs8(config.privateKeyPem).slice().buffer as ArrayBuffer,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    new TextEncoder().encode(signingInput),
  );
  return `${signingInput}.${b64url(new Uint8Array(sig))}`;
}

// ── 3. Authenticated encryption of the retained refresh token ────────────────

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}
function bytesToB64(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}
function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export interface EncryptedToken {
  ciphertext: string;
  nonce: string;
  keyVersion: string;
}

/**
 * AES-256-GCM. WebCrypto appends the 16-byte authentication tag to the ciphertext, so the
 * tag travels inside `ciphertext` and needs no separate column. A fresh 12-byte IV per
 * encryption — reusing one under the same key would be catastrophic for GCM.
 */
export async function encryptRefreshToken(
  plaintext: string,
  encryptionKeyHex: string,
): Promise<EncryptedToken> {
  const key = await crypto.subtle.importKey(
    'raw',
    hexToBytes(encryptionKeyHex).slice().buffer as ArrayBuffer,
    { name: 'AES-GCM' },
    false,
    ['encrypt'],
  );
  const iv = crypto.getRandomValues(new Uint8Array(new ArrayBuffer(12)));
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv.slice().buffer as ArrayBuffer },
    key,
    new TextEncoder().encode(plaintext),
  );
  return {
    ciphertext: bytesToB64(new Uint8Array(ct)),
    nonce: bytesToB64(iv),
    keyVersion: TOKEN_ENCRYPTION_KEY_VERSION,
  };
}

/** Returns null on any tamper/lost-key failure — never throws the reason outward. */
export async function decryptRefreshToken(
  enc: { ciphertext: string; nonce: string },
  encryptionKeyHex: string,
): Promise<string | null> {
  try {
    const key = await crypto.subtle.importKey(
      'raw',
      hexToBytes(encryptionKeyHex).slice().buffer as ArrayBuffer,
      { name: 'AES-GCM' },
      false,
      ['decrypt'],
    );
    const pt = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: b64ToBytes(enc.nonce).slice().buffer as ArrayBuffer },
      key,
      b64ToBytes(enc.ciphertext).slice().buffer as ArrayBuffer,
    );
    return new TextDecoder().decode(pt);
  } catch {
    return null;
  }
}

// ── 4. Token exchange ────────────────────────────────────────────────────────

export type AppleExchangeResult =
  | { ok: true; refreshToken: string; subject: string }
  | { ok: false; code: 'invalid_code' | 'identity_unverified' | 'subject_mismatch' | 'transient' };

export interface ExchangeArgs {
  authorizationCode: string;
  /** The provider subject the SESSION-derived canonical account actually owns. */
  expectedSubject: string;
  config: AppleRevocationConfig;
  fetchImpl?: typeof fetch;
}

/**
 * Exchange the NATIVE authorization code for Apple tokens, then prove the identity Apple
 * returned is the one this canonical account owns.
 *
 * THE MATCHING RULE: the subject is taken from the id_token Apple returns in the exchange
 * — verified against Apple's JWKS — and compared to `expectedSubject`, which the caller
 * read from `karaoke_account_identities` for the SESSION-derived account. A subject,
 * account id, or client id supplied by the request body is never consulted, so a caller
 * cannot aim a revocation at an identity they do not own.
 */
export async function exchangeAppleAuthorizationCode(
  args: ExchangeArgs,
): Promise<AppleExchangeResult> {
  const doFetch = args.fetchImpl ?? fetch;
  const secret = await appleClientSecret(args.config);

  let res: Response;
  try {
    res = await doFetch(APPLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: args.config.clientId,
        client_secret: secret,
        code: args.authorizationCode,
        grant_type: 'authorization_code',
      }).toString(),
    });
  } catch {
    return { ok: false, code: 'transient' };
  }

  if (res.status >= 500) return { ok: false, code: 'transient' };
  if (!res.ok) {
    // 4xx from Apple on an authorization code means the code is invalid, expired, or
    // already redeemed (replay). The body is deliberately not read into any message.
    return { ok: false, code: 'invalid_code' };
  }

  let body: { refresh_token?: unknown; id_token?: unknown };
  try {
    body = (await res.json()) as typeof body;
  } catch {
    return { ok: false, code: 'transient' };
  }

  const refreshToken = typeof body.refresh_token === 'string' ? body.refresh_token : null;
  const idToken = typeof body.id_token === 'string' ? body.id_token : null;
  if (!refreshToken || !idToken) return { ok: false, code: 'invalid_code' };

  // Never decode-and-trust: the id_token returned by the exchange is verified against
  // Apple's published keys exactly like a sign-in token. `rawNonce: null` because an
  // exchange-returned id_token carries no client nonce to bind.
  const verified = await verifyAppleIdentityToken({ identityToken: idToken, rawNonce: null });
  if (!verified.ok) return { ok: false, code: 'identity_unverified' };

  if (verified.subject !== args.expectedSubject) return { ok: false, code: 'subject_mismatch' };

  return { ok: true, refreshToken, subject: verified.subject };
}

// ── 5. Revocation ────────────────────────────────────────────────────────────

export type AppleRevokeOutcome =
  | { outcome: 'revoked' }
  /** Transient — retry later with the retained token. */
  | { outcome: 'retryable'; code: string }
  /** Apple permanently refused; the token can never work. Manual fallback is authorized. */
  | { outcome: 'permanent'; code: string };

/**
 * POST the refresh token to Apple's revoke endpoint.
 *
 * Apple answers 200 with an empty body on success. A 4xx means the token is unusable
 * (already revoked, malformed, wrong client) — permanent, because retrying cannot change
 * it. 5xx and transport failures are transient. Only a documented PERMANENT response
 * authorizes the manual fallback; a missing secret can never reach this function at all.
 */
export async function revokeAppleToken(args: {
  refreshToken: string;
  config: AppleRevocationConfig;
  fetchImpl?: typeof fetch;
}): Promise<AppleRevokeOutcome> {
  const doFetch = args.fetchImpl ?? fetch;
  const secret = await appleClientSecret(args.config);

  let res: Response;
  try {
    res = await doFetch(APPLE_REVOKE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: args.config.clientId,
        client_secret: secret,
        token: args.refreshToken,
        token_type_hint: 'refresh_token',
      }).toString(),
    });
  } catch {
    return { outcome: 'retryable', code: 'network' };
  }

  if (res.ok) return { outcome: 'revoked' };
  if (res.status === 429) return { outcome: 'retryable', code: 'rate_limited' };
  if (res.status >= 500) return { outcome: 'retryable', code: `http_${res.status}` };
  return { outcome: 'permanent', code: `http_${res.status}` };
}

/** Exponential backoff for a retryable revocation, bounded so it cannot run away. */
export function nextAttemptDelayMs(attemptCount: number): number {
  const base = 60_000;
  return Math.min(base * 2 ** Math.max(0, attemptCount - 1), 6 * 60 * 60 * 1000);
}
