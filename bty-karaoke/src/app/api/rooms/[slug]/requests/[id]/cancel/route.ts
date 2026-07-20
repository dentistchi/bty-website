// Guest self-cancel. Ownership is proven by the bounded capability issued at
// submit — NOT by the request id (a guest who only learns an id cannot cancel).
// Capability is verified BEFORE any DB read/mutation. Only a still-`waiting`
// request is cancellable; playing/terminal requests return 409.

import { NextRequest, NextResponse } from 'next/server';
import { CancelRequestSchema } from '@/lib/validation';
import { verifyCancelCapability } from '@/lib/capability.server';
import { getPublicRoomBySlug, cancelOwnRequest } from '@/lib/rooms.server';
import { resolveEventAccess } from '@/lib/events.server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ slug: string; id: string }> },
) {
  const { slug, id } = await ctx.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const parsed = CancelRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed' }, { status: 400 });
  }

  // Ownership check first — no room/queue data touched on failure.
  const owns = await verifyCancelCapability(parsed.data.token, id);
  if (!owns) {
    return NextResponse.json({ error: 'Not allowed to cancel this request' }, { status: 403 });
  }

  const room = await getPublicRoomBySlug(slug);
  if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });

  // Event Lifecycle V1 — an ended Event refuses guest cancel HONESTLY (409
  // EVENT_ENDED) instead of only failing indirectly because the row was already
  // removed by End. Legacy eventless rooms resolve ok (event: null) → unchanged.
  const access = await resolveEventAccess(room);
  if (!access.ok) {
    return NextResponse.json({ error: access.error, code: access.code }, { status: access.status });
  }

  const result = await cancelOwnRequest(room.id, id);
  if (result.outcome === 'not_found') {
    return NextResponse.json({ error: 'Request not found' }, { status: 404 });
  }
  if (result.outcome === 'not_cancellable') {
    return NextResponse.json(
      { error: `This request can no longer be cancelled (${result.from}).` },
      { status: 409 },
    );
  }
  return NextResponse.json({ ok: true, status: result.status });
}
