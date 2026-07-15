// Public guest-invite QR for a room. The guest route is public and grants no DJ
// or Admin authority, so this needs no credential. Returns an inline SVG QR of
// the guest URL plus the URL itself. Used by the Admin phone and the DJ console.

import { NextRequest, NextResponse } from 'next/server';
import { getPublicRoomBySlug } from '@/lib/rooms.server';
import { getCanonicalEvent } from '@/lib/events.server';
import { qrSvg } from '@/lib/qr.server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const room = await getPublicRoomBySlug(slug);
  if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });

  // V5 QR compatibility decision: the Guest QR ALWAYS opens the room's polished
  // self-service screen (/r/<slug>) — the canonical guest experience since V2–V4.
  // The server resolves room → canonical live event, so identity is unified
  // without changing the screen a guest lands on when a room gains an event (a
  // scan never creates an event — this is a pure read). The pretty /j/<guestSlug>
  // route stays functional for existing links. roomName shows the event name when
  // one is live (nice on the Display), else the room's display name.
  const event = await getCanonicalEvent(room.id);
  const url = `${req.nextUrl.origin}/r/${encodeURIComponent(slug)}`;
  const svg = await qrSvg(url);
  return NextResponse.json({ url, qrSvg: svg, roomName: event?.name ?? room.display_name });
}
