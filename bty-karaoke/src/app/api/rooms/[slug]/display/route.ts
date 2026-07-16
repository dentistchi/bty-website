// Public room display state — the read model the iPad Karaoke Display and the
// guest full-queue board both poll. Read-only and credential-free: the room's
// queue is already visible to everyone who scanned the guest QR. It exposes ONLY
// safe fields (room name, singer names, public YouTube ids, queue order) — never
// session_id, dj_secret, the room UUID, or any credential. Always no-store.

import { NextRequest, NextResponse } from 'next/server';
import { getPublicRoomBySlug, getDisplayState } from '@/lib/rooms.server';
import { getCanonicalEvent, getLatestEndedEvent } from '@/lib/events.server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' } as const;

export async function GET(_req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const room = await getPublicRoomBySlug(slug);
  if (!room) {
    return NextResponse.json({ error: 'Room not found' }, { status: 404, headers: NO_STORE });
  }
  const [state, live] = await Promise.all([getDisplayState(room), getCanonicalEvent(room.id)]);
  // Inject the room's ONE canonical event identity so Display / Guest / DJ all
  // read the same event id + honest status. When no Event is live, fall back to
  // the most recent ended Event so the Display / guest board can show the ended
  // stage (V7 PART G). Null only for a legacy room that never had an Event.
  const event = live ?? (await getLatestEndedEvent(room.id));
  const withEvent = {
    ...state,
    event: event ? { id: event.id, name: event.name, status: event.status } : null,
  };
  return NextResponse.json(withEvent, { headers: NO_STORE });
}
