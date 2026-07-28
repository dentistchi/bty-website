// Public guest-invite QR for a room. The guest route is public and grants no DJ
// or Admin authority, so this needs no credential. Returns an inline SVG QR of
// the guest URL plus the URL itself. Used by the Admin phone and the DJ console.

import { NextRequest, NextResponse } from 'next/server';
import { getPublicRoomBySlug } from '@/lib/rooms.server';
import { getCanonicalEvent } from '@/lib/events.server';
import { qrSvg } from '@/lib/qr.server';
import { canonicalGuestRoomUrl } from '@/domain/guest-origin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const room = await getPublicRoomBySlug(slug);
  if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });

  // The Guest QR opens the room's self-service screen (/r/<slug>). V7 PART E:
  // when a live Event owns the room the QR is EVENT-SCOPED — it carries the live
  // event id (`?e=<id>`) so a previous round's printed QR can never join the next
  // Event: the /r screen asserts this id and the server rejects a mismatch (an old
  // id → EVENT_MISMATCH; an ended id → EVENT_ENDED). A scan never creates an event
  // — this is a pure read. Legacy eventless rooms keep the bare URL (unchanged).
  const event = await getCanonicalEvent(room.id);
  // BUILD 20B-R1 — the guest QR MUST encode the canonical production origin
  // (norebang.btydaily.com), never req.nextUrl.origin (which is workers.dev on the deployed
  // Worker). Slug + event-id resolution is unchanged.
  const url = canonicalGuestRoomUrl(slug, event?.id);
  const svg = await qrSvg(url);
  return NextResponse.json({ url, qrSvg: svg, roomName: event?.name ?? room.display_name });
}
