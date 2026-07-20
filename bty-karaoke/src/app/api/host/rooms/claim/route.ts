// Claim the existing pilot Room for the signed-in Host (Host Account V1).
//
// POST (Bearer host session) { passcode, roomSlug } -> { ok, outcome, room }
//
// This is the ONE place the Manager passcode still does real work, and its role
// has changed: it is no longer an identity, only a one-time authorization to
// connect an EXISTING Room to a verified personal account.
//
// Order is deliberate and non-negotiable:
//   1. authenticate the Host (a passcode alone can no longer claim anything —
//      §5 requires a verified personal account FIRST);
//   2. rate-limit, then verify the passcode server-side, constant-time;
//   3. resolve the Room;
//   4. hand off to the atomic claim_karaoke_room RPC.
//
// Failure modes collapse to a UNIFORM 401 (except the honest 409 conflict), so an
// unauthenticated prober cannot distinguish "wrong passcode" from "no such Room"
// from "feature disabled". A failed claim creates NO account, workspace,
// membership, or ownership row — the whole graph is one transaction in the RPC.
// Claiming NEVER creates an Event.

import { NextRequest, NextResponse } from 'next/server';
import { bearerFromHeader } from '@/lib/dj-auth.server';
import { authorizeHost, claimRoomForAccount } from '@/lib/host-auth.server';
import { managerEnabled, verifyManagerPasscode } from '@/lib/manager-auth.server';
import { getPublicRoomBySlug } from '@/lib/rooms.server';
import { makeLimiter, isLockedOut, recordFailure, recordSuccess } from '@/lib/rate-limit.server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' } as const;
// Uniform failure — never reveals whether the passcode, the Room, or the feature
// was the problem.
const fail = () =>
  NextResponse.json({ error: 'That passcode is not valid.' }, { status: 401, headers: NO_STORE });

function clientIp(req: NextRequest): string {
  return (
    req.headers.get('cf-connecting-ip') ??
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown'
  );
}

export async function POST(req: NextRequest) {
  // 1. A verified personal account is required BEFORE any passcode is considered.
  const account = await authorizeHost(bearerFromHeader(req.headers.get('authorization')));
  if (!account) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
  }

  // 2. Throttle passcode guessing per IP (best-effort, same limiter as manager login).
  const limiter = await makeLimiter('host-room-claim', clientIp(req));
  if (limiter && (await isLockedOut(limiter))) return fail();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    if (limiter) await recordFailure(limiter);
    return fail();
  }
  const { passcode, roomSlug } = (body ?? {}) as { passcode?: unknown; roomSlug?: unknown };

  if (!managerEnabled() || typeof passcode !== 'string' || typeof roomSlug !== 'string' || !roomSlug) {
    if (limiter) await recordFailure(limiter);
    return fail();
  }
  if (!verifyManagerPasscode(passcode)) {
    if (limiter) await recordFailure(limiter);
    return fail();
  }

  // 3. Resolve the Room. An unknown slug is the SAME uniform failure as a wrong
  //    passcode so this endpoint cannot be used to enumerate Rooms.
  const room = await getPublicRoomBySlug(roomSlug);
  if (!room) {
    if (limiter) await recordFailure(limiter);
    return fail();
  }

  // 4. Atomic claim. Never re-assigns a Room between workspaces.
  const result = await claimRoomForAccount({
    accountId: account.id,
    roomId: room.id,
    workspaceName: 'My Norebang',
  });

  if (result.outcome === 'no_room') {
    if (limiter) await recordFailure(limiter);
    return fail();
  }
  if (result.outcome === 'conflict') {
    // Honest, distinct: the caller IS authenticated and DID present the right
    // passcode; the Room simply belongs to another workspace already.
    return NextResponse.json(
      { error: '이 노래방은 이미 다른 계정에 연결되어 있어요.', code: 'ALREADY_CLAIMED' },
      { status: 409, headers: NO_STORE },
    );
  }

  if (limiter) await recordSuccess(limiter);
  return NextResponse.json(
    {
      ok: true,
      outcome: result.outcome, // 'claimed' | 'idempotent'
      room: { slug: room.slug, displayName: room.display_name },
    },
    { headers: NO_STORE },
  );
}
