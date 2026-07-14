// PUBLIC guest live-presence endpoint (polled by the /j/<guestSlug> screen).
// Grants no authority and returns ONLY public event data — event identity,
// now-singing, up-next, and counts. No room_id / slug / credential / token /
// private session identifier ever appears in the response. Small payload, two
// indexed queries, no YouTube call.

import { NextRequest, NextResponse } from 'next/server';
import { getEventByGuestSlug, getGuestLivePresenceByEvent } from '@/lib/events.server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(_req: NextRequest, ctx: { params: Promise<{ guestSlug: string }> }) {
  const { guestSlug } = await ctx.params;

  const event = await getEventByGuestSlug(guestSlug);
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

  const presence = await getGuestLivePresenceByEvent(event);
  // Never cache: the guest polls this for the live state.
  return NextResponse.json(presence, { headers: { 'cache-control': 'no-store' } });
}
