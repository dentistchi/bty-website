// Manager read-only list of PRO pilot requests (PRO Pilot Request + Approval V1).
//
// GET ?status=PENDING|APPROVED|DECLINED -> the operational list (PENDING first).
// Requires the EXISTING manager (bty_mgr) operator session — a plain Host session
// can never reach it. Read-only: mutates nothing. Privacy: labels are Room-derived
// or a masked id; no email, provider subject, or relay identifier is returned.

import { NextRequest, NextResponse } from 'next/server';
import { managerEnabled, managerAuthorized } from '@/lib/manager-auth.server';
import { listProPilotRequests, type ProPilotStatus } from '@/lib/pro-pilot.server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' } as const;

export async function GET(req: NextRequest) {
  if (!managerEnabled()) {
    return NextResponse.json({ error: 'Not enabled.' }, { status: 503, headers: NO_STORE });
  }
  if (!(await managerAuthorized(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
  }

  const raw = req.nextUrl.searchParams.get('status');
  const status: ProPilotStatus | undefined =
    raw === 'PENDING' || raw === 'APPROVED' || raw === 'DECLINED' ? raw : undefined;

  const result = await listProPilotRequests({ status });
  return NextResponse.json({ ok: true, ...result }, { headers: NO_STORE });
}
