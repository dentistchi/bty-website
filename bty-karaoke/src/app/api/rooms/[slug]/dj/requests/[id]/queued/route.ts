// V8 Admin YouTube Queue Assist — mark/unmark a waiting request as "added to the
// YouTube TV queue". Admin/DJ authenticated (authorizeDj ⊇ authorizeAdmin); never
// guest-settable. This sets a signal ONLY — it does not start the song, does not
// open YouTube, and does not occupy the stage. POST { queued?: boolean } (default
// true; false clears). Event-gated: an ended Event refuses (EVENT_ENDED).

import { NextRequest, NextResponse } from 'next/server';
import { roomCredentialFromRequest } from '@/lib/dj-auth.server';
import { authorizeDj, setRequestQueued } from '@/lib/rooms.server';
import { resolveEventAccess } from '@/lib/events.server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' } as const;

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ slug: string; id: string }> },
) {
  const { slug, id } = await ctx.params;
  const cred = roomCredentialFromRequest(req);
  if (!cred) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });

  const auth = await authorizeDj(slug, cred);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });

  // A signal on an ended Event is meaningless (the queue is cleared) — refuse honestly.
  const access = await resolveEventAccess(auth.room);
  if (!access.ok) {
    return NextResponse.json({ error: access.error, code: access.code }, { status: access.status, headers: NO_STORE });
  }

  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    /* empty body → default queued=true */
  }
  const queued = (body as { queued?: unknown }).queued !== false;

  const result = await setRequestQueued(auth.room.id, id, queued);
  switch (result.outcome) {
    case 'ok':
      return NextResponse.json({ ok: true, queued }, { headers: NO_STORE });
    case 'not_found':
      return NextResponse.json(
        { error: 'Request not found', code: 'REQUEST_NOT_FOUND' },
        { status: 404, headers: NO_STORE },
      );
    case 'not_waiting':
      return NextResponse.json(
        { error: 'This song is no longer waiting', code: 'REQUEST_NOT_WAITING' },
        { status: 409, headers: NO_STORE },
      );
  }
}
