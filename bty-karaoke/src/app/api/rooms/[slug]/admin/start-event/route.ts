// Admin: Start a New Event (V7 PART D — Event rotation).
//   POST -> create a fresh live Event for this room (new id, new guest_slug → new
//           Guest QR) and start a new karaoke-night session so guests can request
//           again. Idempotent: if a live Event already exists it is returned
//           unchanged (the one-live-per-room invariant is never violated), so a
//           double-tap is safe. The previous ended Event stays as history and its
//           old Guest QR can never join this new Event.
//
// Authorization is authorizeAdmin (room master credential OR an admin device) —
// this is a lifecycle action, never available to a plain guest or DJ device.

import { NextRequest, NextResponse } from 'next/server';
import { bearerFromHeader } from '@/lib/dj-auth.server';
import { authorizeAdmin } from '@/lib/rooms.server';
import { startNewEvent, publicEvent } from '@/lib/events.server';
import { startSession } from '@/lib/sessions.server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const bearer = bearerFromHeader(req.headers.get('authorization'));
  if (!bearer) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const auth = await authorizeAdmin(slug, bearer);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const event = await startNewEvent(auth.room.id, auth.room.display_name);
  // A new night so guest requests are accepted for the new Event (the previous
  // session was ended together with the previous Event).
  const session = await startSession(auth.room.id);

  return NextResponse.json({ ok: true, event: publicEvent(event), session }, { status: 201 });
}
