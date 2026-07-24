// Manager DECLINES a PRO pilot request (PRO Pilot Request + Approval V1).
//
// POST { idempotencyKey, reason? } -> mark the request DECLINED and append ONE
// decision-audit row, in one atomic transaction. A decline NEVER changes the plan
// (no plan assignment, no plan audit) — the account stays FREE. A retried decline
// (same key) writes nothing new. Cannot decline an already-APPROVED request.
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
    decision: 'decline',
    reason: parsed.data.reason ?? null,
    decisionIdempotencyKey: parsed.data.idempotencyKey,
  });

  if (!outcome.ok) {
    if (outcome.error === 'request_not_found') {
      return NextResponse.json({ ok: false, error: 'request_not_found' }, { status: 404, headers: NO_STORE });
    }
    if (outcome.error === 'already_decided') {
      return NextResponse.json(
        { ok: false, error: 'already_decided', status: outcome.status },
        { status: 409, headers: NO_STORE },
      );
    }
    return NextResponse.json({ error: 'Invalid request' }, { status: 400, headers: NO_STORE });
  }

  return NextResponse.json(
    { ok: true, requestId: outcome.requestId, status: outcome.status, currentPlan: 'FREE' },
    { headers: NO_STORE },
  );
}
