// Mint an ACCOUNT-BOUND Room credential for the signed-in Host (Host Account V1).
//
// POST (Bearer host session) /api/host/rooms/{slug}/device -> { deviceToken, room }
//
// This is the bridge between the new account layer and the already-shipped Event
// lifecycle: after "My Norebang" resolves a Room the Host owns, the app exchanges
// its personal session for a Room-scoped device credential and then uses the
// existing, unchanged dj/* routes.
//
// The credential is SUBORDINATE, not equivalent, to the account:
//   * it is minted only after canonical relationships are re-resolved here
//     (session -> account -> ACTIVE membership -> workspace owns THIS Room);
//   * it is stamped with account_id, so authorizeDj/authorizeAdmin re-check that
//     account's membership on every subsequent call. Revoking membership kills the
//     device's access on the very next request — possession is never enough.
//
// Horizontal access is impossible by construction: the Room comes from the URL and
// is validated against the caller's memberships. No workspace/account/membership
// id is ever accepted from the client.

import { NextRequest, NextResponse } from 'next/server';
import { bearerFromHeader, randomToken } from '@/lib/dj-auth.server';
import { authorizeHost, accountHasRoomAccess } from '@/lib/host-auth.server';
import { getPublicRoomBySlug } from '@/lib/rooms.server';
import { createDeviceSession } from '@/lib/devices.server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' } as const;

export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;

  const account = await authorizeHost(bearerFromHeader(req.headers.get('authorization')));
  if (!account) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
  }

  const room = await getPublicRoomBySlug(slug);
  // Unknown Room and unauthorized Room are the SAME 404 so a signed-in Host
  // cannot enumerate Rooms belonging to other workspaces.
  if (!room || !(await accountHasRoomAccess(account.id, room.id))) {
    return NextResponse.json({ error: 'Room not found' }, { status: 404, headers: NO_STORE });
  }

  const rawToken = randomToken(32);
  await createDeviceSession({
    roomId: room.id,
    rawToken,
    role: 'admin',
    label: 'BTY Host iOS',
    accountId: account.id,
  });

  return NextResponse.json(
    {
      ok: true,
      deviceToken: rawToken,
      room: { slug: room.slug, displayName: room.display_name },
    },
    { headers: NO_STORE },
  );
}
