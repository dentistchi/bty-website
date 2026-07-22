// First-room onboarding endpoint (New Host Onboarding V1).
//
// POST (Host cookie + CSRF) /api/host/rooms   body: { name }
//   Authenticated Host → create THIS account's first Room atomically → mint the
//   account-bound Room credential → 303 into /r/{slug}/admin.
//
// The whole authorization + ownership chain is derived SERVER-SIDE:
//   Host web session → canonical account → create_karaoke_room(account, …) →
//   room + workspace + membership + ownership (atomic) → mint Room cookie.
// The request carries ONLY the display name (and a CSRF token). No owner id, no
// slug, and no redirect URL is ever accepted from the client. Creates ZERO Events.
//
// Duplicate-safe: an account that already owns a Room does not create a second one —
// the RPC returns the existing Room's slug + id and the Host is delivered INTO it,
// so a double tap / retry / back-and-resubmit all converge on the same single Room.
// This mirrors the admin-session bridge: same minting primitives, same 303-to-admin.

import { NextRequest, NextResponse } from 'next/server';
import { authorizeHost, createRoomForAccount } from '@/lib/host-auth.server';
import { hostTokenFromRequest } from '@/lib/host-web-session.server';
import { verifyHostCsrf, csrfFromForm } from '@/lib/host-csrf.server';
import { issueRoomWebSession, roomSessionCookie } from '@/lib/room-web-session.server';
import { CreateRoomSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' } as const;

/** Back to the onboarding surface (rendered at the root) with an error notice. */
const back = (req: NextRequest, notice: string) =>
  NextResponse.redirect(new URL(`/?notice=${notice}`, req.nextUrl.origin), 303);

export async function POST(req: NextRequest) {
  // 1. Identity FIRST. No session → the root shows the login entry (never a dead end).
  const hostToken = hostTokenFromRequest(req);
  const account = await authorizeHost(hostToken);
  if (!account) return NextResponse.redirect(new URL('/', req.nextUrl.origin), 303);

  // 2. CSRF: Origin + session-bound token. SameSite=Lax is a mitigation, not the check.
  const form = await req.formData().catch(() => null);
  const csrf = await verifyHostCsrf(req, hostToken, csrfFromForm(form));
  if (!csrf.ok) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 403, headers: NO_STORE });
  }

  // 3. Validate the ONLY accepted input: a trimmed, bounded display name. The
  //    idempotency key is a server-issued hidden field (empty for legacy forms).
  const parsed = CreateRoomSchema.safeParse({ name: form?.get('name') });
  if (!parsed.success) return back(req, 'bad_name');
  const idempotencyKey = (form?.get('idempotencyKey')?.toString() ?? '').trim();

  // 4. Atomic create. Routes by owned-Room count: 0 → the unchanged first-Room path
  //    (enter Admin; has_room makes it idempotent); ≥1 → the uncapped, idempotency-keyed
  //    additional-Room path. There is NO Room-count limit. The owner is the
  //    authenticated account — never anything from the request body.
  const result = await createRoomForAccount({
    accountId: account.id,
    displayName: parsed.data.name,
    idempotencyKey,
  });

  // 5a. Same key + a different payload → refuse (no new Room). Return to the hub.
  if (result.kind === 'idempotency_conflict') {
    return NextResponse.redirect(new URL('/?notice=room_conflict&view=rooms', req.nextUrl.origin), 303);
  }

  // 5b. Fail-closed (missing workspace / inconsistency) → no Room. Return to the hub.
  if (result.kind === 'blocked') {
    return NextResponse.redirect(new URL('/?notice=room_blocked&view=rooms', req.nextUrl.origin), 303);
  }

  // 5c. Additional Room created (or idempotent replay) → return into the chooser.
  //     Do NOT auto-enter Admin; the Host picks the Room from the hub.
  if (result.kind === 'added') {
    return NextResponse.redirect(new URL('/?view=rooms', req.nextUrl.origin), 303);
  }

  // 5c. First Room (created or idempotent re-entry) → unchanged behavior: mint the
  //     account-bound Room credential and 303 to /r/{slug}/admin.
  const raw = await issueRoomWebSession(result.roomId, account.id);
  const res = NextResponse.redirect(
    new URL(`/r/${encodeURIComponent(result.slug)}/admin`, req.nextUrl.origin),
    303,
  );
  res.cookies.set(roomSessionCookie(req, raw));
  return res;
}
