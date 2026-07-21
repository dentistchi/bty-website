// Web Room-claim submit. Authenticated Host FIRST, then the passcode, then the
// atomic claim — the same order the native/API path enforces. Never creates an Event.

import { NextRequest, NextResponse } from 'next/server';
import { authorizeHost, claimRoomForAccount } from '@/lib/host-auth.server';
import { hostTokenFromRequest } from '@/lib/host-web-session.server';
import { verifyHostCsrf, csrfFromForm } from '@/lib/host-csrf.server';
import { managerEnabled, verifyManagerPasscode } from '@/lib/manager-auth.server';
import { getPublicRoomBySlug } from '@/lib/rooms.server';
import { makeLimiter, isLockedOut, recordFailure, recordSuccess } from '@/lib/rate-limit.server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** The pilot Room this deployment offers to connect. */
const PILOT_ROOM_SLUG = 'bty-home';

const back = (req: NextRequest, notice: string) =>
  NextResponse.redirect(new URL(`/host/connect?notice=${notice}`, req.nextUrl.origin), 303);

function clientIp(req: NextRequest): string {
  return req.headers.get('cf-connecting-ip')
    ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
}

export async function POST(req: NextRequest) {
  const account = await authorizeHost(hostTokenFromRequest(req));
  if (!account) return NextResponse.redirect(new URL('/', req.nextUrl.origin), 303);

  const limiter = await makeLimiter('host-web-claim', clientIp(req));
  if (limiter && (await isLockedOut(limiter))) return back(req, 'bad_passcode');

  const form = await req.formData().catch(() => null);
  const csrf = await verifyHostCsrf(req, hostTokenFromRequest(req), csrfFromForm(form));
  if (!csrf.ok) return NextResponse.json({ error: 'Invalid request' }, { status: 403 });

  const passcode = form?.get('passcode');
  if (!managerEnabled() || typeof passcode !== 'string' || !verifyManagerPasscode(passcode)) {
    if (limiter) await recordFailure(limiter);
    return back(req, 'bad_passcode');                 // uniform failure
  }

  const room = await getPublicRoomBySlug(PILOT_ROOM_SLUG);
  if (!room) { if (limiter) await recordFailure(limiter); return back(req, 'bad_passcode'); }

  const result = await claimRoomForAccount({ accountId: account.id, roomId: room.id });
  if (result.outcome === 'conflict') return back(req, 'already_claimed');
  if (result.outcome === 'no_room') return back(req, 'failed');

  if (limiter) await recordSuccess(limiter);
  return NextResponse.redirect(new URL('/', req.nextUrl.origin), 303);
}
