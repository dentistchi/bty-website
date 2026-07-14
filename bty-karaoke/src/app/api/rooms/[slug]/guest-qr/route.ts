// Public guest-invite QR for a room. The guest route is public and grants no DJ
// or Admin authority, so this needs no credential. Returns an inline SVG QR of
// the guest URL plus the URL itself. Used by the Admin phone and the DJ console.

import { NextRequest, NextResponse } from 'next/server';
import { getPublicRoomBySlug } from '@/lib/rooms.server';
import { getEventByRoomId } from '@/lib/events.server';
import { qrSvg } from '@/lib/qr.server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const room = await getPublicRoomBySlug(slug);
  if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });

  // When this room is owned by an event, prefer the pretty, credential-free guest
  // link (/j/<guestSlug>); otherwise fall back to the plain room URL. Both work.
  const event = await getEventByRoomId(room.id);
  const url = event
    ? `${req.nextUrl.origin}/j/${encodeURIComponent(event.guest_slug)}`
    : `${req.nextUrl.origin}/r/${encodeURIComponent(slug)}`;
  const svg = await qrSvg(url);
  return NextResponse.json({ url, qrSvg: svg, roomName: event?.name ?? room.display_name });
}
