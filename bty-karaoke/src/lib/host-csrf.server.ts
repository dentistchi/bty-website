// CSRF protection for cookie-authenticated Host web routes.
//
// SameSite=Lax alone is NOT treated as sufficient: it is a browser-behaviour
// mitigation, not a server-side check. Every state-changing Host route validates
// BOTH an Origin and a per-session token.
//
// The token is derived (not stored): HMAC(secret, "csrf:" + hostSessionToken).
// That binds it to exactly one Host session, so replacing or revoking the session
// invalidates every previously issued token automatically — no extra table, no
// rotation bookkeeping. The raw Host session token never leaves the server, so the
// derived value cannot be recomputed by a client.

import { NextRequest } from 'next/server';
import { timingSafeEqual } from './dj-auth.server';
import { optionalEnv } from './env.server';

const CSRF_FIELD = 'csrf';
/** Minimum entropy we will accept for the dedicated CSRF secret. */
const MIN_CSRF_SECRET_LEN = 32;

/**
 * DEDICATED CSRF secret — no cryptographic key reuse (Slice 2.1 §10). The Supabase
 * service-role key and the Manager passcode are NEVER used here: a signing key and
 * a database key must not be the same material. Returns null (fail closed) when the
 * dedicated secret is absent or too short, so state-changing Host routes reject.
 */
export function csrfSecret(): string | null {
  const s = optionalEnv('KARAOKE_HOST_CSRF_SECRET');
  if (!s || s.length < MIN_CSRF_SECRET_LEN) return null;
  return s;
}

export function csrfConfigured(): boolean {
  return csrfSecret() !== null;
}

/** Derive the CSRF token for a Host session. Never logged, never in a URL.
 *  Throws when the dedicated secret is missing — callers must fail closed. */
export async function csrfTokenFor(hostSessionToken: string): Promise<string> {
  const secretValue = csrfSecret();
  if (!secretValue) throw new Error('KARAOKE_HOST_CSRF_SECRET is not configured');
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secretValue),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`csrf:${hostSessionToken}`));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Page-render helper: the CSRF token, or null when the secret is unconfigured
 *  (so a page can render an honest disabled state instead of throwing). */
export async function csrfTokenOrNull(hostSessionToken: string): Promise<string | null> {
  if (!csrfConfigured()) return null;
  return csrfTokenFor(hostSessionToken);
}

/** Origins allowed to submit state-changing Host requests. */
export function allowedOrigins(req: NextRequest): string[] {
  const canonical = optionalEnv('KARAOKE_PUBLIC_ORIGIN')?.replace(/\/$/, '');
  return [canonical, req.nextUrl.origin, 'http://localhost:3002'].filter(Boolean) as string[];
}

export type CsrfResult = { ok: true } | { ok: false; reason: string };

/**
 * Validate a state-changing cookie-authenticated request.
 *   1. Origin must match an allowed origin. When absent, fall back to Referer's
 *      origin — and reject when neither is present, rather than assuming same-site.
 *   2. The submitted token must equal the session-derived token (constant time).
 */
export async function verifyHostCsrf(
  req: NextRequest,
  hostSessionToken: string | null,
  submitted: string | null,
): Promise<CsrfResult> {
  // Fail closed: with no dedicated secret configured, every state-changing Host
  // route is rejected rather than validated with reused key material.
  if (!csrfConfigured()) return { ok: false, reason: 'not_configured' };
  if (!hostSessionToken) return { ok: false, reason: 'no_session' };

  const origin = req.headers.get('origin');
  const referer = req.headers.get('referer');
  const allowed = allowedOrigins(req);

  let sourceOrigin: string | null = origin;
  if (!sourceOrigin && referer) {
    try { sourceOrigin = new URL(referer).origin; } catch { sourceOrigin = null; }
  }
  // Neither header → reject. A same-site browser form always sends one of them.
  if (!sourceOrigin) return { ok: false, reason: 'no_origin' };
  if (!allowed.includes(sourceOrigin)) return { ok: false, reason: 'bad_origin' };

  if (!submitted) return { ok: false, reason: 'missing_token' };
  const expected = await csrfTokenFor(hostSessionToken);
  if (!timingSafeEqual(submitted, expected)) return { ok: false, reason: 'bad_token' };
  return { ok: true };
}

/** Pull the token from a submitted form body. */
export function csrfFromForm(form: FormData | null): string | null {
  const v = form?.get(CSRF_FIELD);
  return typeof v === 'string' && v.length > 0 ? v : null;
}

export const CSRF_FIELD_NAME = CSRF_FIELD;
