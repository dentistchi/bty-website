// Manager ISSUES a Timed Access Pass to a canonical Host account (BUILD 17).
//
// POST { accountId, passType, reason?, idempotencyKey } -> issue one fixed-duration pass
// (1h/4h/24h) through the atomic issue RPC. Issuing NEVER changes the account's FREE/PRO
// plan and never creates a pilot request. A PRO base account is rejected (409 account_is_pro).
// A retried issue with the same key returns the SAME grant (no duplicate).
//
// Requires the manager (bty_mgr) operator session; a Host session cannot reach it.

import { NextRequest, NextResponse } from 'next/server';
import { managerEnabled, managerAuthorized } from '@/lib/manager-auth.server';
import { IssueTimedPassSchema } from '@/lib/validation';
import { issueTimedPass } from '@/lib/timed-pass.server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' } as const;

export async function POST(req: NextRequest) {
  if (!managerEnabled()) {
    return NextResponse.json({ error: 'Not enabled.' }, { status: 503, headers: NO_STORE });
  }
  if (!(await managerAuthorized(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400, headers: NO_STORE });
  }
  const parsed = IssueTimedPassSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400, headers: NO_STORE });
  }

  const outcome = await issueTimedPass({
    accountId: parsed.data.accountId,
    passType: parsed.data.passType,
    reason: parsed.data.reason ?? null,
    idempotencyKey: parsed.data.idempotencyKey,
  });

  if (!outcome.ok) {
    if (outcome.error === 'account_not_found') {
      return NextResponse.json({ ok: false, error: 'account_not_found' }, { status: 404, headers: NO_STORE });
    }
    if (outcome.error === 'account_is_pro') {
      // Honest, non-actionable: a PRO account is already unlimited and cannot consume a pass.
      return NextResponse.json({ ok: false, error: 'account_is_pro' }, { status: 409, headers: NO_STORE });
    }
    return NextResponse.json({ error: 'Invalid request' }, { status: 400, headers: NO_STORE });
  }

  return NextResponse.json(
    { ok: true, passGrantId: outcome.passGrantId, passType: outcome.passType, status: outcome.status, reused: outcome.reused },
    { headers: NO_STORE },
  );
}
