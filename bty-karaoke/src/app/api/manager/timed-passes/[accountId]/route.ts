// Manager reads a canonical account's Timed Access Pass inventory + audit (BUILD 17).
//
// GET -> { ok, state, passes, audit } for one account: effective entitlement + current
// pass state, the full grant inventory, and the append-only audit history. Read-only.
//
// Requires the manager (bty_mgr) operator session.

import { NextRequest, NextResponse } from 'next/server';
import { managerEnabled, managerAuthorized } from '@/lib/manager-auth.server';
import { readTimedPassState, listAccountTimedPasses, listAccountTimedPassAudit } from '@/lib/timed-pass.server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' } as const;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: NextRequest, ctx: { params: Promise<{ accountId: string }> }) {
  if (!managerEnabled()) {
    return NextResponse.json({ error: 'Not enabled.' }, { status: 503, headers: NO_STORE });
  }
  if (!(await managerAuthorized(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
  }

  const { accountId } = await ctx.params;
  if (!UUID_RE.test(accountId)) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400, headers: NO_STORE });
  }

  const [state, passes, audit] = await Promise.all([
    readTimedPassState(accountId),
    listAccountTimedPasses(accountId),
    listAccountTimedPassAudit(accountId),
  ]);

  return NextResponse.json({ ok: true, state, passes, audit }, { headers: NO_STORE });
}
