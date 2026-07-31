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
import { scheduleLyricsResolve } from '@/lib/lyrics-resolver.server';
import { projectEntitlement } from '@/domain/usage';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' } as const;

/**
 * BUILD 20M-GLOBAL-CUTOVER-R1 — the ONE place that decides which authoritative admission values
 * are safe to publish. Purely additive and camelCase, matching the rest of this response body.
 *
 * A field is emitted ONLY when the admission transaction actually produced it, so an older
 * server payload and a v1 start both simply omit them and older clients are unaffected. Nothing
 * is defaulted to 0 — a missing value must read as "unknown" so the client falls back to its
 * generic copy instead of showing a fabricated number.
 *
 * Deliberately NOT exposed: account id, pass grant id, usage-segment id, charge window,
 * passCovered/passActivated flags, and every other billing or security internal.
 */
function admissionFields(r: {
  leaseEndsAt?: string | null;
  durationSeconds?: number | null;
  requiredChargeSeconds?: number | null;
  remainingSeconds?: number | null;
  passExpiresAt?: string | null;
  finalSongGraceApplied?: boolean;
  finalSongGraceSeconds?: number | null;
  finalSongChargedSeconds?: number | null;
  remainingBeforeSeconds?: number | null;
}): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  if (typeof r.leaseEndsAt === 'string' && r.leaseEndsAt) out.leaseEndsAt = r.leaseEndsAt;
  if (typeof r.durationSeconds === 'number') out.durationSeconds = r.durationSeconds;
  if (typeof r.requiredChargeSeconds === 'number') out.requiredChargeSeconds = r.requiredChargeSeconds;
  if (typeof r.remainingSeconds === 'number') out.remainingSeconds = r.remainingSeconds;
  if (typeof r.passExpiresAt === 'string' && r.passExpiresAt) out.passExpiresAt = r.passExpiresAt;
  // R4 — grace is published ONLY when it actually applied. An ordinary start emits no grace key
  // at all, so older clients and the v1 path see the exact payload they saw before.
  if (r.finalSongGraceApplied === true) {
    out.finalSongGraceApplied = true;
    if (typeof r.finalSongGraceSeconds === 'number') out.finalSongGraceSeconds = r.finalSongGraceSeconds;
    if (typeof r.finalSongChargedSeconds === 'number') out.finalSongChargedSeconds = r.finalSongChargedSeconds;
    if (typeof r.remainingBeforeSeconds === 'number') out.remainingBeforeSeconds = r.remainingBeforeSeconds;
  }
  return out;
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const cred = roomCredentialFromRequest(req);
  if (!cred) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });

  const auth = await authorizeDj(slug, cred);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });

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
          error: '오늘의 무료 이용 시간을 모두 사용했어요. PRO로 업그레이드하면 다음 곡을 지금 시작할 수 있어요.',
          code: 'upgrade_required',
          usage: projectEntitlement(result.entitlement),
          // R1 §D — requiredChargeSeconds is the value actually compared with the remaining
          // time; it is ≤ durationSeconds when an active lease already covers part of the song.
          ...admissionFields(result),
        },
        { status: 402, headers: NO_STORE },
      );
    case 'duration_unavailable':
      // BUILD 20M v2 (allowlist): the video's playback duration could not be resolved. FAIL
      // CLOSED — nothing started, no lease, no handoff. Retryable (transient lookup blip).
      return NextResponse.json(
        { error: '영상 길이를 확인하지 못했어요. 잠시 후 다시 시도해 주세요.', code: 'duration_unavailable' },
        { status: 503, headers: NO_STORE },
      );
    case 'pass_insufficient':
      // BUILD 20M v2: the timed pass cannot cover the whole video (would play past expiry).
      // R1 §C — carry the boundary detail so the client can state it concretely. No account,
      // pass, or segment identifier is exposed.
      return NextResponse.json(
        {
          error: '남은 이용권 시간으로는 이 곡 전체를 재생할 수 없어요.',
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
