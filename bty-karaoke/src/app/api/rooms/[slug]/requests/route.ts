// Guest queue API for a room.
//   GET  -> current active queue (waiting + playing)
//   POST -> add a request; returns confirmation + the guest's queue position.

import { NextRequest, NextResponse } from 'next/server';
import { parseYoutubeVideoId } from '@/domain/youtube';
import { CreateRequestSchema } from '@/lib/validation';
import { addRequest, getPublicRoomBySlug, listActiveRequests } from '@/lib/rooms.server';
import { requestAcceptance } from '@/lib/sessions.server';
import { resolveEventAccess, getCanonicalEvent, getLatestEndedEvent } from '@/lib/events.server';
import { signCancelCapability } from '@/lib/capability.server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(_req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const room = await getPublicRoomBySlug(slug);
  if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });
  const live = await getCanonicalEvent(room.id);
  // Queue scoped to the LIVE event's rows (V7.1) — never the room's history. When
  // no Event is live, fall back to the most recent ended Event so the guest screen
  // can show the honest ended state (V7 PART F) instead of a stale request form. A
  // guest read never creates an event — this is a pure lookup. Null only for a
  // legacy room that never had an Event.
  const event = live ?? (await getLatestEndedEvent(room.id));
  const requests = await listActiveRequests(room.id, live?.id ?? null);
  return NextResponse.json(
    {
      room,
      requests,
      event: event ? { id: event.id, name: event.name, status: event.status } : null,
    },
    // V7.1 PART J: the guest screen polls this to detect an End the instant it
    // happens — it must never be served stale from an edge cache.
    { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } },
  );
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const room = await getPublicRoomBySlug(slug);
  if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });
  if (room.status !== 'open') {
    return NextResponse.json({ error: 'This room is closed' }, { status: 409 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Canonical-event gate (V5 + V7): if this room is owned by an event, that one
  // event is the source of truth. The guest screen echoes the event id its QR was
  // scoped to (`eventId`); a mismatch (an old round's QR after rotation) → 403
  // EVENT_MISMATCH, an ended event → 409 EVENT_ENDED. Legacy self-service rooms
  // have no event and send no eventId → this is a no-op (backward compatible).
  const assertedEventId =
    body && typeof body === 'object' && typeof (body as { eventId?: unknown }).eventId === 'string'
      ? (body as { eventId: string }).eventId
      : null;
  const access = await resolveEventAccess(room, assertedEventId);
  if (!access.ok) {
    return NextResponse.json({ error: access.error, code: access.code }, { status: access.status });
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
    // V7.1: permanently tag this request with its Event (access.event is the live
    // event here — an ended one would have been refused above). Null for legacy.
    eventId: access.event?.id ?? null,
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
