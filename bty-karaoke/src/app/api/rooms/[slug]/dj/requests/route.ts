// DJ adds a song on a guest's behalf. DJ-authed (paired DJ/admin device OR the
// legacy master credential — the same boundary as every DJ action). Reuses the
// exact guest submission service (addRequest) + session gate, so the new row is
// an ordinary waiting request in the canonical queue: appended at the tail,
// counted in guest #N, reorderable. No guest cancel capability is minted (the
// DJ owns the queue). guest_name defaults to "DJ".

import { NextRequest, NextResponse } from 'next/server';
import { parseYoutubeVideoId } from '@/domain/youtube';
import { DjAddRequestSchema } from '@/lib/validation';
import {
  authorizeDj,
  addRequest,
  listActiveRequests,
} from '@/lib/rooms.server';
import { bearerFromHeader } from '@/lib/dj-auth.server';
import { requestAcceptance } from '@/lib/sessions.server';
import { resolveEventAccess } from '@/lib/events.server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;

  const cred = bearerFromHeader(req.headers.get('authorization'));
  if (!cred) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = DjAddRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed' }, { status: 400 });
  }

  const auth = await authorizeDj(slug, cred);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // V7 PART H — never inject a song into an ended Event's queue. Legacy eventless
  // rooms pass (event: null). Live event → ok; ended → 409 EVENT_ENDED.
  const access = await resolveEventAccess(auth.room);
  if (!access.ok) {
    return NextResponse.json({ error: access.error, code: access.code }, { status: access.status });
  }

  // Same night gate as guests: accepted while a session is active (legacy
  // no-session rooms stay open). This also stamps the request's session_id.
  const acceptance = await requestAcceptance(auth.room.id);
  if (!acceptance.ok) {
    return NextResponse.json(
      { error: 'The karaoke night is not open right now.' },
      { status: 409 },
    );
  }

  const videoId =
    parsed.data.youtubeVideoId ?? parseYoutubeVideoId(parsed.data.youtubeInput ?? '');
  if (!videoId) {
    return NextResponse.json(
      { error: 'Could not read a YouTube video from that link or ID' },
      { status: 400 },
    );
  }

  const guestName = parsed.data.guestName?.trim() || 'DJ';

  const { request } = await addRequest({
    roomId: auth.room.id,
    guestName,
    youtubeVideoId: videoId,
    searchQuery: parsed.data.searchQuery,
    youtubeTitle: parsed.data.youtubeTitle,
    youtubeChannelTitle: parsed.data.youtubeChannelTitle,
    youtubeThumbnailUrl: parsed.data.youtubeThumbnailUrl,
    sessionId: acceptance.sessionId,
  });

  // Return the fresh canonical queue so the DJ console updates immediately.
  const requests = await listActiveRequests(auth.room.id);
  return NextResponse.json({ ok: true, request, requests }, { status: 201 });
}
