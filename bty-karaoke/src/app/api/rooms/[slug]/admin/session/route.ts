// Admin: karaoke-night session control.
//   GET    -> active session (or null) + live room stats
//   POST   -> start (or return the already-active) session
//   DELETE -> end the active session (blocks new guest requests; keeps history)

import { NextRequest, NextResponse } from 'next/server';
import { bearerFromHeader } from '@/lib/dj-auth.server';
import { authorizeAdmin, activeRequestStats } from '@/lib/rooms.server';
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

  const [session, stats] = await Promise.all([
    getActiveSession(auth.room.id),
    activeRequestStats(auth.room.id),
  ]);
  return NextResponse.json({
    room: { slug: auth.room.slug, display_name: auth.room.display_name, status: auth.room.status },
    session,
    stats,
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
