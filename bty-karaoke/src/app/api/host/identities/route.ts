// Host login methods: list + deliberate identity linking (Cross-Platform Identity V1).
//
// GET  (Bearer host session) -> { identities: [{provider, createdAt}] }
// POST (Bearer host session) { provider, identityToken|idToken, rawNonce? }
//      -> { ok, outcome: 'linked' | 'already_linked' }
//
// Linking is how a Host who registered with Apple on iOS can then sign in with
// Google on Android and land on the SAME account, workspace and Room.
//
// Required properties (§8), all enforced here:
//   * the caller must hold a valid existing Host session (authenticated FIRST);
//   * the caller must FRESHLY authenticate with the provider being linked — we
//     verify a real provider token, never a claim;
//   * the (provider, subject) must not already belong to another account;
//   * linking is atomic (one insert guarded by a unique index) and idempotent;
//   * it NEVER matches on email, never changes workspace memberships, and never
//     creates or ends an Event;
//   * a failed link leaves no partial identity row.

import { NextRequest, NextResponse } from 'next/server';
import { bearerFromHeader } from '@/lib/dj-auth.server';
import { authorizeHost, linkIdentityToAccount, listAccountIdentities } from '@/lib/host-auth.server';
import { verifyAppleIdentityToken } from '@/lib/apple-auth.server';
import { verifyGoogleIdToken } from '@/lib/google-auth.server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' } as const;

export async function GET(req: NextRequest) {
  const account = await authorizeHost(bearerFromHeader(req.headers.get('authorization')));
  if (!account) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
  }
  const identities = await listAccountIdentities(account.id);
  return NextResponse.json({ ok: true, identities }, { headers: NO_STORE });
}

export async function POST(req: NextRequest) {
  const account = await authorizeHost(bearerFromHeader(req.headers.get('authorization')));
  if (!account) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400, headers: NO_STORE });
  }
  const { provider, identityToken, idToken, rawNonce } = (body ?? {}) as {
    provider?: unknown;
    identityToken?: unknown;
    idToken?: unknown;
    rawNonce?: unknown;
  };

  const token = typeof identityToken === 'string' ? identityToken : typeof idToken === 'string' ? idToken : null;
  const nonce = typeof rawNonce === 'string' ? rawNonce : null;
  if ((provider !== 'apple' && provider !== 'google') || !token) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400, headers: NO_STORE });
  }

  // FRESH provider proof — a session alone can never attach an identity.
  const verified =
    provider === 'apple'
      ? await verifyAppleIdentityToken({ identityToken: token, rawNonce: nonce })
      : await verifyGoogleIdToken({ idToken: token, rawNonce: nonce });

  if (!verified.ok) {
    return NextResponse.json(
      { error: 'That sign-in could not be verified.' },
      { status: 401, headers: NO_STORE },
    );
  }

  const result = await linkIdentityToAccount({
    accountId: account.id,
    provider,
    subject: verified.subject,
    email: verified.email,
  });

  if (result.outcome === 'owned_by_other') {
    // Honest and distinct: the token was valid, but that identity is already a
    // different person's account. It is never re-pointed.
    return NextResponse.json(
      { error: '이 로그인 방법은 이미 다른 계정에 연결되어 있어요.', code: 'IDENTITY_TAKEN' },
      { status: 409, headers: NO_STORE },
    );
  }

  return NextResponse.json({ ok: true, outcome: result.outcome }, { headers: NO_STORE });
}
