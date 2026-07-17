// Authenticated DJ queue read. Requires a valid DJ credential in the
// Authorization header — the room master credential OR a paired device token.
// An invalid/absent credential returns 401 with NO queue data.

import { NextRequest, NextResponse } from 'next/server';
import { bearerFromHeader } from '@/lib/dj-auth.server';
import { authorizeDj, listActiveRequests, activeRequestStats, reconcileStage } from '@/lib/rooms.server';
import { getActiveSession } from '@/lib/sessions.server';
import { getEventStatusForRoom, getCanonicalEvent } from '@/lib/events.server';
import { scheduleLyricsResolve } from '@/lib/lyrics-resolver.server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const cred = bearerFromHeader(req.headers.get('authorization'));
  if (!cred) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const auth = await authorizeDj(slug, cred);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Resolve the canonical LIVE event first so the queue + stats are scoped to THIS
  // event's rows (V7.1) — never the room's whole history. Null for legacy rooms.
  const event = await getCanonicalEvent(auth.room.id);

  // V8.1 — self-healing stage reconciliation. Every Admin poll (and the initial
  // load) idempotently promotes the earliest Ready song when the stage is idle, so
  // a Ready that missed its promotion (transient / event-scope) auto-recovers here
  // without the Admin doing anything. Never interrupts a song already playing.
  const promoted = await reconcileStage(auth.room.id, event?.id ?? null);
  if (promoted.outcome === 'started' && promoted.request?.id) {
    void scheduleLyricsResolve(auth.room.id, promoted.request.id);
  }

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
