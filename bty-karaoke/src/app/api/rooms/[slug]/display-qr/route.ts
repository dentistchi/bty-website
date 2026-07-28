// Public "Connect iPad Display" QR for a room. Returns an inline SVG QR of the
// read-only Display route (/r/<slug>/display) plus the URL itself, so an operator
// can point the iPad camera at the phone and land directly on the Display — no
// password, no manual URL editing, no DJ pairing. The Display route is CANONICAL
// and event-agnostic: it resolves the room by its real slug and shows whatever the
// current live event is, so this link never goes stale on an event rotation and
// never uses a derived event slug. Read-only + credential-free, like guest-qr.

import { NextRequest, NextResponse } from 'next/server';
import { getPublicRoomBySlug } from '@/lib/rooms.server';
import { qrSvg } from '@/lib/qr.server';
import { canonicalGuestOrigin } from '@/domain/guest-origin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const room = await getPublicRoomBySlug(slug);
  if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });

  // Canonical Display URL for THIS room — the fixed production origin (BUILD 20B-R1), never
  // req.nextUrl.origin (workers.dev), and never derived from an event code.
  const url = `${canonicalGuestOrigin()}/r/${encodeURIComponent(room.slug)}/display`;
  const svg = await qrSvg(url);
  return NextResponse.json({ url, qrSvg: svg, roomName: room.display_name });
}
