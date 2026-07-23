// DJ actions on a single request. Credential-gated via the Authorization
// header (never the URL/query/body). PATCH { action: 'play'|'complete'|'skip' }.

import { NextRequest, NextResponse } from 'next/server';
import { DjActionSchema } from '@/lib/validation';
import { roomCredentialFromRequest } from '@/lib/dj-auth.server';
import {
  authorizeDj,
  getGuestQueueStatus,
  getPublicRoomBySlug,
  setRequestStatus,
  moveToNextWaiting,
  promoteNextReady,
} from '@/lib/rooms.server';
import { getCanonicalEvent, resolveEventAccess } from '@/lib/events.server';
import { scheduleLyricsResolve } from '@/lib/lyrics-resolver.server';
import { projectEntitlement } from '@/domain/usage';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

// A guest's live queue position is real-time operational state — it must NEVER be
// served from any cache (browser, CDN, or Next). force-dynamic + revalidate=0 stop
// Next/route caching; this explicit header stops every intermediary too, so a
// DJ reorder shows up on the guest's very next 4s poll.
const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' } as const;

// Guest-facing live status for one request. Public (no DJ credential): returns
// ONLY the compact position model for this single request — never the full
// queue, other guests' data, or any room/DJ internals.
export async function GET(_req: NextRequest, ctx: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await ctx.params;
  const room = await getPublicRoomBySlug(slug);
  if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404, headers: NO_STORE });

  const status = await getGuestQueueStatus(room.id, id);
  if (!status) return NextResponse.json({ error: 'Request not found' }, { status: 404, headers: NO_STORE });

  return NextResponse.json({ status }, { headers: NO_STORE });
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ slug: string; id: string }> },
) {
  const { slug, id } = await ctx.params;

  const cred = roomCredentialFromRequest(req);
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

  // Event Lifecycle V1 — an ended Event refuses every DJ transition (play/complete/
  // skip/move_next) HONESTLY (409 EVENT_ENDED) instead of only failing once the row
  // is already terminal. Legacy eventless rooms resolve ok (event: null).
  const access = await resolveEventAccess(auth.room);
  if (!access.ok) {
    return NextResponse.json({ error: access.error, code: access.code }, { status: access.status });
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
  // B2: a manual play blocked by the FREE daily limit. Nothing mutated — return the
  // canonical upgrade_required with the truthful usage snapshot so the Admin can render
  // the zero-time / upgrade state (never a generic "invalid").
  if (result.outcome === 'upgrade_required') {
    return NextResponse.json(
      {
        error: '오늘의 무료 이용 시간을 모두 사용했어요. PRO로 업그레이드하면 다음 곡을 지금 시작할 수 있어요.',
        code: 'upgrade_required',
        usage: projectEntitlement(result.entitlement),
      },
      { status: 402 },
    );
  }
  if (result.outcome === 'invalid') {
    return NextResponse.json(
      { error: `Cannot ${action} a request that is '${result.from}'` },
      { status: 409 },
    );
  }

  // Legacy play path: the song is now on stage → resolve its lyrics in the background.
  if (action === 'play' && result.outcome === 'ok') void scheduleLyricsResolve(auth.room.id, id);

  // V8.1 AUTOPILOT — whenever the PLAYING song leaves the stage (complete or skip;
  // a playing song can only leave the stage via these — `remove` is waiting-only),
  // the system advances: auto-start the earliest READY waiting song. Same promotion
  // seam as Finish (pass-turn), so every terminal transition agrees. Only when the
  // row was actually `playing` (a waiting-song skip never promotes).
  let promoted: { id: string } | null = null;
  // B2 auto-next boundary: when the FREE limit blocks the next start, the current song
  // has ALREADY been closed above (§8 — current is never force-stopped, it completed
  // normally). We do NOT start the next song, leave it waiting/ready, and surface the
  // upgrade state + usage so the Admin sees why nothing auto-started.
  let upgradeRequired = false;
  let usage: ReturnType<typeof projectEntitlement> = null;
  if ((action === 'complete' || action === 'skip') && result.outcome === 'ok' && result.from === 'playing') {
    const event = await getCanonicalEvent(auth.room.id);
    const p = await promoteNextReady(auth.room.id, event?.id ?? null);
    if (p.outcome === 'started' && p.request) {
      promoted = { id: p.request.id };
      void scheduleLyricsResolve(auth.room.id, p.request.id);
    } else if (p.outcome === 'upgrade_required') {
      upgradeRequired = true;
      usage = projectEntitlement(p.entitlement);
    }
  }

  return NextResponse.json({ ok: true, request: result.request, promoted, upgradeRequired, usage });
}
