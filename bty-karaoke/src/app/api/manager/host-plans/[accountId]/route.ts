// Manager Plan Console — READ-ONLY Host plan detail (Manager Plan Console V1).
//
// GET -> one Host account's current plan + capabilities (from the entitlement
// authority), persisted-assignment integrity diagnostics, owned Rooms, the full
// assignment history (started_at asc), and the append-only audit history
// (created_at asc, idempotency key masked). Requires the EXISTING Manager authority;
// a plain Host session gets a uniform 401. Read-only; no email/subject/credential.
// A missing/unknown account returns a uniform 404 (no existence leak beyond the
// Manager-authorized surface).

import { NextRequest, NextResponse } from 'next/server';
import { managerEnabled, managerAuthorized } from '@/lib/manager-auth.server';
import { getHostPlanConsoleDetail } from '@/lib/host-plan-console.server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' } as const;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: NextRequest, ctx: { params: Promise<{ accountId: string }> }) {
  if (!managerEnabled()) {
    return NextResponse.json({ error: 'Plan console is not enabled.' }, { status: 503, headers: NO_STORE });
  }
  if (!(await managerAuthorized(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
  }

  const { accountId } = await ctx.params;
  if (!UUID_RE.test(accountId)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404, headers: NO_STORE });
  }

  const detail = await getHostPlanConsoleDetail(accountId);
  if (!detail) {
    return NextResponse.json({ error: 'Not found' }, { status: 404, headers: NO_STORE });
  }

  return NextResponse.json({ ok: true, detail }, { headers: NO_STORE });
}
