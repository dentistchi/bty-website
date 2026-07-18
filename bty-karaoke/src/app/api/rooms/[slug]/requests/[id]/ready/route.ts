// Guest READY signal (V6 single Admin Player). The guest says "I'm ready" from
// their phone; the ONE Admin Player reads it and starts the song on the TV. Ready
// is NOT playback — it only sets a shared `ready_at` on the still-waiting request
// (never opens YouTube, never calls the start RPC, never occupies the stage).
// Ownership is proven by the same bounded capability issued at submit.

import { NextRequest, NextResponse } from 'next/server';
import { OwnerActionSchema } from '@/lib/validation';
import { verifyOwnerCapability } from '@/lib/capability.server';
import { getPublicRoomBySlug, setRequestReady, getGuestQueueStatus } from '@/lib/rooms.server';
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

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400, headers: NO_STORE });
  }
  const parsed = OwnerActionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed' }, { status: 400, headers: NO_STORE });
  }
  // `ready: false` clears the signal ("Not yet"); default is to set it.
  const ready = (body as { ready?: unknown }).ready !== false;

  const owns = await verifyOwnerCapability(parsed.data.token, id);
  if (!owns) {
    return NextResponse.json(
      { error: 'Not allowed', code: 'NOT_YOUR_REQUEST' },
      { status: 403, headers: NO_STORE },
    );
  }

  const room = await getPublicRoomBySlug(slug);
  if (!room) {
    return NextResponse.json({ error: 'Room not found' }, { status: 404, headers: NO_STORE });
  }

  // V7 PART I — the ready signal is only meaningful while the Event is live. Once
  // ended, refuse honestly (the request is already removed anyway).
  const access = await resolveEventAccess(room);
  if (!access.ok) {
    return NextResponse.json(
      { error: access.error, code: access.code },
      { status: access.status, headers: NO_STORE },
    );
  }

  const result = await setRequestReady(room.id, id, ready);
  switch (result.outcome) {
    case 'ok': {
      // V1.1 manual-first: Ready ONLY sets the shared `ready_at` signal — it NEVER
      // starts a song. Auto-starting the first Ready song on the readiness update
      // (the V8 autopilot) made music begin before any operator action. The operator
      // now explicitly starts the first song (dj/start); automatic promotion happens
      // only as the continuation of finishing a playing song. `autoStarted` is kept in
      // the response shape (always false) so existing guest clients stay compatible.
      const status = await getGuestQueueStatus(room.id, id);
      return NextResponse.json(
        { ok: true, ready, autoStarted: false, status: status?.state ?? null, position: status?.position ?? null },
        { headers: NO_STORE },
      );
    }
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
