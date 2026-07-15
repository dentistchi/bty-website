// Guest self-service START. The NEXT singer starts their OWN song from their
// phone — no DJ required. Ownership is proven by the bounded capability issued
// at submit (NOT the request id); the QUEUE rules (must be the first waiting
// song, stage must be open) are enforced atomically by the advisory-locked
// start RPC. Two guests tapping at once → exactly one winner.

import { NextRequest, NextResponse } from 'next/server';
import { OwnerActionSchema } from '@/lib/validation';
import { verifyOwnerCapability } from '@/lib/capability.server';
import { getPublicRoomBySlug, startOwnRequest } from '@/lib/rooms.server';

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

  // Ownership check FIRST — no room/queue data touched on failure.
  const owns = await verifyOwnerCapability(parsed.data.token, id);
  if (!owns) {
    return NextResponse.json(
      { error: 'Not allowed to start this song', code: 'NOT_YOUR_REQUEST' },
      { status: 403, headers: NO_STORE },
    );
  }

  const room = await getPublicRoomBySlug(slug);
  if (!room) {
    return NextResponse.json({ error: 'Room not found' }, { status: 404, headers: NO_STORE });
  }

  const result = await startOwnRequest(room.id, id);
  switch (result.outcome) {
    case 'ok':
      return NextResponse.json(
        { ok: true, request: result.request, status: result.status },
        { headers: NO_STORE },
      );
    case 'not_found':
      return NextResponse.json(
        { error: 'Request not found', code: 'REQUEST_NOT_FOUND' },
        { status: 404, headers: NO_STORE },
      );
    case 'not_waiting':
      return NextResponse.json(
        { error: 'This song can no longer be started', code: 'REQUEST_NOT_WAITING' },
        { status: 409, headers: NO_STORE },
      );
    case 'not_next':
      return NextResponse.json(
        { error: 'It is not your turn yet', code: 'NOT_NEXT' },
        { status: 409, headers: NO_STORE },
      );
    case 'already_playing':
      return NextResponse.json(
        { error: 'Another song is playing right now', code: 'ALREADY_PLAYING' },
        { status: 409, headers: NO_STORE },
      );
  }
}
