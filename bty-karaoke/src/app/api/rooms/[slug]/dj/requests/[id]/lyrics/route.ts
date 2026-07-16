// Lyrics V1 — Admin sets / clears the lyrics on a request (the song on stage, or
// any queued song). Admin/DJ authenticated (authorizeDj ⊇ authorizeAdmin); NEVER
// guest-settable. Read-only surfaces (Display, guest) can only see lyrics, not
// write them. POST { lyrics: string } — an empty string clears. Event-gated: an
// ended Event refuses (its queue is cleared, so lyrics are meaningless).
//
// Security: text-only. The stored value is sanitized (control chars stripped,
// length capped) and rendered as text by the Display — never HTML, no
// dangerouslySetInnerHTML anywhere in the read path.

import { NextRequest, NextResponse } from 'next/server';
import { bearerFromHeader } from '@/lib/dj-auth.server';
import { authorizeDj, setRequestLyrics } from '@/lib/rooms.server';
import { resolveEventAccess } from '@/lib/events.server';
import { SetLyricsSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' } as const;

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ slug: string; id: string }> },
) {
  const { slug, id } = await ctx.params;
  const cred = bearerFromHeader(req.headers.get('authorization'));
  if (!cred) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });

  const auth = await authorizeDj(slug, cred);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });

  // Lyrics on an ended Event are meaningless (the queue is cleared) — refuse honestly.
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

  const parsed = SetLyricsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed' }, { status: 400, headers: NO_STORE });
  }

  const result = await setRequestLyrics(auth.room.id, id, parsed.data.lyrics);
  if (result.outcome === 'not_found') {
    return NextResponse.json(
      { error: 'Request not found', code: 'REQUEST_NOT_FOUND' },
      { status: 404, headers: NO_STORE },
    );
  }
  const cleared = parsed.data.lyrics.trim().length === 0;
  return NextResponse.json({ ok: true, cleared }, { headers: NO_STORE });
}
