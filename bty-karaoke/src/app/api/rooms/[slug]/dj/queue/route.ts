// Authenticated DJ queue read. Requires a valid DJ credential in the
// Authorization header — the room master credential OR a paired device token.
// An invalid/absent credential returns 401 with NO queue data.

import { NextRequest, NextResponse } from 'next/server';
import { bearerFromHeader } from '@/lib/dj-auth.server';
import { authorizeDj, listActiveRequests, activeRequestStats } from '@/lib/rooms.server';
import { getActiveSession } from '@/lib/sessions.server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const cred = bearerFromHeader(req.headers.get('authorization'));
  if (!cred) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const auth = await authorizeDj(slug, cred);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [requests, stats, session] = await Promise.all([
    listActiveRequests(auth.room.id),
    activeRequestStats(auth.room.id),
    getActiveSession(auth.room.id),
  ]);

  return NextResponse.json({
    room: { display_name: auth.room.display_name, status: auth.room.status },
    role: auth.role,
    session,
    stats,
    requests,
  });
}
