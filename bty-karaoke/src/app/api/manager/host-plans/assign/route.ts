// Operator-only manual Host plan change (PRO Pilot Assignment + Plan Lifecycle V1).
//
// POST -> move a canonical Host account between FREE and PRO. Requires the EXISTING
// manager (global operator) authority — the same bty_mgr session that gates Event
// management. There is NO new admin password and NO public secret. A plain Host
// session can NEVER reach this: it authorizes with the manager cookie only.
//
// The change itself is one atomic server transaction (change_karaoke_host_plan RPC):
// end-current + insert-new + append-one-audit, all-or-nothing. This route only
// deserializes, authorizes, and forwards — it computes no plan rules.
//
// Privacy: the account is addressed by opaque id; the response carries only plan
// codes and booleans — never an email, provider subject, OAuth/session token, or
// billing id. Every unauthorized path is a uniform 401. no-store.

import { NextRequest, NextResponse } from 'next/server';
import { managerEnabled, managerAuthorized } from '@/lib/manager-auth.server';
import { HostPlanAssignSchema } from '@/lib/validation';
import { changeNorebangHostPlan } from '@/lib/host-plan.server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' } as const;

export async function POST(req: NextRequest) {
  if (!managerEnabled()) {
    return NextResponse.json({ error: 'Plan management is not enabled.' }, { status: 503, headers: NO_STORE });
  }
  // Operator authority only — a normal Host session cannot pass this.
  if (!(await managerAuthorized(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400, headers: NO_STORE });
  }
  const parsed = HostPlanAssignSchema.safeParse(body);
  if (!parsed.success) {
    // Uniform, field-agnostic — an invalid plan code / account id / empty reason are
    // indistinguishable, so nothing about the account is inferable from the response.
    return NextResponse.json({ error: 'Invalid request' }, { status: 400, headers: NO_STORE });
  }

  const outcome = await changeNorebangHostPlan({
    accountId: parsed.data.accountId,
    planCode: parsed.data.planCode,
    reason: parsed.data.reason,
    idempotencyKey: parsed.data.idempotencyKey,
    source: 'MANUAL',
  });

  if (!outcome.ok) {
    if (outcome.error === 'account_not_found') {
      // No sensitive detail — existence only, addressed by opaque id.
      return NextResponse.json({ ok: false, error: 'account_not_found' }, { status: 404, headers: NO_STORE });
    }
    // Any remaining rejection is a malformed request the schema would normally catch.
    return NextResponse.json({ error: 'Invalid request' }, { status: 400, headers: NO_STORE });
  }

  return NextResponse.json(
    {
      ok: true,
      changed: outcome.changed,
      previousPlan: outcome.previousPlan,
      currentPlan: outcome.currentPlan,
    },
    { headers: NO_STORE },
  );
}
