// Manager events collection.
//   GET  -> "tonight's events" (newest first) with stats + DJ status
//   POST -> create an event: atomically make its room + event (+ start the night),
//           mint a DJ-enrollment token, and return both QRs ready to show.
// Manager authority required. No raw credential is ever returned.

import { NextRequest, NextResponse } from 'next/server';
import { CreateEventSchema } from '@/lib/validation';
import { managerEnabled, managerAuthorized } from '@/lib/manager-auth.server';
import { createEvent, listEventConsole, mintDjEnrollment, publicEvent } from '@/lib/events.server';
import { guestQrFor, djEnrollQrFor } from '@/lib/event-links.server';
import { canonicalGuestOrigin } from '@/domain/guest-origin';
import { pairingSecondsRemaining } from '@/domain/pairing';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const unavailable = () =>
  NextResponse.json({ error: 'Event management is not enabled.' }, { status: 503 });
const unauthorized = () => NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

export async function GET(req: NextRequest) {
  if (!managerEnabled()) return unavailable();
  if (!(await managerAuthorized(req))) return unauthorized();

  // BUILD R4E-R1 — classified, counted and ordered server-side. Still one read path, still no
  // write: opening this page changes nothing.
  const viewRaw = req.nextUrl.searchParams.get('view');
  const view = (['active', 'needs-attention', 'recent', 'ended', 'test', 'deleted', 'all'] as const)
    .find((v) => v === viewRaw);
  const { events: rows, totals, window } = await listEventConsole({ view });
  const events = rows.map((s) => ({
    event: publicEvent(s.event),
    stats: s.stats,
    // `dj` keeps its shape for the detail sheet; `djLive` is the ONLY thing the list may badge.
    dj: s.dj,
    djLive: s.djLive ?? false,
    eventClass: s.eventClass,
    lastActivityAt: s.lastActivityAt ?? null,
  }));
  return NextResponse.json({ events, totals, window });
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

  // createEvent returns the room's canonical slug (the room is created with it) —
  // used directly so the DJ-enroll link never depends on deriving it from the code.
  const { event, roomSlug } = await createEvent({
    name: parsed.data.name,
    hostName: parsed.data.hostName ?? null,
    startNow: parsed.data.startNow ?? true,
  });

  // BUILD 20B-R1 — guest/DJ QRs encode the canonical production origin, never workers.dev.
  const origin = canonicalGuestOrigin();
  const enrollment = await mintDjEnrollment(event);
  const [guest, dj] = await Promise.all([
    guestQrFor(origin, event),
    djEnrollQrFor(origin, roomSlug, enrollment.token),
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
