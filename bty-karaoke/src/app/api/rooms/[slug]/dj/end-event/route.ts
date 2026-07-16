// End the Event from the DJ device. This is DISTINCT from "Disconnect this iPad"
// (which only revokes this device's authorization): ending the Event flips its
// status to ended, records ended_at, and blocks new guest requests, while the
// queue/history is preserved and playing media is NOT stopped.
//
// Authorization reuses authorizeDj — the room master credential OR an ACTIVE
// dj/admin device SCOPED to this room. A DJ token for another room resolves to no
// device here (→ 401); a guest has no token (→ 401). No manager token is created
// or exposed on the DJ device.

import { NextRequest, NextResponse } from 'next/server';
import { bearerFromHeader } from '@/lib/dj-auth.server';
import { authorizeDj } from '@/lib/rooms.server';
import { getCanonicalEvent, endEvent, publicEvent } from '@/lib/events.server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const cred = bearerFromHeader(req.headers.get('authorization'));
  if (!cred) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const auth = await authorizeDj(slug, cred);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Only the ONE LIVE Event can be ended (V7 PART K: never an all-status lookup —
  // after rotation a room has both an ended and a live Event; end the live one).
  const event = await getCanonicalEvent(auth.room.id);
  // Legacy non-event room, or already-ended with no live Event: nothing to end.
  if (!event) return NextResponse.json({ error: 'This room has no live event' }, { status: 404 });

  const ended = await endEvent(event.id); // idempotent; ends the active session too
  if (!ended) return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  return NextResponse.json({ ok: true, event: publicEvent(ended) });
}
