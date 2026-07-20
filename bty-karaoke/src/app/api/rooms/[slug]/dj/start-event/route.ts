// Start a New Event from the DJ device (Event Lifecycle V1). The SYMMETRIC
// counterpart of dj/end-event: it lets the single enrolled Admin iPad (a dj-role
// device) rotate to a fresh Event on the SAME room WITHOUT a manager re-login,
// exactly as it can already END the Event from that device.
//
// Reuses the canonical services (startNewEvent + startSession) — the same ones
// admin/start-event calls; the ONLY difference is the auth boundary. admin/start-
// event uses authorizeAdmin (admin-role devices / master credential only), which
// REJECTS dj-role devices, so the iPad running the show could never reach it. This
// route uses authorizeDj (room master credential OR an ACTIVE dj/admin device
// scoped to this room), matching dj/end-event. Idempotent + double-tap safe:
// startNewEvent returns the existing live Event unchanged if one already exists, so
// two taps (or a lost response the client retries) never create two live Events.

import { NextRequest, NextResponse } from 'next/server';
import { roomCredentialFromRequest } from '@/lib/dj-auth.server';
import { authorizeDj } from '@/lib/rooms.server';
import { startNewEvent, publicEvent } from '@/lib/events.server';
import { startSession } from '@/lib/sessions.server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const bearer = roomCredentialFromRequest(req);
  if (!bearer) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const auth = await authorizeDj(slug, bearer);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Idempotent: a live Event is returned unchanged (one-live-per-room preserved),
  // otherwise a brand-new Event (new id + new guest_slug → new Guest QR) is created.
  const event = await startNewEvent(auth.room.id, auth.room.display_name);
  // A fresh night so guest requests are accepted again for the new Event.
  const session = await startSession(auth.room.id);

  return NextResponse.json({ ok: true, event: publicEvent(event), session }, { status: 201 });
}
