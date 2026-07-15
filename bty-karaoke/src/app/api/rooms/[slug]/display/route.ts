// Public room display state — the read model the iPad Karaoke Display and the
// guest full-queue board both poll. Read-only and credential-free: the room's
// queue is already visible to everyone who scanned the guest QR. It exposes ONLY
// safe fields (room name, singer names, public YouTube ids, queue order) — never
// session_id, dj_secret, the room UUID, or any credential. Always no-store.

import { NextRequest, NextResponse } from 'next/server';
import { getPublicRoomBySlug, getDisplayState } from '@/lib/rooms.server';

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
  const state = await getDisplayState(room);
  return NextResponse.json(state, { headers: NO_STORE });
}
