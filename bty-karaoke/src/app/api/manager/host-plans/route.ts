// Manager Plan Console — READ-ONLY Host plan list (Manager Plan Console V1).
//
// GET -> a paginated, filterable summary of every canonical Host account's current
// plan (from the entitlement authority) plus persisted-assignment integrity, owned
// Room summaries, provider type, and anomaly flags. Requires the EXISTING global
// Manager authority (bty_mgr signed cookie) — a plain Host session gets a uniform
// 401. Read-only: no write, no RPC. Never returns an email, provider subject, or any
// credential; account ids travel only as an opaque detail-route key.

import { NextRequest, NextResponse } from 'next/server';
import { managerEnabled, managerAuthorized } from '@/lib/manager-auth.server';
import { listHostPlanConsole } from '@/lib/host-plan-console.server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' } as const;

function intParam(v: string | null, fallback: number): number {
  const n = v == null ? NaN : Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

export async function GET(req: NextRequest) {
  if (!managerEnabled()) {
    return NextResponse.json({ error: 'Plan console is not enabled.' }, { status: 503, headers: NO_STORE });
  }
  if (!(await managerAuthorized(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
  }

  const sp = req.nextUrl.searchParams;
  const planRaw = (sp.get('plan') ?? 'ALL').toUpperCase();
  const plan = planRaw === 'FREE' || planRaw === 'PRO' ? planRaw : 'ALL';

  const result = await listHostPlanConsole({
    plan,
    anomalyOnly: sp.get('anomaly') === '1' || sp.get('anomalyOnly') === 'true',
    q: sp.get('q') ?? undefined,
    limit: intParam(sp.get('limit'), 50),
    offset: intParam(sp.get('offset'), 0),
  });

  return NextResponse.json({ ok: true, ...result }, { headers: NO_STORE });
}
