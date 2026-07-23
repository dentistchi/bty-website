// Native first-Room creation (New Host Onboarding — native path).
//
// POST (Bearer host session) /api/host/rooms/create   body: { name, idempotencyKey? }
//   Authenticated Host → create THIS account's first Room atomically → return JSON
//   { ok, kind, slug, roomId }. The native app then re-reads My Norebang and enters
//   the Room via the existing account-bound device-token exchange.
//
// This is the Bearer/JSON sibling of the web form endpoint (../route.ts): it shares the
// SAME atomic, idempotent, owner-derived-from-session service (createRoomForAccount) —
// the ONE authorization + ownership chain lives server-side:
//   Host session → canonical account → create_karaoke_room(account, …) → room +
//   workspace + membership + ownership (atomic). NO Manager passcode. Creates ZERO
//   Events. The request carries ONLY a display name (+ optional idempotency key); no
//   owner id, no slug, no account id is ever accepted from the client.
//
// Duplicate-safe: a Host that already owns a Room does not create a second one — the
// service returns the existing first Room's slug + id (kind 'entered'), so a double tap,
// retry, or relaunch-and-resubmit all converge on the same single Room.

import { NextRequest, NextResponse } from 'next/server';
import { bearerFromHeader } from '@/lib/dj-auth.server';
import { authorizeHost, createRoomForAccount } from '@/lib/host-auth.server';
import { CreateRoomSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' } as const;

export async function POST(req: NextRequest) {
  // 1. Identity FIRST — the owner is the authenticated account, never the request body.
  const account = await authorizeHost(bearerFromHeader(req.headers.get('authorization')));
  if (!account) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
  }

  // 2. Validate the ONLY accepted input: a trimmed, bounded display name.
  const body = (await req.json().catch(() => null)) as { name?: unknown; idempotencyKey?: unknown } | null;
  const parsed = CreateRoomSchema.safeParse({ name: body?.name });
  if (!parsed.success) {
    return NextResponse.json({ error: '노래방 이름을 확인해 주세요.', code: 'bad_name' }, { status: 400, headers: NO_STORE });
  }
  const idempotencyKey = typeof body?.idempotencyKey === 'string' ? body.idempotencyKey.trim() : '';

  // 3. Atomic, idempotent create. Owner = the authenticated account.
  const result = await createRoomForAccount({
    accountId: account.id,
    displayName: parsed.data.name,
    idempotencyKey,
  });

  // 4. Map the shared service outcome to a native-friendly JSON result.
  switch (result.kind) {
    case 'entered': // first Room (created or idempotent re-entry) — the native onboarding case
    case 'added': //   additional Room (uncapped) — same success shape
      return NextResponse.json(
        { ok: true, kind: result.kind, slug: result.slug, roomId: result.roomId },
        { headers: NO_STORE },
      );
    case 'idempotency_conflict': // same key, different payload → no Room
      return NextResponse.json({ ok: false, code: 'room_conflict' }, { status: 409, headers: NO_STORE });
    case 'blocked': // fail-closed (missing workspace / inconsistency) → no Room
      return NextResponse.json({ ok: false, code: 'room_blocked' }, { status: 409, headers: NO_STORE });
  }
}
