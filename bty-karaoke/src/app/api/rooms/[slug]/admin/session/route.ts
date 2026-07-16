// Admin: karaoke-night session control.
//   GET    -> active session (or null) + live room stats
//   POST   -> start (or return the already-active) session
//   DELETE -> end the active session (blocks new guest requests; keeps history)

import { NextRequest, NextResponse } from 'next/server';
import { bearerFromHeader } from '@/lib/dj-auth.server';
import { authorizeAdmin, activeRequestStats } from '@/lib/rooms.server';
import { bootstrapInitialEvent, getLatestEndedEvent } from '@/lib/events.server';
import { getActiveSession, startSession, endSession } from '@/lib/sessions.server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function requireAdmin(req: NextRequest, slug: string) {
  const bearer = bearerFromHeader(req.headers.get('authorization'));
  if (!bearer) return null;
  return authorizeAdmin(slug, bearer);
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const auth = await requireAdmin(req, slug);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Admin Hub init (V7 PART A): bootstrap creates the room's ONE live Event only on
  // its FIRST Hub open. After an Event is ended it returns null — the Hub must NOT
  // silently re-create a live Event; the Admin lands on the ended summary and
  // explicitly Starts a New Event. Never runs on Guest/Display/DJ/public reads.
  const event = await bootstrapInitialEvent(auth.room.id, auth.room.display_name);
  const endedEvent = event ? null : await getLatestEndedEvent(auth.room.id);

  const [session, stats] = await Promise.all([
    getActiveSession(auth.room.id),
    activeRequestStats(auth.room.id),
  ]);
  return NextResponse.json({
    room: { slug: auth.room.slug, display_name: auth.room.display_name, status: auth.room.status },
    session,
    stats,
    event: event ? { id: event.id, name: event.name, status: event.status } : null,
    endedEvent: endedEvent
      ? {
          id: endedEvent.id,
          name: endedEvent.name,
          status: endedEvent.status,
          started_at: endedEvent.starts_at,
          ended_at: endedEvent.ended_at,
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
