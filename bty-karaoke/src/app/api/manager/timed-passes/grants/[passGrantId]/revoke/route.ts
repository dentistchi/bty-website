// Manager REVOKES an unused Timed Access Pass (BUILD 17).
//
// POST { reason?, idempotencyKey } -> revoke an AVAILABLE or SELECTED pass through the
// atomic revoke RPC. V1 does NOT force-revoke an ACTIVE pass (409 not_revocable). A retried
// revoke with the same key returns the recorded outcome. Never touches the plan.
//
// Requires the manager (bty_mgr) operator session.

import { NextRequest, NextResponse } from 'next/server';
import { managerEnabled, managerAuthorized } from '@/lib/manager-auth.server';
import { RevokeTimedPassSchema } from '@/lib/validation';
import { revokeTimedPass } from '@/lib/timed-pass.server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' } as const;

export async function POST(req: NextRequest, ctx: { params: Promise<{ passGrantId: string }> }) {
  if (!managerEnabled()) {
    return NextResponse.json({ error: 'Not enabled.' }, { status: 503, headers: NO_STORE });
  }
  if (!(await managerAuthorized(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
  }

  const { passGrantId } = await ctx.params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400, headers: NO_STORE });
  }
  const parsed = RevokeTimedPassSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400, headers: NO_STORE });
  }

  const outcome = await revokeTimedPass({
    passGrantId,
    reason: parsed.data.reason ?? null,
    idempotencyKey: parsed.data.idempotencyKey,
  });

  if (!outcome.ok) {
    if (outcome.error === 'pass_not_found') {
      return NextResponse.json({ ok: false, error: 'pass_not_found' }, { status: 404, headers: NO_STORE });
    }
    if (outcome.error === 'not_revocable') {
      return NextResponse.json(
        { ok: false, error: 'not_revocable', status: outcome.status },
        { status: 409, headers: NO_STORE },
      );
    }
    return NextResponse.json({ error: 'Invalid request' }, { status: 400, headers: NO_STORE });
  }

  return NextResponse.json(
    { ok: true, passGrantId: outcome.passGrantId, status: outcome.status, replayed: outcome.replayed },
    { headers: NO_STORE },
  );
}
