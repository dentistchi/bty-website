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
import { authorizeHost, listHostRooms, publicAccount } from '@/lib/host-auth.server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' } as const;

export async function GET(req: NextRequest) {
  const account = await authorizeHost(bearerFromHeader(req.headers.get('authorization')));
  if (!account) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
  }

  const rooms = await listHostRooms(account.id);
  return NextResponse.json(
    { ok: true, account: publicAccount(account), rooms },
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
