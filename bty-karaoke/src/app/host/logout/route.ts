// Host web logout. POST-only (a GET must never be able to log someone out, and
// SameSite=Lax means a cross-site POST carries no cookie — that is the CSRF guard).
// Revokes the session server-side and clears the cookie. Never ends an Event,
// never deletes a Room, never touches Event history.

import { NextRequest, NextResponse } from 'next/server';
import { signOutWebHost, hostTokenFromRequest } from '@/lib/host-web-session.server';
import { clearedRoomCookie } from '@/lib/room-web-session.server';
import { verifyHostCsrf, csrfFromForm } from '@/lib/host-csrf.server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  // CSRF: Origin + session-bound token, not SameSite alone.
  const form = await req.formData().catch(() => null);
  const csrf = await verifyHostCsrf(req, hostTokenFromRequest(req), csrfFromForm(form));
  if (!csrf.ok) return NextResponse.json({ error: 'Invalid request' }, { status: 403 });

  // Land on the canonical root entry (renders the "signed out" notice).
  const res = NextResponse.redirect(new URL('/?notice=signed_out', req.nextUrl.origin), 303);
  // Revoke + clear the Host session, AND clear the subordinate Room cookie so a
  // Sign Out taken from the room Admin surface fully logs the browser out. This
  // clears the browser credential only — it never ends an Event or deletes a Room.
  await signOutWebHost(req, res);
  res.cookies.set(clearedRoomCookie(req));
  return res;
}
