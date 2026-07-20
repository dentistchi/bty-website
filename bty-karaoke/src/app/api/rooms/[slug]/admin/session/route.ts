// Admin: karaoke-night session control.
//   GET    -> active session (or null) + live room stats
//   POST   -> start (or return the already-active) session
//   DELETE -> end the active session (blocks new guest requests; keeps history)

import { NextRequest, NextResponse } from 'next/server';
import { roomCredentialFromRequest } from '@/lib/dj-auth.server';
import { authorizeAdmin, activeRequestStats } from '@/lib/rooms.server';
import { getCanonicalEvent, getLatestEndedEvent, eventStatsById } from '@/lib/events.server';
import { getActiveSession, startSession, endSession } from '@/lib/sessions.server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function requireAdmin(req: NextRequest, slug: string) {
  const bearer = roomCredentialFromRequest(req);
  if (!bearer) return null;
  return authorizeAdmin(slug, bearer);
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const auth = await requireAdmin(req, slug);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Event Lifecycle V1 — Admin Hub init is a PURE READ. It resolves the room's ONE
  // live Event and NEVER creates one (no first-open bootstrap, no get-or-create).
  // A room with zero Events returns event: null and the Hub renders an explicit
  // "Start Event" action; only an authenticated Host POST creates an Event.
  const event = await getCanonicalEvent(auth.room.id);
  const endedEvent = event ? null : await getLatestEndedEvent(auth.room.id);

  const [session, stats, endedStats] = await Promise.all([
    getActiveSession(auth.room.id),
    // V7.1: LIVE stats scoped to THIS event (null → legacy room-wide, backward compat).
    activeRequestStats(auth.room.id, event?.id ?? null),
    // Ended summary counts scoped to the ended event id (frozen, never room-wide).
    endedEvent ? eventStatsById(endedEvent.id) : Promise.resolve(null),
  ]);
  return NextResponse.json({
    room: { slug: auth.room.slug, display_name: auth.room.display_name, status: auth.room.status },
    session,
    stats,
    event: event ? { id: event.id, name: event.name, status: event.status } : null,
    endedEvent:
      endedEvent && endedStats
        ? {
            id: endedEvent.id,
            name: endedEvent.name,
            status: endedEvent.status,
            started_at: endedEvent.starts_at,
            ended_at: endedEvent.ended_at,
            counts: {
              singers: endedStats.uniqueGuests,
              requests: endedStats.totalRequests,
              completed: endedStats.completed,
              waiting: endedStats.waiting,
            },
          }
        : null,
  });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const auth = await requireAdmin(req, slug);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const session = await startSession(auth.room.id);
  return NextResponse.json({ ok: true, session });
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const auth = await requireAdmin(req, slug);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const session = await endSession(auth.room.id);
  return NextResponse.json({ ok: true, session });
}
