// Guest-to-App handoff creation (BUILD 19B).
//   POST { roomSlug, requestId } → issues (or idempotently returns) the canonical handoff
//   for a SUCCESSFUL guest request. The raw token + Universal Link are returned ONLY on the
//   first mint; a replay returns the stable handoffId with no second token. Navigation
//   authority only — no Host/Manager authority, no request/Event/Room mutation.

import { NextRequest, NextResponse } from 'next/server';
import { createGuestAppHandoff } from '@/lib/guest-handoff.server';
import { canonicalUniversalLink } from '@/domain/app-link';
import { makeLimiter, isLockedOut, recordFailure } from '@/lib/rate-limit.server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get('cf-connecting-ip') ??
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    '0.0.0.0';

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body', code: 'INVALID_REQUEST' }, { status: 400 });
  }
  const roomSlug = typeof (body as { roomSlug?: unknown })?.roomSlug === 'string' ? (body as { roomSlug: string }).roomSlug : '';
  const requestId = typeof (body as { requestId?: unknown })?.requestId === 'string' ? (body as { requestId: string }).requestId : '';
  if (!roomSlug || !requestId) {
    return NextResponse.json({ error: 'roomSlug and requestId are required', code: 'INVALID_REQUEST' }, { status: 400 });
  }

  // Best-effort rate limit keyed by (room, pseudonymized IP). Never logs the raw token/IP.
  const limiter = await makeLimiter(`handoff-create:${roomSlug}`, ip);
  if (limiter && (await isLockedOut(limiter))) {
    return NextResponse.json({ error: 'Too many requests', code: 'RATE_LIMITED' }, { status: 429 });
  }

  const result = await createGuestAppHandoff({ roomSlug, requestId });
  if (!result.ok) {
    if (limiter) await recordFailure(limiter);
    const status = result.code === 'ROOM_NOT_FOUND' || result.code === 'REQUEST_NOT_FOUND' ? 404 : 409;
    return NextResponse.json({ error: 'Handoff could not be created', code: result.code }, { status });
  }

  const { handoffId, expiresAt, token, replayed } = result.creation;
  // The Universal Link is emitted ONLY on first mint (token present). It is built from the FIXED
  // canonical origin (norebang.btydaily.com — the app's applinks host), NEVER req.nextUrl.origin /
  // Host / X-Forwarded-Host — otherwise a workers.dev-origin request would return a link iOS can't
  // intercept. Fails closed: if the canonical link can't be built, no url is emitted (never a
  // non-canonical link), and the client simply doesn't surface the app-open action.
  const url = token ? (canonicalUniversalLink(token) ?? undefined) : undefined;

  return NextResponse.json(
    { ok: true, handoffId, expiresAt, replayed, ...(url ? { url } : {}) },
    { status: replayed ? 200 : 201, headers: { 'Cache-Control': 'no-store' } },
  );
}
