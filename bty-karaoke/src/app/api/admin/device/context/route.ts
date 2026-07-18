// Restore an Admin device's room WITHOUT a slug, from its stored token alone.
//   GET    -> resolve the token's ONE room + canonical event (auto-reconnect).
//   DELETE -> self-revoke this device (mobile "이 기기 등록 해제" / logout).
// Safe & cheap: `token_hash` is globally UNIQUE, so getActiveDeviceByToken is a
// single indexed lookup — never a scan. Returns ONLY the token's own room; a
// revoked/unknown token is 401 with no data. A room with no live event still
// returns its identity (activeEvent: null) so the app can show "no live event".

import { NextRequest, NextResponse } from 'next/server';
import { bearerFromHeader } from '@/lib/dj-auth.server';
import { getActiveDeviceByToken, revokeDevice } from '@/lib/devices.server';
import { getPublicRoomById } from '@/lib/rooms.server';
import { buildAdminRoomContext } from '@/lib/admin-device.server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const unauthorized = () => NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

export async function GET(req: NextRequest) {
  const bearer = bearerFromHeader(req.headers.get('authorization'));
  if (!bearer) return unauthorized();

  const device = await getActiveDeviceByToken(bearer);
  if (!device) return unauthorized();

  const room = await getPublicRoomById(device.room_id);
  if (!room) return unauthorized();

  const context = await buildAdminRoomContext(room);
  return NextResponse.json({
    role: device.role,
    rooms: [context],
    selectedRoomSlug: context.slug,
  });
}

export async function DELETE(req: NextRequest) {
  const bearer = bearerFromHeader(req.headers.get('authorization'));
  if (!bearer) return unauthorized();

  const device = await getActiveDeviceByToken(bearer);
  // Idempotent: an unknown/already-revoked token is treated as success so the app
  // can always clear its local copy. Self-revoke bypasses the last-admin guard —
  // the operator still holds the PIN and can re-enroll, so it can never lock a
  // room out permanently.
  if (device) {
    await revokeDevice(device.room_id, device.id);
  }
  return NextResponse.json({ ok: true });
}
