// A FREE Host's PRO pilot request (PRO Pilot Request + Manager Approval V1).
//
// GET  (web cookie OR native Bearer host session) -> { ok, plan, request | null }
// POST (same auth) { roomId?, idempotencyKey }    -> create/return the pilot request
//
// The account is ALWAYS derived server-side from the session; accountId is never
// read from the body, so one Host can never file a request as another. A request
// NEVER changes a plan — approval is the Manager's separate, canonical action.
// Creating a request touches no Event, Room, or queue. no-store; uniform 401.

import { NextRequest, NextResponse } from 'next/server';
import { bearerFromHeader } from '@/lib/dj-auth.server';
import { authorizeHost, accountHasRoomAccess } from '@/lib/host-auth.server';
import { hostTokenFromRequest } from '@/lib/host-web-session.server';
import { ProPilotRequestSchema } from '@/lib/validation';
import { getHostProPilotState, createProPilotRequest } from '@/lib/pro-pilot.server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' } as const;

async function account(req: NextRequest) {
  const token = bearerFromHeader(req.headers.get('authorization')) ?? hostTokenFromRequest(req);
  return authorizeHost(token);
}

export async function GET(req: NextRequest) {
  const acct = await account(req);
  if (!acct) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });

  const state = await getHostProPilotState(acct.id);
  return NextResponse.json({ ok: true, plan: state.plan, request: state.request }, { headers: NO_STORE });
}

export async function POST(req: NextRequest) {
  const acct = await account(req);
  if (!acct) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400, headers: NO_STORE });
  }
  const parsed = ProPilotRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400, headers: NO_STORE });
  }

  // room_id is request CONTEXT only. If the client supplies one it MUST be a Room the
  // account owns (never trust the body); otherwise it is dropped (null context).
  let roomId: string | null = null;
  if (parsed.data.roomId) {
    if (!(await accountHasRoomAccess(acct.id, parsed.data.roomId))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: NO_STORE });
    }
    roomId = parsed.data.roomId;
  }

  const outcome = await createProPilotRequest({
    accountId: acct.id,
    roomId,
    idempotencyKey: parsed.data.idempotencyKey,
  });

  if (!outcome.ok) {
    if (outcome.error === 'already_pro') {
      // Honest, non-actionable: a PRO account has nothing to request.
      return NextResponse.json({ ok: false, error: 'already_pro' }, { status: 409, headers: NO_STORE });
    }
    return NextResponse.json({ error: 'Invalid request' }, { status: 400, headers: NO_STORE });
  }

  const state = await getHostProPilotState(acct.id);
  return NextResponse.json(
    { ok: true, plan: state.plan, request: state.request },
    { headers: NO_STORE },
  );
}
