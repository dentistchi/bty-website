// A Host's Timed Access Pass inventory + effective state (BUILD 17).
//
// GET (web cookie OR native Bearer host session) -> { ok, state, passes }
//   state = { basePlan, effectiveEntitlement, activePass, selectedPass } (server truth);
//   passes = the account's full grant inventory (AVAILABLE/SELECTED/ACTIVE/EXPIRED/REVOKED).
//
// The account is ALWAYS derived server-side from the session; accountId is never read from
// the request, so one Host can never see another's passes. no-store; uniform 401.

import { NextRequest, NextResponse } from 'next/server';
import { bearerFromHeader } from '@/lib/dj-auth.server';
import { authorizeHost } from '@/lib/host-auth.server';
import { hostTokenFromRequest } from '@/lib/host-web-session.server';
import { getHostTimedPassInventory } from '@/lib/timed-pass.server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' } as const;

async function account(req: NextRequest) {
  const token = bearerFromHeader(req.headers.get('authorization')) ?? hostTokenFromRequest(req);
  return authorizeHost(token);
}

export async function GET(req: NextRequest) {
  const acct = await account(req);
  if (!acct) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });

  const { state, passes } = await getHostTimedPassInventory(acct.id);
  return NextResponse.json({ ok: true, state, passes }, { headers: NO_STORE });
}
