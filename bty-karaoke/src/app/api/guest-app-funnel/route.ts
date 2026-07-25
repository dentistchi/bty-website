// Guest-to-App web funnel recording (BUILD 19C).
//   POST { eventType, handoffId?, roomSlug?, requestId? } → append-only, privacy-clean.
// Best-effort analytics: always returns ok (never blocks the guest flow); rate-limited.

import { NextRequest, NextResponse } from 'next/server';
import { recordGuestFunnelEvent, isGuestFunnelEvent } from '@/lib/guest-funnel.server';
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
    return NextResponse.json({ ok: false, code: 'INVALID_REQUEST' }, { status: 400 });
  }
  const b = (body ?? {}) as Record<string, unknown>;
  if (!isGuestFunnelEvent(b.eventType)) {
    return NextResponse.json({ ok: false, code: 'INVALID_REQUEST' }, { status: 400 });
  }

  const limiter = await makeLimiter('guest-funnel', ip);
  if (limiter && (await isLockedOut(limiter))) {
    // Silently accept (best-effort) without recording — never surface analytics limits to guests.
    return NextResponse.json({ ok: true }, { status: 202, headers: { 'Cache-Control': 'no-store' } });
  }
  if (limiter) await recordFailure(limiter); // counts toward the ceiling; drops raw IP

  await recordGuestFunnelEvent({
    eventType: b.eventType,
    handoffId: typeof b.handoffId === 'string' ? b.handoffId : null,
    roomSlug: typeof b.roomSlug === 'string' ? b.roomSlug : null,
    requestId: typeof b.requestId === 'string' ? b.requestId : null,
    platform: 'web',
  });

  return NextResponse.json({ ok: true }, { status: 202, headers: { 'Cache-Control': 'no-store' } });
}
