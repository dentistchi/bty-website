// Host sign-in with Apple (Host Account V1).
//
// POST { identityToken, rawNonce?, displayName? } -> { sessionToken, expiresAt, account }
//
// The device's claim of identity is NEVER trusted: the identity token is verified
// server-side against Apple's published public keys (signature + issuer +
// audience + expiry + subject + nonce) before any account is touched. On success
// the ONE account for that Apple subject is resolved (created on first sign-in)
// and an opaque, hashed, revocable session token is minted.
//
// Failures are a UNIFORM 401 so the endpoint never reveals which check failed or
// whether an account already exists. Nothing here creates a workspace, a Room, or
// an Event — logging in is not a lifecycle action.

import { NextRequest, NextResponse } from 'next/server';
import { verifyAppleIdentityToken } from '@/lib/apple-auth.server';
import { resolveAccountForIdentity, createHostSession, publicAccount } from '@/lib/host-auth.server';
import { makeLimiter, isLockedOut, recordFailure, recordSuccess } from '@/lib/rate-limit.server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const fail = () => NextResponse.json({ error: 'Sign-in failed.' }, { status: 401 });

function clientIp(req: NextRequest): string {
  return (
    req.headers.get('cf-connecting-ip') ??
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown'
  );
}

export async function POST(req: NextRequest) {
  const limiter = await makeLimiter('host-apple-login', clientIp(req));
  if (limiter && (await isLockedOut(limiter))) return fail();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    if (limiter) await recordFailure(limiter);
    return fail();
  }

  const { identityToken, rawNonce, displayName } = (body ?? {}) as {
    identityToken?: unknown;
    rawNonce?: unknown;
    displayName?: unknown;
  };
  if (typeof identityToken !== 'string' || identityToken.length === 0) {
    if (limiter) await recordFailure(limiter);
    return fail();
  }

  // THE gate. Never decode-and-trust: this verifies Apple's RS256 signature
  // against Apple's JWKS, then the issuer / audience / expiry / subject / nonce.
  const verified = await verifyAppleIdentityToken({
    identityToken,
    rawNonce: typeof rawNonce === 'string' ? rawNonce : null,
  });
  if (!verified.ok) {
    // The specific code is deliberately NOT returned to the client.
    if (limiter) await recordFailure(limiter);
    return fail();
  }

  const account = await resolveAccountForIdentity({
    provider: 'apple',
    subject: verified.subject,
    email: verified.email,
    displayName: typeof displayName === 'string' && displayName.trim() ? displayName.trim().slice(0, 80) : null,
  });

  const session = await createHostSession(account.id);
  if (limiter) await recordSuccess(limiter);

  return NextResponse.json(
    {
      ok: true,
      sessionToken: session.token,
      expiresAt: session.expiresAt,
      account: publicAccount(account),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
