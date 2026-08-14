// The signed-in Host's own identity + accessible Rooms (Host Account V1).
//
// GET  (Bearer host session) -> { account, rooms: HostRoomCard[] }
// This is the ONE read that drives "My Norebang". It is strictly read-only:
// opening it must never create a workspace, a Room, or an Event.
//
// Room access is resolved from canonical relationships every time
// (session -> account -> ACTIVE membership -> workspace owns Room), never from
// anything the client submitted. There is no room/workspace id in the request at
// all, so there is nothing to tamper with.

import { NextRequest, NextResponse } from 'next/server';
import { bearerFromHeader } from '@/lib/dj-auth.server';
import {
  authorizeHost,
  listAccountIdentities,
  listHostRooms,
  publicAccount,
} from '@/lib/host-auth.server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' } as const;

export async function GET(req: NextRequest) {
  const account = await authorizeHost(bearerFromHeader(req.headers.get('authorization')));
  if (!account) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
  }

  const [rooms, identities] = await Promise.all([
    listHostRooms(account.id),
    listAccountIdentities(account.id),
  ]);

  // BUILD 26E — the minimum an account-management screen, and a future PRE-PURCHASE
  // confirmation, needs in order to show WHICH canonical account is being acted on.
  //
  // `linkedProviders` is provider NAMES only — never a provider subject and never a
  // provider email, because neither is an ownership key and both are personal data the
  // client has no use for. `serverNow` is the freshness marker: a purchase surface must
  // be able to prove this read is current rather than a cached profile, which is the
  // exact failure mode that would credit a purchase to a stale canonical account.
  // BUILD 26R-R2 — `purchaseOwnerRef` is the account's EXISTING
  // `karaoke_accounts.purchase_owner_ref` (BUILD 26E), the value Apple's `appAccountToken` must
  // equal for a payment to bind to this account. Nothing is generated, rotated or derived here:
  // this is a read of a durable column, scoped to the account the session already resolved to.
  //
  // It sits beside `account` rather than inside `publicAccount()` on purpose — see that helper.
  // The native client binds it into `Product.purchase(options: [.appAccountToken(…)])`, and the
  // verification route re-reads the SAME column server-side and compares, so this response is a
  // convenience for the client and never an authority the server will trust back.
  return NextResponse.json(
    {
      ok: true,
      account: publicAccount(account),
      purchaseOwnerRef: account.purchase_owner_ref,
      rooms,
      linkedProviders: identities.map((i) => i.provider).sort(),
      accountDeleted: account.deleted_at != null,
      ownedRoomCount: rooms.length,
      serverNow: new Date().toISOString(),
    },
    { headers: NO_STORE },
  );
}

// Sign out THIS session. Deliberately narrow: it revokes only the presented
// session token. It never ends an active Event, never deletes the Room, never
// deletes Event history, and never revokes the Host's other devices.
export async function DELETE(req: NextRequest) {
  const raw = bearerFromHeader(req.headers.get('authorization'));
  const { revokeHostSession } = await import('@/lib/host-auth.server');
  await revokeHostSession(raw);
  return NextResponse.json({ ok: true }, { headers: NO_STORE });
}
