// Manager ISSUES a Timed Access Pass to a canonical Host account (BUILD 17).
//
// POST { accountId, passType, reason?, idempotencyKey } -> issue one fixed-duration pass
// (1h/4h/24h) through the atomic issue RPC. Issuing NEVER changes the account's FREE/PRO
// plan and never creates a pilot request. A PRO base account is rejected (409 account_is_pro).
// A retried issue with the same key returns the SAME grant (no duplicate).
//
// Requires the manager (bty_mgr) operator session; a Host session cannot reach it.
//
// BUILD 26O — issuance carries server-derived actor provenance, built from the session cookie and
// never from the request body. The manager credential is SHARED, so what is recorded is the
// credential class plus a session fingerprint, not a person: the audit can now say "one session
// issued these fifteen" without claiming to know who was holding it.

import { NextRequest, NextResponse } from 'next/server';
import { managerEnabled, managerAuthorized, managerIssuanceActor } from '@/lib/manager-auth.server';
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

  // BUILD 26O — attribution is derived from the SESSION, after authorization and independently of
  // `parsed.data`. The schema strips unknown keys, so a forged `issued_by`/`actor_id` in the body
  // never reaches this point; but the stronger guarantee is structural — the body is not an input
  // to this call at all, so there is no precedence rule to get wrong.
  const issuance = await managerIssuanceActor(req, 'manager_issue');
  if (!issuance) {
    // Authorization passed but provenance could not be built. Refuse rather than issue an
    // unattributed grant: an unexplainable pass is the defect this build exists to prevent.
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
  }

  const outcome = await issueTimedPass({
    accountId: parsed.data.accountId,
    passType: parsed.data.passType,
    reason: parsed.data.reason ?? null,
    idempotencyKey: parsed.data.idempotencyKey,
    issuance,
  });

  if (!outcome.ok) {
    if (outcome.error === 'account_not_found') {
      return NextResponse.json({ ok: false, error: 'account_not_found' }, { status: 404, headers: NO_STORE });
    }
    if (outcome.error === 'account_is_pro') {
      // Honest, non-actionable: a PRO account is already unlimited and cannot consume a pass.
      return NextResponse.json({ ok: false, error: 'account_is_pro' }, { status: 409, headers: NO_STORE });
    }
    if (outcome.error === 'idempotency_conflict') {
      // BUILD 26O-R1 — this key is already spent on a different account or a different pass type.
      // 409 (conflict), and the body says only that: naming the grant that owns the key would
      // disclose another account's entitlement to whoever guessed the key.
      return NextResponse.json({ ok: false, error: 'idempotency_conflict' }, { status: 409, headers: NO_STORE });
    }
    if (outcome.error === 'issuance_provenance_required') {
      // The route always sends provenance, so reaching this is a SERVER fault, not a bad request.
      // 500 keeps it out of the 4xx bucket where it would read as the caller's mistake — and no
      // grant was created, because the RPC refuses before every write.
      return NextResponse.json({ error: 'Server error' }, { status: 500, headers: NO_STORE });
    }
    return NextResponse.json({ error: 'Invalid request' }, { status: 400, headers: NO_STORE });
  }

  return NextResponse.json(
    { ok: true, passGrantId: outcome.passGrantId, passType: outcome.passType, status: outcome.status, reused: outcome.reused },
    { headers: NO_STORE },
  );
}
