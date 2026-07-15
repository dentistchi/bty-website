// Guest self-service FINISH. Only the owner of the CURRENTLY PLAYING request can
// end it. Ownership is proven by the bounded capability (NOT the request id); the
// transition is atomic + status-guarded so a double-tap settles idempotently.
// After it completes, the next waiting guest becomes first on their next poll.

import { NextRequest, NextResponse } from 'next/server';
import { OwnerActionSchema } from '@/lib/validation';
import { verifyOwnerCapability } from '@/lib/capability.server';
import { getPublicRoomBySlug, finishOwnRequest } from '@/lib/rooms.server';

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

  // Ownership check FIRST — a guest can never finish someone else's song.
  const owns = await verifyOwnerCapability(parsed.data.token, id);
  if (!owns) {
    return NextResponse.json(
      { error: 'Not allowed to finish this song', code: 'NOT_YOUR_REQUEST' },
      { status: 403, headers: NO_STORE },
    );
  }

  const room = await getPublicRoomBySlug(slug);
  if (!room) {
    return NextResponse.json({ error: 'Room not found' }, { status: 404, headers: NO_STORE });
  }

  const result = await finishOwnRequest(room.id, id);
  switch (result.outcome) {
    case 'ok':
    case 'already_done': // idempotent — a double finish is a success, not an error
      return NextResponse.json({ ok: true }, { headers: NO_STORE });
    case 'not_playing':
      return NextResponse.json(
        { error: 'This song is not playing', code: 'REQUEST_NOT_PLAYING' },
        { status: 409, headers: NO_STORE },
      );
    case 'not_found':
      return NextResponse.json(
        { error: 'Request not found', code: 'REQUEST_NOT_FOUND' },
        { status: 404, headers: NO_STORE },
      );
  }
}
