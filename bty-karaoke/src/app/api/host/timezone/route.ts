// One-time Host timezone capture (Daily FREE Karaoke Minutes — B1).
//
// POST { timezone } (Host cookie) → the account's IANA timezone for the 4 AM reset
// boundary. The capture is ATOMIC and eligibility-gated in the DB
// (capture_karaoke_account_timezone): it only writes while timezone_source='default'
// AND the account has zero usage segments — so a device-clock change or travel can
// never reset the free window after usage has begun. Idempotent; a plain Host session
// authorizes. No email/subject ever read or returned.

import { NextRequest, NextResponse } from 'next/server';
import { authorizeHost } from '@/lib/host-auth.server';
import { hostTokenFromRequest } from '@/lib/host-web-session.server';
import { captureAccountTimezone } from '@/lib/metering.server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' } as const;

export async function POST(req: NextRequest) {
  const account = await authorizeHost(hostTokenFromRequest(req));
  if (!account) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400, headers: NO_STORE });
  }
  const tz = (body as { timezone?: unknown } | null)?.timezone;
  if (typeof tz !== 'string' || tz.length < 1 || tz.length > 64) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400, headers: NO_STORE });
  }

  // DB validates the IANA name (trigger) + eligibility; returns a stable outcome.
  const { outcome } = await captureAccountTimezone(account.id, tz);
  const status = outcome === 'invalid_timezone' ? 400 : 200;
  return NextResponse.json({ ok: outcome === 'ok', outcome }, { status, headers: NO_STORE });
}
