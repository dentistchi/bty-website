// Authenticated DJ queue read. Requires a valid DJ credential in the
// Authorization header — the room master credential OR a paired device token.
// An invalid/absent credential returns 401 with NO queue data.
//
// READ-ONLY (V1.1 manual-first): this GET NEVER mutates playback state. It used to
// self-heal by auto-promoting the earliest Ready song when the stage was idle
// (V8.1 autopilot), but that made the FIRST song start on a mere poll — before any
// operator action — which violates the manual-first contract. Starting the first
// song is now an explicit operator action (dj/start); automatic promotion happens
// ONLY as the continuation of finishing a playing song (pass-turn / complete-skip).

import { NextRequest, NextResponse } from 'next/server';
import { roomCredentialFromRequest } from '@/lib/dj-auth.server';
import { authorizeDj, listActiveRequests, activeRequestStats } from '@/lib/rooms.server';
import { getActiveSession } from '@/lib/sessions.server';
import { getEventStatusForRoom, getCanonicalEvent } from '@/lib/events.server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const cred = roomCredentialFromRequest(req);
  if (!cred) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const auth = await authorizeDj(slug, cred);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Resolve the canonical LIVE event first so the queue + stats are scoped to THIS
  // event's rows (V7.1) — never the room's whole history. Null for legacy rooms.
  const event = await getCanonicalEvent(auth.room.id);

  const [requests, stats, session, eventStatus] = await Promise.all([
    listActiveRequests(auth.room.id, event?.id ?? null),
    activeRequestStats(auth.room.id, event?.id ?? null),
    getActiveSession(auth.room.id),
    getEventStatusForRoom(auth.room.id), // null for legacy non-event rooms; else event-scoped
  ]);

  return NextResponse.json({
    room: { display_name: auth.room.display_name, status: auth.room.status },
    role: auth.role,
    session,
    stats,
    requests,
    eventStatus,
    // Canonical event identity — same id the Display/Guest/Admin resolve.
    event: event ? { id: event.id, name: event.name, status: event.status } : null,
  });
}
