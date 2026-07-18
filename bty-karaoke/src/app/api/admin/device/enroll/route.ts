// Slug-free Admin device enrollment for the mobile app. The operator enters ONLY
// the Admin PIN — no room code. The room is resolved server-side as the SINGLE
// room that has an Admin PIN configured (getSoleAdminPinRoom): we count PIN rooms
// cheaply and verify the PIN against at most ONE candidate, so we NEVER scan many
// PBKDF2 hashes. Zero or ≥2 PIN-configured rooms, missing/wrong PIN, malformed,
// and lockout ALL return the identical uniform 401 — the response discloses
// nothing about room count, PIN existence, or which check failed. Success mints a
// normal revocable role='admin' device and returns the room context so the app
// connects immediately. The PIN is never a bearer and is never stored/logged.

import { NextRequest, NextResponse } from 'next/server';
import { AdminDeviceEnrollSchema } from '@/lib/validation';
import { getSoleAdminPinRoom, setRoomAdminPinHash } from '@/lib/rooms.server';
import { createDeviceSession } from '@/lib/devices.server';
import { buildAdminRoomContext } from '@/lib/admin-device.server';
import { normalizePin, verifyPin, hashPin, dummyVerify } from '@/lib/admin-pin.server';
import {
  makeLimiter,
  isLockedOut,
  recordFailure,
  recordSuccess,
  rateLimitSecret,
} from '@/lib/rate-limit.server';
import { randomToken } from '@/lib/dj-auth.server';
import { defaultDeviceLabel } from '@/domain/pairing';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const unavailable = () => NextResponse.json({ error: '지금은 사용할 수 없어요.' }, { status: 503 });
// Uniform failure — reveals nothing about room count / PIN existence / closeness / lock.
const fail = () =>
  NextResponse.json({ error: '등록할 수 없습니다. 잠시 후 다시 시도해 주세요.' }, { status: 401 });

function clientIp(req: NextRequest): string {
  return (
    req.headers.get('cf-connecting-ip') ??
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown'
  );
}

export async function POST(req: NextRequest) {
  if (!rateLimitSecret()) {
    // eslint-disable-next-line no-console
    console.error('[admin-device] KARAOKE_RATELIMIT_SECRET is not configured — enrollment disabled');
    return unavailable();
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const parsed = AdminDeviceEnrollSchema.safeParse(body);

  // Resolve the SOLE admin-PIN room first. Rate-limit key falls back to a fixed
  // pseudonym so the response can't distinguish "no/ambiguous room" from "wrong PIN".
  const room = await getSoleAdminPinRoom();
  const limiter = await makeLimiter(room?.id ?? 'admin-device-enroll', clientIp(req));
  if (!limiter) return unavailable();

  if (await isLockedOut(limiter)) {
    await dummyVerify();
    return fail();
  }

  const norm = parsed.success ? normalizePin(parsed.data.pin) : ({ ok: false } as const);

  // No unique PIN room, or malformed PIN → uniform fail with equivalent KDF work.
  if (!room || !norm.ok) {
    await dummyVerify();
    await recordFailure(limiter);
    return fail();
  }

  const result = await verifyPin(room.admin_pin_hash, norm.pin);
  if (!result.ok) {
    await recordFailure(limiter);
    return fail();
  }

  await recordSuccess(limiter);
  const deviceToken = randomToken(24);
  const label = parsed.success && parsed.data.deviceName?.trim()
    ? parsed.data.deviceName.trim().slice(0, 60)
    : defaultDeviceLabel(req.headers.get('user-agent'), 'admin');
  await createDeviceSession({
    roomId: room.id,
    rawToken: deviceToken,
    role: 'admin',
    label,
  });
  if (result.needsRehash) {
    try {
      await setRoomAdminPinHash(room.id, await hashPin(norm.pin));
    } catch {
      /* transparent upgrade is best-effort */
    }
  }

  const context = await buildAdminRoomContext(room);
  return NextResponse.json({
    ok: true,
    adminToken: deviceToken,
    role: 'admin',
    rooms: [context],
    selectedRoomSlug: context.slug,
  });
}
