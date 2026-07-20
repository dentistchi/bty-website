// Manager ends an event: mark it ended and end its active night so guests can no
// longer request songs. History/queue is preserved, the current song is NOT
// stopped, and the event is NOT deleted. Idempotent. Manager authority required.

import { NextRequest, NextResponse } from 'next/server';
import { managerEnabled, managerAuthorized } from '@/lib/manager-auth.server';
import { endEvent, publicEvent } from '@/lib/events.server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest, ctx: { params: Promise<{ eventId: string }> }) {
  if (!managerEnabled()) {
    return NextResponse.json({ error: 'Event management is not enabled.' }, { status: 503 });
  }
  if (!(await managerAuthorized(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { eventId } = await ctx.params;
  const ended = await endEvent(eventId);
  if (!ended) return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  return NextResponse.json({ ok: true, event: publicEvent(ended.event), summary: ended.summary });
}
