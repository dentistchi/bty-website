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
import { roomCredentialFromRequest } from '@/lib/dj-auth.server';
import { authorizeDj } from '@/lib/rooms.server';
import { getCanonicalEvent, getLatestEndedEvent, endEvent, publicEvent } from '@/lib/events.server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const cred = roomCredentialFromRequest(req);
  if (!cred) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const auth = await authorizeDj(slug, cred);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // End the ONE LIVE Event (V7 PART K: never an all-status lookup — after rotation
  // a room has both an ended and a live Event; end the live one). If there is no
  // live Event, resolve the most-recent ended Event so a REPEATED end (two taps,
  // or a lost response) is idempotent success on the same canonical ended state
  // rather than a false 404 (Event Lifecycle V1 §8). Only a room that NEVER had an
  // Event (legacy self-service) truly has nothing to end → 404.
  const target = (await getCanonicalEvent(auth.room.id)) ?? (await getLatestEndedEvent(auth.room.id));
  if (!target) return NextResponse.json({ error: 'This room has no event' }, { status: 404 });

  const ended = await endEvent(target.id); // atomic; idempotent; ends the active session too
  if (!ended) return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  return NextResponse.json({ ok: true, event: publicEvent(ended.event), summary: ended.summary });
}
