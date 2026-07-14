// Manager events collection.
//   GET  -> "tonight's events" (newest first) with stats + DJ status
//   POST -> create an event: atomically make its room + event (+ start the night),
//           mint a DJ-enrollment token, and return both QRs ready to show.
// Manager authority required. No raw credential is ever returned.

import { NextRequest, NextResponse } from 'next/server';
import { CreateEventSchema } from '@/lib/validation';
import { managerEnabled, managerAuthorized } from '@/lib/manager-auth.server';
import { createEvent, listEventSummaries, mintDjEnrollment, publicEvent } from '@/lib/events.server';
import { guestQrFor, djEnrollQrFor } from '@/lib/event-links.server';
import { pairingSecondsRemaining } from '@/domain/pairing';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const unavailable = () =>
  NextResponse.json({ error: 'Event management is not enabled.' }, { status: 503 });
const unauthorized = () => NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

export async function GET(req: NextRequest) {
  if (!managerEnabled()) return unavailable();
  if (!(await managerAuthorized(req))) return unauthorized();

  const summaries = await listEventSummaries();
  const events = summaries.map((s) => ({
    event: publicEvent(s.event),
    stats: s.stats,
    dj: s.dj,
  }));
  return NextResponse.json({ events });
}

export async function POST(req: NextRequest) {
  if (!managerEnabled()) return unavailable();
  if (!(await managerAuthorized(req))) return unauthorized();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const parsed = CreateEventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed' }, { status: 400 });
  }

  const { event } = await createEvent({
    name: parsed.data.name,
    hostName: parsed.data.hostName ?? null,
    startNow: parsed.data.startNow ?? true,
  });

  const origin = req.nextUrl.origin;
  const enrollment = await mintDjEnrollment(event);
  const [guest, dj] = await Promise.all([
    guestQrFor(origin, event),
    djEnrollQrFor(origin, event, enrollment.token),
  ]);

  return NextResponse.json(
    {
      event: publicEvent(event),
      guestUrl: guest.url,
      guestQrSvg: guest.qrSvg,
      djEnrollmentUrl: dj.url,
      djEnrollmentQrSvg: dj.qrSvg,
      djEnrollmentExpiresAt: enrollment.expiresAt,
      djEnrollmentTtlSeconds: pairingSecondsRemaining(enrollment.expiresAt, Date.now()),
    },
    { status: 201 },
  );
}
