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
import { assertPremiumRoomSession } from '@/lib/premium-room-guard.server';
import { resolveRelease } from '@/lib/release-contract.server';
import { CLIENT_UPDATE_REQUIRED_CODE, CLIENT_UPDATE_REQUIRED_KO } from '@/domain/release-contract';
import { premiumRoomRefusalCopy } from '@/domain/premium-room-copy';
import { scheduleLyricsResolve } from '@/lib/lyrics-resolver.server';
import { projectEntitlement } from '@/domain/usage';
import {
  durationBlockCopy,
  publishAdmissionFields,
  upgradeRequiredCopy,
  PASS_INSUFFICIENT_COPY,
} from '@/domain/admission-copy';

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

  // BUILD 26U-R1 (R1-E / R1-F) — THE premium boundary for this operation. Same single
  // authority as /dj/start; this route decides nothing about entitlement itself. On expiry the
  // guard ends the hosted Event through the proven `end_karaoke_event`, which does NOT stop
  // current media — BTY coordination stops, the YouTube video does not.
  // BUILD 26U-R2 — resolve the RELEASE CONTRACT before the entitlement question is asked.
  // A client that cannot be updated (public v1.0 build 109) keeps the pre-R1 behaviour it was
  // approved with; a v1.1 client gets Premium Room. The mode is server-side and the header is
  // client-asserted — see `@/domain/release-contract` for exactly what a caller can influence.
  const release = await resolveRelease(req);
  if (release.contract === 'unsupported') {
    return NextResponse.json(
      { error: CLIENT_UPDATE_REQUIRED_KO, code: CLIENT_UPDATE_REQUIRED_CODE },
      { status: 409, headers: NO_STORE },
    );
  }
  const premium = await assertPremiumRoomSession(auth.room, release.contract);
  if (!premium.ok) {
    return NextResponse.json(
      { error: premiumRoomRefusalCopy(premium.code), code: premium.code },
      { status: 402, headers: NO_STORE },
    );
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
        // BUILD 24-G1 — chosen from the authority's remainingSeconds, not assumed exhaustion.
        // This path has no published charge detail, so the copy degrades to the plain
        // "this song is longer than your remaining time" sentence — still true, just not
        // itemised. It never claims exhaustion while time remains.
        error: upgradeRequiredCopy({ remainingSeconds: projectEntitlement(result.entitlement)?.remainingSeconds }),
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
  // BUILD 23 — the same advance seam can also be refused fail-closed (duration_unavailable /
  // pass_insufficient). It silently reported `promoted: null` for both, which is indistinguishable
  // from "nobody was ready". These fields are additive and present only on those two outcomes.
  let admissionBlock: Record<string, unknown> | null = null;
  if ((action === 'complete' || action === 'skip') && result.outcome === 'ok' && result.from === 'playing') {
    const event = await getCanonicalEvent(auth.room.id);
    const p = await promoteNextReady(auth.room.id, event?.id ?? null);
    if (p.outcome === 'started' && p.request) {
      promoted = { id: p.request.id };
      void scheduleLyricsResolve(auth.room.id, p.request.id);
    } else if (p.outcome === 'upgrade_required') {
      upgradeRequired = true;
      usage = projectEntitlement(p.entitlement);
    } else if (p.outcome === 'duration_unavailable' || p.outcome === 'pass_insufficient') {
      // Parity with /dj/pass-turn: same reason vocabulary, same wording source, same publication
      // allowlist, same request-keyed identity. The terminal transition above already succeeded
      // and is NOT retried; the refused song stays `waiting` + Ready, untouched.
      admissionBlock = {
        reason: p.outcome,
        blockedRequestId: p.nextRequest?.id ?? null,
        message:
          p.outcome === 'pass_insufficient'
            ? PASS_INSUFFICIENT_COPY
            : durationBlockCopy(p.durationFailureReason),
        ...(p.durationFailureReason ? { durationFailureReason: p.durationFailureReason } : {}),
        ...publishAdmissionFields(p),
      };
    }
  }

  return NextResponse.json({
    ok: true,
    request: result.request,
    promoted,
    upgradeRequired,
    usage,
    ...(admissionBlock ?? {}),
  });
}
