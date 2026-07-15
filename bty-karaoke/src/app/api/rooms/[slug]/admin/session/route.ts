// Admin: karaoke-night session control.
//   GET    -> active session (or null) + live room stats
//   POST   -> start (or return the already-active) session
//   DELETE -> end the active session (blocks new guest requests; keeps history)

import { NextRequest, NextResponse } from 'next/server';
import { bearerFromHeader } from '@/lib/dj-auth.server';
import { authorizeAdmin, activeRequestStats } from '@/lib/rooms.server';
import { ensureCanonicalLiveEvent } from '@/lib/events.server';
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

  // Admin Hub init (V5 2A): the ONLY place a room's canonical live Event is
  // auto-ensured. Opening the Hub silently guarantees exactly one live Event —
  // no "Create Event" step. Never runs on Guest/Display/DJ/public reads.
  const event = await ensureCanonicalLiveEvent(auth.room.id, auth.room.display_name);

  const [session, stats] = await Promise.all([
    getActiveSession(auth.room.id),
    activeRequestStats(auth.room.id),
  ]);
  return NextResponse.json({
    room: { slug: auth.room.slug, display_name: auth.room.display_name, status: auth.room.status },
    session,
    stats,
    event: { id: event.id, name: event.name, status: event.status },
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
