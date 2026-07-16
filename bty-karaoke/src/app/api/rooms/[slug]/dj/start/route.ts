// V8 — Admin atomic Start of a specific waiting request (the FIRST song of a set,
// or a drift-recovery correction). Admin/DJ authenticated. Uses the SAME atomic
// start RPC guests used to self-start, so the one-playing invariant is enforced in
// the DB. This flips BTY state only — it never controls YouTube (the Admin opens
// the video / TV queue separately). POST { requestId }. Event-gated.

import { NextRequest, NextResponse } from 'next/server';
import { bearerFromHeader } from '@/lib/dj-auth.server';
import { authorizeDj, startOwnRequest } from '@/lib/rooms.server';
import { resolveEventAccess } from '@/lib/events.server';

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
  const requestId = (body as { requestId?: unknown }).requestId;
  if (typeof requestId !== 'string' || !requestId) {
    return NextResponse.json({ error: 'requestId is required' }, { status: 400, headers: NO_STORE });
  }

  const result = await startOwnRequest(auth.room.id, requestId);
  if (result.outcome !== 'ok') {
    // 'already_playing' / 'not_next' / 'not_found' from the RPC → honest 409/404.
    const status = result.outcome === 'not_found' ? 404 : 409;
    return NextResponse.json({ error: 'Could not start', code: result.outcome }, { status, headers: NO_STORE });
  }
  return NextResponse.json({ ok: true, request: result.request ?? null }, { headers: NO_STORE });
}
