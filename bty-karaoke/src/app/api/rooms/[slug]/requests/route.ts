// Guest queue API for a room.
//   GET  -> current active queue (waiting + playing)
//   POST -> add a request; returns confirmation + the guest's queue position.

import { NextRequest, NextResponse } from 'next/server';
import { parseYoutubeVideoId } from '@/domain/youtube';
import { CreateRequestSchema } from '@/lib/validation';
import { addRequest, getPublicRoomBySlug, listActiveRequests } from '@/lib/rooms.server';
import { requestAcceptance } from '@/lib/sessions.server';
import { signCancelCapability } from '@/lib/capability.server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(_req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const room = await getPublicRoomBySlug(slug);
  if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });
  const requests = await listActiveRequests(room.id);
  return NextResponse.json({ room, requests });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const room = await getPublicRoomBySlug(slug);
  if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });
  if (room.status !== 'open') {
    return NextResponse.json({ error: 'This room is closed' }, { status: 409 });
  }

  // Once the session model is in use, requests are accepted only while a night is
  // active. Rooms that never started a night stay open (backward-compatible).
  const acceptance = await requestAcceptance(room.id);
  if (!acceptance.ok) {
    return NextResponse.json(
      { error: 'The karaoke night is not open right now. Ask the host to start it.' },
      { status: 409 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = CreateRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  // Prefer a selected search result's videoId; otherwise resolve the manual URL/ID.
  const videoId =
    parsed.data.youtubeVideoId ?? parseYoutubeVideoId(parsed.data.youtubeInput ?? '');
  if (!videoId) {
    return NextResponse.json(
      { error: 'Could not read a YouTube video from that link or ID' },
      { status: 400 },
    );
  }

  const { request, status, activeCount } = await addRequest({
    roomId: room.id,
    guestName: parsed.data.guestName,
    youtubeVideoId: videoId,
    searchQuery: parsed.data.searchQuery,
    youtubeTitle: parsed.data.youtubeTitle,
    youtubeChannelTitle: parsed.data.youtubeChannelTitle,
    youtubeThumbnailUrl: parsed.data.youtubeThumbnailUrl,
    sessionId: acceptance.sessionId,
  });

  // Bounded capability so ONLY this device can later cancel this request.
  const cancelToken = await signCancelCapability(request.id);

  return NextResponse.json(
    {
      ok: true,
      request,
      status,
      activeCount,
      cancelToken,
      // Back-compat scalar; the canonical live number is `status.position`.
      positionInQueue: status.position,
      message: status.isUpNext ? `You're up next` : `You're #${status.position} in the queue`,
    },
    { status: 201 },
  );
}
