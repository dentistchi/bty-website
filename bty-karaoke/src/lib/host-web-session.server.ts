// Browser Host session for the responsive /host entry.
//
// Deliberately NO migration: the existing `karaoke_host_sessions` table already
// stores an opaque token hash with expiry + revocation and references the canonical
// account. A browser session and a native session are the same kind of thing —
// distinguishing them in the schema would be a new invariant with no demonstrated
// need. Both are created by createHostSession() and resolved by authorizeHost().
//
// The difference is transport only:
//   native : raw token in the iOS Keychain, sent as `Authorization: Bearer`
//   web    : raw token in an HttpOnly cookie, never readable by JavaScript
//
// The raw token therefore never reaches browser-readable storage and never appears
// in a URL. Logout revokes server-side AND clears the cookie.

import { NextRequest, NextResponse } from 'next/server';
import { authorizeHost, revokeHostSession, type HostAccount } from './host-auth.server';

export const HOST_COOKIE = 'bty_host';

/** Mirrors the existing manager-cookie posture (the one HttpOnly precedent here). */
export function hostSessionCookie(req: NextRequest, value: string, maxAgeSeconds: number) {
  return {
    name: HOST_COOKIE,
    value,
    httpOnly: true,                                   // never readable by JS
    secure: req.nextUrl.protocol === 'https:',        // Secure in production
    // Lax: the OAuth callback is a top-level GET navigation (cookie sent), while
    // cross-site POSTs do NOT carry it — which is what protects state-changing
    // routes from CSRF.
    sameSite: 'lax' as const,
    path: '/',
    maxAge: maxAgeSeconds,
  };
}

/** Clearing form of the same cookie (identical attributes, zero lifetime). */
export function clearedHostCookie(req: NextRequest) {
  return { ...hostSessionCookie(req, '', 0), maxAge: 0 };
}

export function hostTokenFromRequest(req: NextRequest): string | null {
  return req.cookies.get(HOST_COOKIE)?.value ?? null;
}

/**
 * Resolve the browser's Host session to a canonical account. Same server-side
 * validation as the native path — the cookie is only a transport.
 */
export async function hostAccountFromRequest(req: NextRequest): Promise<HostAccount | null> {
  return authorizeHost(hostTokenFromRequest(req));
}

/** Log out: revoke server-side (so the token is dead everywhere) and clear the cookie. */
export async function signOutWebHost(req: NextRequest, res: NextResponse): Promise<void> {
  await revokeHostSession(hostTokenFromRequest(req));
  res.cookies.set(clearedHostCookie(req));
}
