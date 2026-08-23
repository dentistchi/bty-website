// V9.0 — ensure-playing transaction. The "▶ 다음 곡 재생" flow calls this for the FIRST
// song of the event (nothing playing yet): it idempotently makes the target request
// the canonical `playing` stage (so Display + Personal Player show NOW SINGING) before
// the client opens the video. Success when the song was newly started, is already the
// active stage, or auto-promotion already put it there — never a false "Could not
// start". (Once a song is playing, "다음 곡 재생" uses /dj/pass-turn instead: complete +
// promote next.) Flips BTY state only; never controls YouTube. Admin/DJ authed,
// event-gated. POST { requestId }.

import { NextRequest, NextResponse } from 'next/server';
import { roomCredentialFromRequest } from '@/lib/dj-auth.server';
import { authorizeDj, ensurePlaying } from '@/lib/rooms.server';
import { getCanonicalEvent, resolveEventAccess } from '@/lib/events.server';
import { assertPremiumRoomSession } from '@/lib/premium-room-guard.server';
import { resolveRoomRelease } from '@/lib/release-contract.server';
import { CLIENT_UPDATE_REQUIRED_CODE, CLIENT_UPDATE_REQUIRED_KO } from '@/domain/release-contract';
import { premiumRoomRefusalCopy } from '@/domain/premium-room-copy';
import { scheduleLyricsResolve } from '@/lib/lyrics-resolver.server';
import { projectEntitlement } from '@/domain/usage';
import {
  durationBlockCopy,
  publishAdmissionFields as admissionFields,
  upgradeRequiredCopy,
  PASS_INSUFFICIENT_COPY,
} from '@/domain/admission-copy';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' } as const;

// BUILD 23 — the publication allowlist (BUILD 20M-GLOBAL-CUTOVER-R1) and the fail-closed block
// wording (BUILD 21) moved VERBATIM into `@/domain/admission-copy`, because the auto-advance path
// must now say the same sentences and publish the same approved subset. Nothing about this route's
// behaviour changed: same fields, same omission rules, same Korean text, same fallbacks.
// A route must never import another route's private constants — hence a shared pure module.

export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const cred = roomCredentialFromRequest(req);
  if (!cred) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });

  const auth = await authorizeDj(slug, cred);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });


  // BUILD 26U-R1 (R1-E / R1-F) — THE premium boundary for this operation. One call, one
  // authority; this route decides nothing about entitlement itself.
  //
  // When the session's time has run out the guard ends the hosted Event through the proven
  // `end_karaoke_event` — WAITING -> removed, PLAYING -> skipped, event -> ended, the room is
  // NOT closed and **current media is NOT stopped**. So BTY coordination stops here while the
  // YouTube video a singer is watching keeps playing, and nothing about this refusal reaches a
  // playback path: the free Search -> Open on YouTube route never calls this route at all.
  // BUILD 26U-R2 — resolve the RELEASE CONTRACT before the entitlement question is asked.
  // A client that cannot be updated (public v1.0 build 109) keeps the pre-R1 behaviour it was
  // approved with; a v1.1 client gets Premium Room. The mode is server-side and the header is
  // client-asserted — see `@/domain/release-contract` for exactly what a caller can influence.
  const release = await resolveRoomRelease(req, auth.room.id);
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

  // Event-gated: an ended event returns a precise "이 이벤트가 종료되었습니다." message.
  const access = await resolveEventAccess(auth.room);
  if (!access.ok) {
    return NextResponse.json(
      { error: '이 이벤트가 종료되었습니다.', code: access.code },
      { status: access.status, headers: NO_STORE },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400, headers: NO_STORE });
  }
  const requestId = (body as { requestId?: unknown }).requestId;
  if (typeof requestId !== 'string' || !requestId) {
    return NextResponse.json({ error: 'requestId is required' }, { status: 400, headers: NO_STORE });
  }

  const live = await getCanonicalEvent(auth.room.id);
  const result = await ensurePlaying(auth.room.id, requestId, live?.id ?? null);

  switch (result.outcome) {
    case 'started':
      // Newly on stage → resolve its lyrics server-side, in the background.
      void scheduleLyricsResolve(auth.room.id, requestId);
      return NextResponse.json(
        { ok: true, request: result.request ?? null, code: 'started', ...admissionFields(result) },
        { headers: NO_STORE },
      );
    case 'already_active':
      // Auto-promotion (or a prior tap) already made it the stage — that is success.
      // R1: report the lease ALREADY in force, so a retry / response-loss recovery does not
      // lose lease visibility. Nothing new is created to populate it.
      return NextResponse.json(
        { ok: true, request: result.request ?? null, code: 'already_active', ...admissionFields(result) },
        { headers: NO_STORE },
      );
    case 'upgrade_required':
      // FREE daily minutes exhausted (enforcement on). Nothing was started — surface
      // the canonical upgrade_required with the truthful usage snapshot.
      return NextResponse.json(
        {
          // BUILD 24-G1 — `upgrade_required` covers BOTH "no time left" and "time left, but this
          // song is longer than it". The wording is now chosen from the authority's own
          // remainingSeconds instead of assuming exhaustion. Presentation only.
          error: upgradeRequiredCopy(result),
          code: 'upgrade_required',
          usage: projectEntitlement(result.entitlement),
          // R1 §D — requiredChargeSeconds is the value actually compared with the remaining
          // time; it is ≤ durationSeconds when an active lease already covers part of the song.
          ...admissionFields(result),
        },
        { status: 402, headers: NO_STORE },
      );
    case 'duration_unavailable': {
      // BUILD 20M v2: the video's playback duration could not be resolved. FAIL CLOSED —
      // nothing started, no lease, no handoff.
      // BUILD 21: `code` and the 503 status are FROZEN (an older client keys on them and must
      // keep working), while `reason` is additive and emitted only when the resolver actually
      // classified one — so an unclassified block is byte-identical to the shipped response.
      const reason = result.durationFailureReason;
      return NextResponse.json(
        {
          error: durationBlockCopy(reason),
          code: 'duration_unavailable',
          ...(reason ? { reason } : {}),
        },
        { status: 503, headers: NO_STORE },
      );
    }
    case 'pass_insufficient':
      // BUILD 20M v2: the timed pass cannot cover the whole video (would play past expiry).
      // R1 §C — carry the boundary detail so the client can state it concretely. No account,
      // pass, or segment identifier is exposed.
      return NextResponse.json(
        {
          error: PASS_INSUFFICIENT_COPY,
          code: 'pass_insufficient',
          ...admissionFields(result),
        },
        { status: 402, headers: NO_STORE },
      );
    case 'conflict':
      return NextResponse.json(
        { error: '다른 곡이 현재 재생 중입니다.', code: 'conflict', playing: result.playing ?? null },
        { status: 409, headers: NO_STORE },
      );
    case 'not_ready':
      return NextResponse.json(
        { error: '재생 상태를 변경하지 못했습니다.', code: 'not_ready' },
        { status: 409, headers: NO_STORE },
      );
    case 'not_found':
      return NextResponse.json(
        { error: '이 신청곡을 찾을 수 없습니다.', code: 'not_found' },
        { status: 404, headers: NO_STORE },
      );
  }
}
