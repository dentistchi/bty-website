// The signed-in Host's own plan + capabilities (Host Plan Foundation V1).
//
// GET (web cookie OR native Bearer host session) -> { ok, plan, capabilities }
//
// Strictly read-only: opening it creates nothing. The account is ALWAYS derived
// server-side from the session (cookie or Bearer) — there is no account/room id in
// the request, so one Host can never read another's plan. The response carries only
// the plan code/status/source and the capability booleans; it never exposes a
// provider subject, billing id, OAuth/session token, or email.

import { NextRequest, NextResponse } from 'next/server';
import { bearerFromHeader } from '@/lib/dj-auth.server';
import { authorizeHost } from '@/lib/host-auth.server';
import { hostTokenFromRequest } from '@/lib/host-web-session.server';
import { resolveNorebangHostEntitlements } from '@/lib/host-plan.server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' } as const;

export async function GET(req: NextRequest) {
  // Same identity in either transport: native sends Authorization: Bearer, the
  // browser sends the HttpOnly bty_host cookie. Both resolve to the same canonical
  // account, so Apple-on-iOS and linked-Google-on-web return the SAME plan.
  const token = bearerFromHeader(req.headers.get('authorization')) ?? hostTokenFromRequest(req);
  const account = await authorizeHost(token);
  if (!account) {
    // Uniform unauthorized — identical to every other Host read.
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
  }

  const ent = await resolveNorebangHostEntitlements(account.id);
  return NextResponse.json(
    {
      ok: true,
      plan: { code: ent.planCode, status: ent.planStatus, source: ent.source },
      capabilities: ent.capabilities,
    },
    { headers: NO_STORE },
  );
}
