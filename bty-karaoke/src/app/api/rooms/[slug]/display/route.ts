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
  // Resolve the room's ONE canonical event identity (live, else most-recent ended)
  // FIRST, then read the display state scoped to THAT event id so LIVE stats + queue
  // reflect only this Event — never the room's whole history (V7.1). Null only for a
  // legacy room that never had an Event.
  const live = await getCanonicalEvent(room.id);
  const event = live ?? (await getLatestEndedEvent(room.id));
  const state = await getDisplayState(room, event?.id ?? null);
  const withEvent = {
    ...state,
    event: event ? { id: event.id, name: event.name, status: event.status } : null,
  };
  return NextResponse.json(withEvent, { headers: NO_STORE });
}
