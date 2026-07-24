// A Host SELECTS a Timed Access Pass to use (BUILD 17).
//
// POST (web cookie OR native Bearer host session) { passGrantId, idempotencyKey? }
//   -> mark an AVAILABLE pass SELECTED (any prior SELECTED reverts to AVAILABLE), through
//   the atomic select RPC. Selection sets NO activated_at and starts NO countdown — the
//   clock begins only when the first song's server lifecycle transition commits. Returns
//   the refreshed inventory + state.
//
// The account is ALWAYS derived server-side from the session; passGrantId must belong to
// that account (the RPC scopes by account_id). no-store; uniform 401.

import { NextRequest, NextResponse } from 'next/server';
import { bearerFromHeader } from '@/lib/dj-auth.server';
import { authorizeHost } from '@/lib/host-auth.server';
import { hostTokenFromRequest } from '@/lib/host-web-session.server';
import { SelectTimedPassSchema } from '@/lib/validation';
import { selectTimedPass, getHostTimedPassInventory } from '@/lib/timed-pass.server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' } as const;

async function account(req: NextRequest) {
  const token = bearerFromHeader(req.headers.get('authorization')) ?? hostTokenFromRequest(req);
  return authorizeHost(token);
}

export async function POST(req: NextRequest) {
  const acct = await account(req);
  if (!acct) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400, headers: NO_STORE });
  }
  const parsed = SelectTimedPassSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400, headers: NO_STORE });
  }

  const outcome = await selectTimedPass({
    accountId: acct.id,
    passGrantId: parsed.data.passGrantId,
    idempotencyKey: parsed.data.idempotencyKey ?? null,
  });

  if (!outcome.ok) {
    if (outcome.error === 'pass_not_found') {
      return NextResponse.json({ ok: false, error: 'pass_not_found' }, { status: 404, headers: NO_STORE });
    }
    if (outcome.error === 'not_selectable') {
      // A REVOKED/EXPIRED/ACTIVE pass cannot be selected.
      return NextResponse.json(
        { ok: false, error: 'not_selectable', status: outcome.status },
        { status: 409, headers: NO_STORE },
      );
    }
    return NextResponse.json({ error: 'Invalid request' }, { status: 400, headers: NO_STORE });
  }

  const { state, passes } = await getHostTimedPassInventory(acct.id);
  return NextResponse.json({ ok: true, changed: outcome.changed, state, passes }, { headers: NO_STORE });
}
