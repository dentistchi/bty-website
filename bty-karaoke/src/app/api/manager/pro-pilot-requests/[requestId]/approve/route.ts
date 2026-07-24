// Manager APPROVES a PRO pilot request (PRO Pilot Request + Approval V1).
//
// POST { idempotencyKey, reason? } -> move the account to PRO via the EXISTING
// canonical plan authority and mark the request APPROVED, in ONE atomic transaction
// (the decide RPC). A retried approve (same key, or a Manager double-tap) makes NO
// second plan assignment, NO second plan audit, NO second decision audit — the
// account ends PRO and the response is stably successful.
//
// Requires the manager (bty_mgr) operator session; a Host session cannot reach it.

import { NextRequest, NextResponse } from 'next/server';
import { managerEnabled, managerAuthorized } from '@/lib/manager-auth.server';
import { ProPilotDecisionSchema } from '@/lib/validation';
import { decideProPilotRequest } from '@/lib/pro-pilot.server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' } as const;

export async function POST(req: NextRequest, ctx: { params: Promise<{ requestId: string }> }) {
  if (!managerEnabled()) {
    return NextResponse.json({ error: 'Not enabled.' }, { status: 503, headers: NO_STORE });
  }
  if (!(await managerAuthorized(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
  }

  const { requestId } = await ctx.params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400, headers: NO_STORE });
  }
  const parsed = ProPilotDecisionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400, headers: NO_STORE });
  }

  const outcome = await decideProPilotRequest({
    requestId,
    decision: 'approve',
    reason: parsed.data.reason ?? null,
    decisionIdempotencyKey: parsed.data.idempotencyKey,
  });

  if (!outcome.ok) {
    if (outcome.error === 'request_not_found') {
      return NextResponse.json({ ok: false, error: 'request_not_found' }, { status: 404, headers: NO_STORE });
    }
    if (outcome.error === 'already_decided') {
      // Cannot approve a request that is already DECLINED/APPROVED.
      return NextResponse.json(
        { ok: false, error: 'already_decided', status: outcome.status },
        { status: 409, headers: NO_STORE },
      );
    }
    return NextResponse.json({ error: 'Invalid request' }, { status: 400, headers: NO_STORE });
  }

  return NextResponse.json(
    { ok: true, requestId: outcome.requestId, status: outcome.status, currentPlan: 'PRO' },
    { headers: NO_STORE },
  );
}
