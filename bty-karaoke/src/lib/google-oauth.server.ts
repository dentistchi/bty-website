// Google authorization-code flow for the responsive Host web entry.
//
// FAIL-CLOSED BY DESIGN: with no configured client id/secret this module reports
// `configured: false` and every route renders an honest "not configured" state.
// It never invents a client id, never falls back to a placeholder, and never
// weakens verification while configuration is missing.
//
// Flow (authorization code + PKCE):
//   /host/auth/google        -> mint state + PKCE verifier, store BOTH server-side
//                               in an HttpOnly transaction cookie, redirect to Google
//   /host/auth/google/callback -> validate state (one-time), exchange the code with
//                               the verifier, then verify the returned ID TOKEN with
//                               the existing hardened verifier before trusting anything
//
// The authorization code, verifier, state, nonce and tokens are never logged and
// never placed in a URL we render; the callback immediately redirects so the code
// leaves the browser address bar.

import { optionalEnv } from './env.server';

/** Scopes: identity only. No offline access, no refresh token — this product
 *  authenticates, it does not call Google APIs on the Host's behalf. */
export const GOOGLE_SCOPES = 'openid email profile';

const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';

export interface GoogleWebConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

/**
 * The canonical public origin. Measured, never guessed: set
 * KARAOKE_PUBLIC_ORIGIN in production. Falls back to the request origin so local
 * development on the measured dev port (3002) works without configuration.
 */
export function publicOrigin(requestOrigin: string): string {
  return optionalEnv('KARAOKE_PUBLIC_ORIGIN')?.replace(/\/$/, '') ?? requestOrigin;
}

/** The exact registered redirect URI. Must match Google's console entry byte-for-byte. */
export function googleRedirectUri(requestOrigin: string): string {
  return (
    optionalEnv('KARAOKE_GOOGLE_REDIRECT_URI') ??
    `${publicOrigin(requestOrigin)}/host/auth/google/callback`
  );
}

/** Web OAuth configuration, or null when it is not fully configured. */
export function googleWebConfig(requestOrigin: string): GoogleWebConfig | null {
  const clientId = optionalEnv('KARAOKE_GOOGLE_WEB_CLIENT_ID');
  const clientSecret = optionalEnv('KARAOKE_GOOGLE_WEB_CLIENT_SECRET');
  if (!clientId || !clientSecret) return null; // fail closed
  return { clientId, clientSecret, redirectUri: googleRedirectUri(requestOrigin) };
}

export function googleWebConfigured(): boolean {
  return Boolean(
    optionalEnv('KARAOKE_GOOGLE_WEB_CLIENT_ID') && optionalEnv('KARAOKE_GOOGLE_WEB_CLIENT_SECRET'),
  );
}

// ---------------------------------------------------------------- PKCE + state

function b64url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function randomUrlSafe(byteLength = 32): string {
  return b64url(crypto.getRandomValues(new Uint8Array(byteLength)));
}

export async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return b64url(new Uint8Array(digest));
}

/** One OAuth attempt's secrets. Held ONLY in an HttpOnly cookie, never in a URL. */
export interface OAuthTransaction {
  state: string;
  verifier: string;
  nonce: string;
  /** Internal path to return to after login. Allowlisted — never an open redirect. */
  returnTo: string;
  createdAt: number;
}

export const OAUTH_TX_COOKIE = 'bty_host_oauth';
/** Bounded: a login attempt is short-lived. */
export const OAUTH_TX_TTL_MS = 10 * 60 * 1000;

export function newOAuthTransaction(returnTo: string): OAuthTransaction {
  return {
    state: randomUrlSafe(32),
    verifier: randomUrlSafe(64),
    nonce: randomUrlSafe(32),
    returnTo: safeReturnTo(returnTo),
    createdAt: Date.now(),
  };
}

/**
 * Open-redirect prevention: only same-site absolute PATHS under /host are allowed.
 * Anything else (scheme, host, protocol-relative `//evil`, backslash tricks) is
 * replaced with the default.
 */
export function safeReturnTo(candidate: string | null | undefined): string {
  const fallback = '/host';
  if (!candidate) return fallback;
  const value = candidate.trim();
  if (!value.startsWith('/')) return fallback;      // no scheme/host
  if (value.startsWith('//') || value.startsWith('/\\')) return fallback; // protocol-relative
  if (!value.startsWith('/host')) return fallback;  // keep the blast radius tiny
  if (value.includes('\\') || value.includes('\n') || value.includes('\r')) return fallback;
  return value;
}

export function transactionExpired(tx: OAuthTransaction, nowMs = Date.now()): boolean {
  return nowMs - tx.createdAt > OAUTH_TX_TTL_MS;
}

/** Build Google's consent URL. `state` and the PKCE challenge travel in the URL;
 *  the VERIFIER never does. */
export function googleAuthorizeUrl(config: GoogleWebConfig, tx: OAuthTransaction, challenge: string): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: GOOGLE_SCOPES,
    state: tx.state,
    nonce: tx.nonce,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    // Identity only: no offline access, so Google issues no refresh token.
    prompt: 'select_account',
  });
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

export type CodeExchangeResult =
  | { ok: true; idToken: string }
  | { ok: false; code: string; error: string };

/**
 * Exchange the authorization code for tokens. We keep ONLY the ID token, which is
 * then independently verified (signature + issuer + audience + expiry + nonce) by
 * the existing hardened verifier — the exchange succeeding is NOT proof of identity.
 * The access token is discarded; no refresh token is requested or stored.
 */
export async function exchangeCodeForIdToken(
  config: GoogleWebConfig,
  code: string,
  verifier: string,
): Promise<CodeExchangeResult> {
  let res: Response;
  try {
    res = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code,
        code_verifier: verifier,
        grant_type: 'authorization_code',
        redirect_uri: config.redirectUri,
      }).toString(),
    });
  } catch {
    return { ok: false, code: 'NETWORK', error: 'Could not reach Google' };
  }

  if (!res.ok) {
    // Google's error body can echo the code — never log or surface it.
    return { ok: false, code: 'EXCHANGE_FAILED', error: 'Authorization code exchange failed' };
  }
  const body = (await res.json().catch(() => null)) as { id_token?: unknown } | null;
  const idToken = typeof body?.id_token === 'string' ? body.id_token : null;
  if (!idToken) return { ok: false, code: 'NO_ID_TOKEN', error: 'Google returned no id token' };
  return { ok: true, idToken };
}
