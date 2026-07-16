// Manager mints a fresh one-use DJ-enrollment token for an event and gets back a
// ready-to-show QR (reuses the room pairing token + pairing route). The raw token
// lives only inside the returned URL/QR — never logged, never a reusable bearer.
// Refused once the event has ended. Manager authority required.

import { NextRequest, NextResponse } from 'next/server';
import { managerEnabled, managerAuthorized } from '@/lib/manager-auth.server';
import { getEventById, mintDjEnrollment, eventRoomSlugOf } from '@/lib/events.server';
import { djEnrollQrFor } from '@/lib/event-links.server';
import { pairingSecondsRemaining } from '@/domain/pairing';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest, ctx: { params: Promise<{ eventId: string }> }) {
  if (!managerEnabled()) {
    return NextResponse.json({ error: 'Event management is not enabled.' }, { status: 503 });
  }
  if (!(await managerAuthorized(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { eventId } = await ctx.params;
  const event = await getEventById(eventId);
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  if (event.status === 'ended' || event.status === 'archived') {
    return NextResponse.json({ error: 'This event has ended.' }, { status: 409 });
  }

  // Build the pairing link from the CANONICAL room slug (never the public code).
  const roomSlug = await eventRoomSlugOf(event);
  if (!roomSlug) {
    return NextResponse.json(
      { error: 'This event has no room to connect a Display to.', code: 'NO_ROOM' },
      { status: 409 },
    );
  }

  const enrollment = await mintDjEnrollment(event);
  const dj = await djEnrollQrFor(req.nextUrl.origin, roomSlug, enrollment.token);
  return NextResponse.json({
    ok: true,
    djEnrollmentUrl: dj.url,
    djEnrollmentQrSvg: dj.qrSvg,
    expiresAt: enrollment.expiresAt,
    ttlSeconds: pairingSecondsRemaining(enrollment.expiresAt, Date.now()),
  });
}
