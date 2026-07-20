// Issue a short-lived, account-bound Room web session (Room Web Auth Bridge).
//
// POST (Host cookie + CSRF) /api/host/rooms/{slug}/admin-session
//   -> sets an HttpOnly Room cookie and redirects into the existing Admin page.
//
// The full authorization sequence is derived SERVER-SIDE; the browser submits only
// the slug in the URL and a CSRF token:
//   Host web session -> canonical account -> ACTIVE membership -> workspace owns
//   {slug} -> mint Room credential.
// No account/workspace/membership/ownership id is ever accepted from the client.
// Creates ZERO Events.

import { NextRequest, NextResponse } from 'next/server';
import { authorizeHost, accountHasRoomAccess } from '@/lib/host-auth.server';
import { hostTokenFromRequest } from '@/lib/host-web-session.server';
import { verifyHostCsrf, csrfFromForm } from '@/lib/host-csrf.server';
import { issueRoomWebSession, roomSessionCookie } from '@/lib/room-web-session.server';
import { getPublicRoomBySlug } from '@/lib/rooms.server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' } as const;

export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;

  const hostToken = hostTokenFromRequest(req);
  const account = await authorizeHost(hostToken);
  if (!account) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
  }

  // CSRF: Origin + session-bound token. SameSite=Lax is a mitigation, not the check.
  const form = await req.formData().catch(() => null);
  const csrf = await verifyHostCsrf(req, hostToken, csrfFromForm(form));
  if (!csrf.ok) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 403, headers: NO_STORE });
  }

  const room = await getPublicRoomBySlug(slug);
  // Unknown Room and unauthorized Room are the SAME 404 — identifier swapping
  // reveals nothing about which Rooms exist or who owns them.
  if (!room || !(await accountHasRoomAccess(account.id, room.id))) {
    return NextResponse.json({ error: 'Room not found' }, { status: 404, headers: NO_STORE });
  }

  // Rotate: each entry mints a fresh credential. No ownership row is duplicated.
  const raw = await issueRoomWebSession(room.id, account.id);

  const res = NextResponse.redirect(
    new URL(`/r/${encodeURIComponent(room.slug)}/admin`, req.nextUrl.origin),
    303,
  );
  res.cookies.set(roomSessionCookie(req, raw));
  return res;
}
