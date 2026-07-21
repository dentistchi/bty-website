// Start Google login for the responsive Host web entry.
//
// GET /host/auth/google?returnTo=/host
//   -> mints state + PKCE verifier + nonce, stores them ONLY in a short-lived
//      HttpOnly transaction cookie, and redirects to Google.
//
// Fails CLOSED: with no configured web client the Host is sent back to /host with
// an honest notice — never a placeholder client id, never a broken redirect.

import { NextRequest, NextResponse } from 'next/server';
import {
  googleWebConfig, newOAuthTransaction, googleAuthorizeUrl, pkceChallenge,
  safeReturnTo, OAUTH_TX_COOKIE, OAUTH_TX_TTL_MS,
} from '@/lib/google-oauth.server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const returnTo = safeReturnTo(req.nextUrl.searchParams.get('returnTo'));

  const config = googleWebConfig(origin);
  if (!config) {
    // Honest, controlled state — no throw, no account, no Event.
    return NextResponse.redirect(new URL('/?notice=google_unconfigured', origin));
  }

  const tx = newOAuthTransaction(returnTo);
  const challenge = await pkceChallenge(tx.verifier);

  const res = NextResponse.redirect(googleAuthorizeUrl(config, tx, challenge));
  // The verifier/state/nonce live ONLY here — never in the URL we render.
  res.cookies.set({
    name: OAUTH_TX_COOKIE,
    value: JSON.stringify(tx),
    httpOnly: true,
    secure: req.nextUrl.protocol === 'https:',
    sameSite: 'lax',
    path: '/host',
    maxAge: Math.floor(OAUTH_TX_TTL_MS / 1000),
  });
  return res;
}
