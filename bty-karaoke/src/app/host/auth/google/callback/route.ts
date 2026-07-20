// Google OAuth callback for the responsive Host web entry.
//
// Validates the one-time transaction, exchanges the code with the PKCE verifier,
// then INDEPENDENTLY verifies the returned ID token (signature, issuer, exact
// audience, expiry, nonce) before trusting any identity. A successful exchange is
// not proof of identity on its own.
//
// Always ends in a redirect, so the authorization code leaves the address bar
// immediately. Creates NO Event and NO Room.

import { NextRequest, NextResponse } from 'next/server';
import {
  googleWebConfig, exchangeCodeForIdToken, transactionExpired, safeReturnTo,
  OAUTH_TX_COOKIE, type OAuthTransaction,
} from '@/lib/google-oauth.server';
import { verifyGoogleIdToken } from '@/lib/google-auth.server';
import { resolveAccountForIdentity, createHostSession, HOST_SESSION_TTL_MS } from '@/lib/host-auth.server';
import { hostSessionCookie } from '@/lib/host-web-session.server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Every failure path lands here: one opaque notice, transaction cookie cleared. */
function fail(req: NextRequest, notice: string) {
  const res = NextResponse.redirect(new URL(`/host?notice=${notice}`, req.nextUrl.origin));
  res.cookies.set({ name: OAUTH_TX_COOKIE, value: '', path: '/host', maxAge: 0 });
  return res;
}

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const config = googleWebConfig(origin);
  if (!config) return fail(req, 'google_unconfigured');

  // Google reports user-side denial via ?error=access_denied.
  if (req.nextUrl.searchParams.get('error')) return fail(req, 'cancelled');

  const code = req.nextUrl.searchParams.get('code');
  const state = req.nextUrl.searchParams.get('state');
  if (!code || !state) return fail(req, 'invalid_callback');

  // ONE-TIME transaction: read it, then clear it no matter what happens next, so a
  // replayed callback can never reuse the same state/verifier.
  const raw = req.cookies.get(OAUTH_TX_COOKIE)?.value;
  if (!raw) return fail(req, 'invalid_callback');
  let tx: OAuthTransaction;
  try {
    tx = JSON.parse(raw) as OAuthTransaction;
  } catch {
    return fail(req, 'invalid_callback');
  }
  if (transactionExpired(tx)) return fail(req, 'expired');
  // Constant-shape comparison of the CSRF state.
  if (typeof tx.state !== 'string' || tx.state.length === 0 || tx.state !== state) {
    return fail(req, 'state_mismatch');
  }

  const exchanged = await exchangeCodeForIdToken(config, code, tx.verifier);
  if (!exchanged.ok) return fail(req, 'exchange_failed');

  // THE gate — independent verification, with the nonce bound to this transaction.
  const verified = await verifyGoogleIdToken({ idToken: exchanged.idToken, rawNonce: tx.nonce });
  if (!verified.ok) return fail(req, 'verification_failed');

  // Canonical, provider-neutral resolution. Creates at most one account; never a
  // Room, never an Event, and never links by email.
  const account = await resolveAccountForIdentity({
    provider: 'google',
    subject: verified.subject,
    email: verified.email,
  });
  const session = await createHostSession(account.id);

  // Redirect FIRST so the code is gone from the URL, and set a fresh session
  // cookie (replacing any prior one) in the same response.
  const res = NextResponse.redirect(new URL(safeReturnTo(tx.returnTo), origin));
  res.cookies.set(hostSessionCookie(req, session.token, Math.floor(HOST_SESSION_TTL_MS / 1000)));
  res.cookies.set({ name: OAUTH_TX_COOKIE, value: '', path: '/host', maxAge: 0 });
  return res;
}
