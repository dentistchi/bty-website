// Guest queue API for a room.
//   GET  -> current active queue (waiting + playing)
//   POST -> add a request; returns confirmation + the guest's queue position.

import { NextRequest, NextResponse } from 'next/server';
import { parseYoutubeVideoId } from '@/domain/youtube';
import { CreateRequestSchema } from '@/lib/validation';
import {
  addRequest,
  getPublicRoomBySlug,
  hasExistingRequestForKey,
  listActiveRequests,
  toGuestPublicRequest,
} from '@/lib/rooms.server';
import { resolveRawVideoDuration } from '@/lib/youtube-duration.server';
import {
  classifyDurationAdmission,
  MAX_REQUESTABLE_DURATION_SECONDS,
} from '@/domain/duration-admission';
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
      // BUILD 20M-SERVER-R3.1A — explicit Guest-safe projection. The raw row carries
      // idempotency_key / session_id / room_id and must NEVER reach a public reader
      // (harvesting the key turned the 18B replay into an ownership oracle).
      requests: requests.map(toGuestPublicRequest),
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
  // BUILD 18B: every failure carries a STABLE machine-readable `code` so the guest client
  // classifies retryable vs non-retryable without parsing human/HTTP strings.
  if (!room) return NextResponse.json({ error: 'Room not found', code: 'ROOM_NOT_FOUND' }, { status: 404 });
  if (room.status !== 'open') {
    return NextResponse.json({ error: 'This room is closed', code: 'ROOM_CLOSED' }, { status: 409 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body', code: 'INVALID_REQUEST' }, { status: 400 });
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
      {
        error: 'The karaoke night is not open right now. Ask the host to start it.',
        code: 'NIGHT_NOT_OPEN',
      },
      { status: 409 },
    );
  }

  const parsed = CreateRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', code: 'INVALID_REQUEST', issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  // Prefer a selected search result's videoId; otherwise resolve the manual URL/ID.
  const videoId =
    parsed.data.youtubeVideoId ?? parseYoutubeVideoId(parsed.data.youtubeInput ?? '');
  if (!videoId) {
    return NextResponse.json(
      { error: 'Could not read a YouTube video from that link or ID', code: 'INVALID_REQUEST' },
      { status: 400 },
    );
  }

  // ── BUILD 22 — PRE-QUEUE SONG DURATION ADMISSION ──────────────────────────────────────────
  //
  // The 900-second playback bound used to be enforced ONLY inside the Host Start transaction, so
  // a Guest could be confirmed into the queue for a video that can never play and would not find
  // out — the block surfaced minutes later, to the Host, on another device. This is the earliest
  // point at which the request is known to be authentic, authorized, event-valid, well-formed,
  // and NEW; it is therefore the earliest point at which a lookup is legitimate.
  //
  // ORDER IS THE CONTRACT. Everything above already rejected unauthorized, closed-room,
  // ended-event, night-not-open, and malformed submissions, so none of those can reach an
  // external call — the endpoint cannot be used as an unauthenticated YouTube lookup proxy.
  //
  // An 18B replay is resolved as a replay: if this key already holds a row, the song was
  // admitted when it was created and is NOT re-adjudicated. Re-checking it would make an
  // accepted request retroactively rejectable by a later provider outage, and would spend quota
  // on every retry of a request that already exists.
  const isReplay = parsed.data.idempotencyKey
    ? await hasExistingRequestForKey(room.id, access.event?.id ?? null, parsed.data.idempotencyKey)
    : false;

  if (!isReplay) {
    const raw = await resolveRawVideoDuration(videoId);
    // FAIL OPEN on anything that is not a positively-established length. Quota exhaustion, a
    // network failure, a deleted video, an unparseable payload — none of these are "too long",
    // and blocking on them would let one YouTube outage stop every Guest in every room from
    // requesting anything. The Host Start gate stays the final, fail-CLOSED defense.
    const admission = classifyDurationAdmission(raw.ok ? raw.seconds : null);
    if (admission === 'too_long') {
      return NextResponse.json(
        {
          // Action-first and honest about permanence: this video will never become requestable,
          // so the copy names the limit and points at the remedy instead of inviting a retry.
          error: '이 영상은 15분을 초과해 신청할 수 없어요. 더 짧은 버전을 선택해 주세요.',
          // 400 + a stable code. An older client that does not know `song_too_long` falls through
          // its `status === 400` branch to `validation` → NON-RETRYABLE with re-pick copy, which
          // is already the correct instruction. That is what makes a server-first deploy safe.
          code: 'song_too_long',
          reason: 'too_long',
          durationSeconds: raw.ok ? raw.seconds : null,
          maxDurationSeconds: MAX_REQUESTABLE_DURATION_SECONDS,
        },
        { status: 400 },
      );
      // NOTHING is written: no request row, no queue position, no ready state, no session
      // mutation, no cancel capability. The next statement is the only insert in this route.
    }
  }

  const result = await addRequest({
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
    // BUILD 18B: replay-safe when present (the client mints one key per logical request
    // and reuses it on every timeout/retry).
    idempotencyKey: parsed.data.idempotencyKey,
  });

  // The same key reused for a DIFFERENT song/guest is never a silent success.
  if (result.outcome === 'conflict') {
    return NextResponse.json(
      {
        error: 'This request key was already used for a different song.',
        code: 'IDEMPOTENCY_CONFLICT',
      },
      { status: 409 },
    );
  }

  const { request, status, activeCount } = result;
  // Bounded capability so ONLY this device can later cancel this request.
  const cancelToken = await signCancelCapability(request.id);

  return NextResponse.json(
    {
      ok: true,
      // `replayed` lets the client know a retry recovered the SAME row (no duplicate).
      replayed: result.outcome === 'replayed',
      // Same Guest-safe projection as the GET. The submitter already knows their own
      // key, but a REPLAY returns the matching row — which on this public route must
      // never carry that row's internal columns back out.
      request: toGuestPublicRequest(request),
      status,
      activeCount,
      cancelToken,
      // Back-compat scalar; the canonical live number is `status.position`.
      positionInQueue: status.position,
      message: status.isUpNext ? `You're up next` : `You're #${status.position} in the queue`,
    },
    // A replay returns 200 (already existed); a fresh insert returns 201.
    { status: result.outcome === 'replayed' ? 200 : 201 },
  );
}
