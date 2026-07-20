// Host sign-in with Google (Cross-Platform Identity V1).
//
// POST { idToken, rawNonce?, displayName? } -> { sessionToken, expiresAt, account }
//
// Produces the SAME opaque Host session contract as Apple: a Google session grants
// exactly the same authorization powers, no more and no less. Provider type never
// appears in Room authorization — Apple and Google are authentication methods, not
// roles.
//
// The token is verified server-side against Google's public keys (RS256 pinned,
// issuer, exact client audience, expiry, nbf, subject, nonce). Failures collapse to
// a uniform 401. Nothing here creates a workspace, Room, or Event.

import { NextRequest, NextResponse } from 'next/server';
import { verifyGoogleIdToken } from '@/lib/google-auth.server';
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
  const limiter = await makeLimiter('host-google-login', clientIp(req));
  if (limiter && (await isLockedOut(limiter))) return fail();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    if (limiter) await recordFailure(limiter);
    return fail();
  }

  const { idToken, rawNonce, displayName } = (body ?? {}) as {
    idToken?: unknown;
    rawNonce?: unknown;
    displayName?: unknown;
  };
  if (typeof idToken !== 'string' || idToken.length === 0) {
    if (limiter) await recordFailure(limiter);
    return fail();
  }

  const verified = await verifyGoogleIdToken({
    idToken,
    rawNonce: typeof rawNonce === 'string' ? rawNonce : null,
  });
  if (!verified.ok) {
    // The specific code (including NOT_CONFIGURED) is never returned to the client.
    if (limiter) await recordFailure(limiter);
    return fail();
  }

  const account = await resolveAccountForIdentity({
    provider: 'google',
    subject: verified.subject,
    email: verified.email,
    displayName:
      typeof displayName === 'string' && displayName.trim() ? displayName.trim().slice(0, 80) : null,
  });

  const session = await createHostSession(account.id);
  if (limiter) await recordSuccess(limiter);

  return NextResponse.json(
    { ok: true, sessionToken: session.token, expiresAt: session.expiresAt, account: publicAccount(account) },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
