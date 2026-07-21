// Single-room auto-entry bridge (Simplify Browser Host Entry V1).
//
// GET /host/rooms/{slug}/enter
//   Host session cookie → account → ACTIVE membership → workspace owns {slug}
//   → mint the account-bound Room credential → 303 into /r/{slug}/admin.
//
// This is the auto-enter counterpart of the POST /api/host/rooms/{slug}/admin-session
// bridge, used when the root resolver finds the Host owns exactly one room. It
// REUSES the same minting primitives (issueRoomWebSession + roomSessionCookie) —
// no duplicated cookie logic. It never uses Manager auth, never creates/starts/ends
// an Event, and never alters Room ownership.
//
// CSRF posture: a GET is used because this is a top-level navigation landing, and
// the action is safe to trigger that way — it only ever mints a credential for the
// authenticated account's OWN room and delivers it solely to the requesting
// browser (worst case: the Host is logged into their own room). Any failure to
// authorize resolves to the root entry, never a Room-existence oracle.

import { NextRequest, NextResponse } from 'next/server';
import { authorizeHost, accountHasRoomAccess } from '@/lib/host-auth.server';
import { hostTokenFromRequest } from '@/lib/host-web-session.server';
import { issueRoomWebSession, roomSessionCookie } from '@/lib/room-web-session.server';
import { getPublicRoomBySlug } from '@/lib/rooms.server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const origin = req.nextUrl.origin;

  const account = await authorizeHost(hostTokenFromRequest(req));
  if (!account) return NextResponse.redirect(new URL('/', origin), 303);

  const room = await getPublicRoomBySlug(slug);
  // Unknown Room and unauthorized Room both fall back to the root entry — no signal
  // about which Rooms exist or who owns them, and no dead end.
  if (!room || !(await accountHasRoomAccess(account.id, room.id))) {
    return NextResponse.redirect(new URL('/', origin), 303);
  }

  const raw = await issueRoomWebSession(room.id, account.id);

  const res = NextResponse.redirect(new URL(`/r/${encodeURIComponent(room.slug)}/admin`, origin), 303);
  res.cookies.set(roomSessionCookie(req, raw));
  return res;
}
