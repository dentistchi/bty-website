// A Host SWITCHES from the running Timed Access Pass to another one they own (BUILD 26M).
//
// POST (web cookie OR native Bearer host session) { passGrantId, idempotencyKey? }
//   -> ACTIVE pass becomes REVOKED (revoke_reason 'switched_pass', activation facts retained)
//   and the target becomes SELECTED, atomically, through one RPC. Returns the refreshed
//   inventory + state plus what was given up.
//
// WHY THIS IS NOT /select. Selecting is free; switching DESTROYS the residual time on the pass
// that is currently running, and that is irreversible. A destructive action must have its own
// endpoint and its own confirmed intent rather than riding on a verb the client already uses for
// something harmless — otherwise an ordinary retry of a select could silently burn an hour.
//
// The switch ARMS but never ACTIVATES: the new pass's clock starts only when a real song start
// commits. It is also NOT an admission bypass — the start authority still refuses any song the
// newly armed pass cannot cover in full.
//
// The account is ALWAYS derived server-side from the session; passGrantId must belong to that
// account (the RPC scopes by account_id). no-store; uniform 401.

import { NextRequest, NextResponse } from 'next/server';
import { bearerFromHeader } from '@/lib/dj-auth.server';
import { authorizeHost } from '@/lib/host-auth.server';
import { hostTokenFromRequest } from '@/lib/host-web-session.server';
import { SwitchTimedPassSchema } from '@/lib/validation';
import { switchTimedPass, getHostTimedPassInventory } from '@/lib/timed-pass.server';

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
  const parsed = SwitchTimedPassSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400, headers: NO_STORE });
  }

  const outcome = await switchTimedPass({
    accountId: acct.id,
    passGrantId: parsed.data.passGrantId,
    idempotencyKey: parsed.data.idempotencyKey ?? null,
  });

  if (!outcome.ok) {
    if (outcome.error === 'pass_not_found') {
      return NextResponse.json({ ok: false, error: 'pass_not_found' }, { status: 404, headers: NO_STORE });
    }
    if (outcome.error === 'not_switchable') {
      // An EXPIRED/REVOKED/ACTIVE pass is not a switch target. A stale client holding an id that
      // has since been consumed lands here rather than spending it twice.
      return NextResponse.json(
        { ok: false, error: 'not_switchable', status: outcome.status },
        { status: 409, headers: NO_STORE },
      );
    }
    // switch_conflict: another session moved this account's passes first. Server truth wins;
    // the client refetches rather than retrying blindly into a changed world.
    return NextResponse.json({ ok: false, error: 'switch_conflict' }, { status: 409, headers: NO_STORE });
  }

  const { state, passes } = await getHostTimedPassInventory(acct.id);
  return NextResponse.json(
    {
      ok: true,
      changed: outcome.changed,
      switchedFromPassId: outcome.switchedFromPassId,
      forfeitedSeconds: outcome.forfeitedSeconds,
      state,
      passes,
    },
    { headers: NO_STORE },
  );
}
