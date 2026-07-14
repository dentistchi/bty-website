// Manager event detail: the event + live stats + DJ connection status + the
// (credential-free) guest QR. The DJ-enrollment token is minted only on demand
// via POST …/dj-enrollment, never here. Manager authority required.

import { NextRequest, NextResponse } from 'next/server';
import { managerEnabled, managerAuthorized } from '@/lib/manager-auth.server';
import { getEventSummary, publicEvent } from '@/lib/events.server';
import { guestQrFor } from '@/lib/event-links.server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest, ctx: { params: Promise<{ eventId: string }> }) {
  if (!managerEnabled()) {
    return NextResponse.json({ error: 'Event management is not enabled.' }, { status: 503 });
  }
  if (!(await managerAuthorized(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { eventId } = await ctx.params;
  const summary = await getEventSummary(eventId);
  if (!summary) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

  const guest = await guestQrFor(req.nextUrl.origin, summary.event);
  return NextResponse.json({
    event: publicEvent(summary.event),
    stats: summary.stats,
    dj: summary.dj,
    guestUrl: guest.url,
    guestQrSvg: guest.qrSvg,
  });
}
