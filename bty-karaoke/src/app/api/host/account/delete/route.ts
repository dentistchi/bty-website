// BUILD 26E — POST /api/host/account/delete : permanent canonical account deletion.
//
// DELIBERATELY SEPARATE FROM `DELETE /api/host/me`, which means "revoke THIS session"
// and must keep meaning exactly that. Sign-out and account deletion are different
// promises to the user, and collapsing them into one verb on one path is how a logout
// becomes an accidental erasure.
//
// Authority rules (all enforced here, none delegated to the client):
//   * the canonical account is derived from the authenticated session via authorizeHost()
//     — the request body is NEVER consulted for identity. A body-supplied accountId is
//     ignored outright; there is no code path that reads one.
//   * a destructive confirmation phrase is required, so a stray POST cannot delete.
//   * a recent-auth window is required: deletion must be reachable only shortly after the
//     user proved they hold the account, not from a 90-day-old bearer token.
//   * cookie-authenticated (browser) callers must additionally pass CSRF; Bearer callers
//     (native) are not cookie-ambient and therefore are not CSRF-exposed.
//   * responses never reveal whether any other account exists, and never return provider
//     subjects, token material, or retained audit internals.

import { NextRequest, NextResponse } from 'next/server';
import { bearerFromHeader } from '@/lib/dj-auth.server';
import { authorizeHost } from '@/lib/host-auth.server';
import { hostTokenFromRequest, clearedHostCookie } from '@/lib/host-web-session.server';
import { verifyHostCsrf } from '@/lib/host-csrf.server';
import { DeleteAccountSchema } from '@/lib/validation';
import { deleteAccount, type DeletionSource } from '@/lib/account-deletion.server';
import { makeLimiter, isLockedOut, recordFailure } from '@/lib/rate-limit.server';
// A Route module may export ONLY its recognised fields, so these constants live in
// `domain` and are imported here. See src/domain/account-deletion.ts.
import {
  DELETE_CONFIRMATION,
  RECENT_AUTH_MAX_AGE_MS,
  REAUTH_FUTURE_SKEW_MS,
} from '@/domain/account-deletion';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' } as const;

function clientIp(req: NextRequest): string {
  return (
    req.headers.get('cf-connecting-ip') ??
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown'
  );
}

export async function POST(req: NextRequest) {
  const bearer = bearerFromHeader(req.headers.get('authorization'));
  const cookieToken = hostTokenFromRequest(req);
  const token = bearer ?? cookieToken;
  const source: DeletionSource = bearer ? 'host_native' : 'host_web';

  const account = await authorizeHost(token);
  if (!account) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
  }

  // Irreversible + authenticated → rate-limit per account, not per IP, so a shared NAT
  // cannot lock a Host out and a single credential cannot be hammered.
  const limiter = await makeLimiter('host-account-delete', `${account.id}:${clientIp(req)}`);
  if (limiter && (await isLockedOut(limiter))) {
    return NextResponse.json({ error: 'Too many attempts' }, { status: 429, headers: NO_STORE });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    if (limiter) await recordFailure(limiter);
    return NextResponse.json({ error: 'Invalid request' }, { status: 400, headers: NO_STORE });
  }

  const parsed = DeleteAccountSchema.safeParse(body);
  if (!parsed.success || parsed.data.confirmation !== DELETE_CONFIRMATION) {
    if (limiter) await recordFailure(limiter);
    return NextResponse.json(
      { error: 'confirmation_required' },
      { status: 400, headers: NO_STORE },
    );
  }

  // Cookie transport only: a Bearer token is not sent ambiently by a browser, so a
  // cross-site POST cannot carry it. Requiring CSRF of the native client would fail
  // closed for no gain (there is no browser origin to check).
  if (!bearer) {
    const csrf = await verifyHostCsrf(req, cookieToken, parsed.data.csrf ?? null);
    if (!csrf.ok) {
      if (limiter) await recordFailure(limiter);
      return NextResponse.json({ error: 'csrf_failed' }, { status: 403, headers: NO_STORE });
    }
  }

  // RECENT AUTH. The client asserts when it last proved identity to a provider; the
  // server bounds it. This is not a security boundary on its own — it is the
  // re-authentication requirement made checkable — so it is enforced in addition to,
  // never instead of, the session check above.
  const reauthAt = Date.parse(parsed.data.reauthenticatedAt);
  if (!Number.isFinite(reauthAt) || Date.now() - reauthAt > RECENT_AUTH_MAX_AGE_MS || reauthAt > Date.now() + REAUTH_FUTURE_SKEW_MS) {
    if (limiter) await recordFailure(limiter);
    return NextResponse.json({ error: 'reauth_required' }, { status: 401, headers: NO_STORE });
  }

  const result = await deleteAccount({
    accountId: account.id,
    source,
    appleAuthorizationCode: parsed.data.appleAuthorizationCode ?? null,
  });

  // ── DEPLOYMENT BLOCKER, not a user outcome ──
  // An Apple-linked account cannot be deleted by a deployment that lacks the revocation
  // secrets. Nothing was mutated: the account is still active, its identities intact, its
  // sessions and rooms untouched. Recording "revocation unavailable" in a permanent audit
  // instead would present a configuration mistake as something the user experienced.
  if (result.outcome === 'apple_revocation_not_configured') {
    return NextResponse.json(
      { error: 'apple_revocation_not_configured' },
      { status: 503, headers: NO_STORE },
    );
  }
  if (result.outcome === 'fingerprint_unavailable' || result.outcome === 'fingerprint_incomplete') {
    // FAIL CLOSED, having mutated nothing. Deleting a provider subject without being able
    // to retain its one-way fingerprint would silently reopen the FREE-window reset that
    // F-5 exists to close, so we refuse rather than delete more than we can account for.
    return NextResponse.json({ error: 'deletion_unavailable' }, { status: 503, headers: NO_STORE });
  }
  // The Apple re-auth failures. All are pre-mutation and none reveals whether any other
  // account exists — `apple_identity_mismatch` says only that the identity just proved is
  // not the one this session owns.
  if (result.outcome === 'apple_reauth_required') {
    return NextResponse.json({ error: 'apple_reauth_required' }, { status: 401, headers: NO_STORE });
  }
  if (result.outcome === 'apple_identity_mismatch') {
    return NextResponse.json({ error: 'apple_identity_mismatch' }, { status: 409, headers: NO_STORE });
  }
  if (result.outcome === 'apple_code_invalid') {
    return NextResponse.json({ error: 'apple_reauth_required' }, { status: 401, headers: NO_STORE });
  }
  if (result.outcome === 'account_not_found' || result.outcome === 'invalid_source') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
  }

  // `deleted` and `already_deleted` are the SAME success to the caller: a retried
  // deletion must be indistinguishable from the first, or a client that lost the
  // response would show a failure for an account that is already gone.
  //
  // A pending Apple revocation does NOT soften the result — deletion is final either way,
  // and the client still clears its credentials and lands signed out. The field exists so
  // the UI can show honest Apple-Settings guidance, never to imply the account survived.
  const res = NextResponse.json(
    {
      status: 'deleted',
      providerRevocation: {
        apple: result.providerRevocation.apple ?? 'not_linked',
        google: result.providerRevocation.google ?? 'not_linked',
      },
      storageCleanup: result.storagePending > 0 ? 'pending' : 'complete',
    },
    { headers: NO_STORE },
  );
  // The browser session cookie is now worthless (every session was revoked server-side),
  // but leaving it set would keep the client presenting a dead credential.
  res.cookies.set(clearedHostCookie(req));
  return res;
}
