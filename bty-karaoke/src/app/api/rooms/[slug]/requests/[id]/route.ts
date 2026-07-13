// DJ actions on a single request. Credential-gated via the Authorization
// header (never the URL/query/body). PATCH { action: 'play'|'complete'|'skip' }.

import { NextRequest, NextResponse } from 'next/server';
import { DjActionSchema } from '@/lib/validation';
import { bearerFromHeader } from '@/lib/dj-auth.server';
import {
  authorizeDj,
  getGuestQueueStatus,
  getPublicRoomBySlug,
  setRequestStatus,
  moveToNextWaiting,
} from '@/lib/rooms.server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Guest-facing live status for one request. Public (no DJ credential): returns
// ONLY the compact position model for this single request — never the full
// queue, other guests' data, or any room/DJ internals.
export async function GET(_req: NextRequest, ctx: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await ctx.params;
  const room = await getPublicRoomBySlug(slug);
  if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });

  const status = await getGuestQueueStatus(room.id, id);
  if (!status) return NextResponse.json({ error: 'Request not found' }, { status: 404 });

  return NextResponse.json({ status });
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ slug: string; id: string }> },
) {
  const { slug, id } = await ctx.params;

  const cred = bearerFromHeader(req.headers.get('authorization'));
  if (!cred) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = DjActionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed' }, { status: 400 });
  }

  const auth = await authorizeDj(slug, cred);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const action = parsed.data.action;
  // 'move_next' (먼저 부르기) is a reorder; the rest are status transitions.
  const result =
    action === 'move_next'
      ? await moveToNextWaiting(auth.room.id, id)
      : await setRequestStatus(auth.room.id, id, action);

  if (result.outcome === 'not_found') {
    return NextResponse.json({ error: 'Request not found in this room' }, { status: 404 });
  }
  if (result.outcome === 'invalid') {
    return NextResponse.json(
      { error: `Cannot ${action} a request that is '${result.from}'` },
      { status: 409 },
    );
  }

  return NextResponse.json({ ok: true, request: result.request });
}
