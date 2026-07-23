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

  // 3. Idempotency key. The shared create service REQUIRES a non-blank, ACCOUNT-SCOPED
  //    key (create_karaoke_room fails closed on a blank one → zero writes). The native
  //    client sends a fresh per-attempt key; if it is absent/blank we mint one here so a
  //    valid first-Room create can never fail merely for lacking a key. The key is
  //    account-scoped in the DB (unique per account_id, idempotency_key), and first-Room
  //    duplicates are additionally guarded by the RPC's account-level `has_room` — so a
  //    lost-response retry with a fresh key returns the SAME first Room, never a second.
  const clientKey = typeof body?.idempotencyKey === 'string' ? body.idempotencyKey.trim() : '';
  const idempotencyKey = clientKey.length >= 1 && clientKey.length <= 128 ? clientKey : crypto.randomUUID();

  // 4. Atomic, idempotent create. Owner = the authenticated account. The service
  //    generates the unique internal slug server-side (display name + CSPRNG suffix,
  //    23505 slug-collision retry), so the display name need NOT be globally unique.
  const result = await createRoomForAccount({
    accountId: account.id,
    displayName: parsed.data.name,
    idempotencyKey,
  });

  // 5. Map the shared service outcome to a native-friendly JSON result. Conflicts get a
  //    stable machine code + a privacy-clean human message (never a constraint name,
  //    account id, or another Host's slug).
  switch (result.kind) {
    case 'entered': // first Room (created or idempotent re-entry) — the native onboarding case
    case 'added': //   additional Room (uncapped) — same success shape
      return NextResponse.json(
        { ok: true, kind: result.kind, slug: result.slug, roomId: result.roomId, displayName: parsed.data.name },
        { headers: NO_STORE },
      );
    case 'idempotency_conflict': // same key, materially different payload → no Room
      return NextResponse.json(
        { ok: false, code: 'room_conflict', error: '같은 요청이 이미 처리되었어요. 목록을 새로고침해 주세요.' },
        { status: 409, headers: NO_STORE },
      );
    case 'blocked': // fail-closed (inconsistent account graph) → no Room
      return NextResponse.json(
        { ok: false, code: 'room_blocked', error: '지금 노래방을 만들지 못했어요. 잠시 후 다시 시도해 주세요.' },
        { status: 409, headers: NO_STORE },
      );
  }
}
