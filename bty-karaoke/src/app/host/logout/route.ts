// Host web logout. POST-only (a GET must never be able to log someone out, and
// SameSite=Lax means a cross-site POST carries no cookie — that is the CSRF guard).
// Revokes the session server-side and clears the cookie. Never ends an Event,
// never deletes a Room, never touches Event history.

import { NextRequest, NextResponse } from 'next/server';
import { signOutWebHost, hostTokenFromRequest } from '@/lib/host-web-session.server';
import { verifyHostCsrf, csrfFromForm } from '@/lib/host-csrf.server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  // CSRF: Origin + session-bound token, not SameSite alone.
  const form = await req.formData().catch(() => null);
  const csrf = await verifyHostCsrf(req, hostTokenFromRequest(req), csrfFromForm(form));
  if (!csrf.ok) return NextResponse.json({ error: 'Invalid request' }, { status: 403 });

  const res = NextResponse.redirect(new URL('/host?notice=signed_out', req.nextUrl.origin), 303);
  await signOutWebHost(req, res);
  return res;
}
