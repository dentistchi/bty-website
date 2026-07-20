// DJ reorders the WAITING queue. Credential-gated via the Authorization header
// (paired DJ/Admin device OR the legacy master credential — same boundary as
// every other DJ action). Body: { orderedRequestIds: string[] } in the DJ's
// desired order. The atomic RPC re-validates every id against the live waiting
// set (room-scoped), so a stale/cross-room/started id can never move a row.

import { NextRequest, NextResponse } from 'next/server';
import { ReorderQueueSchema } from '@/lib/validation';
import { roomCredentialFromRequest } from '@/lib/dj-auth.server';
import { authorizeDj, reorderWaitingRequests } from '@/lib/rooms.server';
import { resolveEventAccess } from '@/lib/events.server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;

  const cred = roomCredentialFromRequest(req);
  if (!cred) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = ReorderQueueSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed' }, { status: 400 });
  }

  // Authorize AFTER shape validation but before any DB work.
  const auth = await authorizeDj(slug, cred);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Event Lifecycle V1 — an ended Event refuses reorder HONESTLY (409 EVENT_ENDED)
  // rather than only failing indirectly once its rows are already removed. A legacy
  // eventless room resolves ok (event: null) so V4 self-service is untouched.
  const access = await resolveEventAccess(auth.room);
  if (!access.ok) {
    return NextResponse.json({ error: access.error, code: access.code }, { status: access.status });
  }

  const result = await reorderWaitingRequests(auth.room.id, parsed.data.orderedRequestIds);

  if (result.outcome === 'queue_changed') {
    // A listed song is no longer waiting (started/removed) or wasn't in this room.
    return NextResponse.json(
      { error: 'Queue changed. Refreshing to the latest order.', code: 'QUEUE_CHANGED' },
      { status: 409 },
    );
  }
  if (result.outcome === 'invalid' || result.outcome === 'empty') {
    return NextResponse.json({ error: 'Invalid reorder request' }, { status: 400 });
  }

  return NextResponse.json({ ok: true, requests: result.requests });
}
