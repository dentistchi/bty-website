// Guest-to-App handoff resolution (BUILD 19B).
//   GET /api/guest-app-handoffs/{opaque_token} → Guest-safe navigation data, or a typed
//   ended/expired/invalid result. Invalid/expired/revoked never reveal Room/Event existence.
//   Reopenable + idempotent: repeated resolution creates no durable duplicate.

import { NextRequest, NextResponse } from 'next/server';
import { resolveGuestAppHandoff } from '@/lib/guest-handoff.server';
import { makeLimiter, isLockedOut, recordFailure } from '@/lib/rate-limit.server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const ip =
    req.headers.get('cf-connecting-ip') ??
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    '0.0.0.0';

  // Rate limit resolution — especially invalid-token guessing — keyed by pseudonymized IP.
  const limiter = await makeLimiter('handoff-resolve', ip);
  if (limiter && (await isLockedOut(limiter))) {
    return NextResponse.json({ resolution: 'invalid' }, { status: 429, headers: { 'Cache-Control': 'no-store' } });
  }

  const noStore = { 'Cache-Control': 'no-store' };
  if (!token || token.length < 8) {
    if (limiter) await recordFailure(limiter);
    return NextResponse.json({ resolution: 'invalid' }, { status: 404, headers: noStore });
  }

  const result = await resolveGuestAppHandoff(token);

  switch (result.resolution) {
    case 'active':
    case 'event_ended':
      return NextResponse.json(
        {
          resolution: result.resolution,
          handoffId: result.nav.handoffId,
          roomSlug: result.nav.roomSlug,
          roomDisplayName: result.nav.roomDisplayName,
          eventId: result.nav.eventId,
          eventStatus: result.nav.eventStatus,
          expiresAt: result.nav.expiresAt,
        },
        { status: 200, headers: noStore },
      );
    case 'expired':
    case 'revoked':
    case 'invalid':
    default:
      // Generic result — no Room/Event existence signal, no distinct error detail. A soft 404
      // for all three so timing/status can't be used to enumerate valid tokens.
      if (result.resolution === 'invalid' && limiter) await recordFailure(limiter);
      return NextResponse.json({ resolution: result.resolution }, { status: 404, headers: noStore });
  }
}
