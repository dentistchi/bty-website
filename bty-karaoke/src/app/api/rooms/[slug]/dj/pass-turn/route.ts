// V8 pass-turn (Option B). Admin-initiated: complete the current playing song and,
// if the canonical first waiting song is BOTH Ready and Queued on the TV, auto-
// start it in BTY — so the Admin doesn't press Play every song. This flips BTY
// state ONLY; it never controls YouTube. Admin/DJ authenticated, event-gated.
// POST { currentId }.

import { NextRequest, NextResponse } from 'next/server';
import { bearerFromHeader } from '@/lib/dj-auth.server';
import { authorizeDj, passTurnAndPromote } from '@/lib/rooms.server';
import { getCanonicalEvent, resolveEventAccess } from '@/lib/events.server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' } as const;

export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const cred = bearerFromHeader(req.headers.get('authorization'));
  if (!cred) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });

  const auth = await authorizeDj(slug, cred);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });

  const access = await resolveEventAccess(auth.room);
  if (!access.ok) {
    return NextResponse.json({ error: access.error, code: access.code }, { status: access.status, headers: NO_STORE });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400, headers: NO_STORE });
  }
  const currentId = (body as { currentId?: unknown }).currentId;
  if (typeof currentId !== 'string' || !currentId) {
    return NextResponse.json({ error: 'currentId is required' }, { status: 400, headers: NO_STORE });
  }

  // Scope the next-song lookup to the LIVE event's rows (V7.1).
  const live = await getCanonicalEvent(auth.room.id);
  const result = await passTurnAndPromote(auth.room.id, currentId, live?.id ?? null);

  return NextResponse.json(
    {
      ok: true,
      completed: result.completed,
      promoted: result.promoted ? { id: result.promoted.id } : null,
      reason: result.reason,
    },
    { headers: NO_STORE },
  );
}
