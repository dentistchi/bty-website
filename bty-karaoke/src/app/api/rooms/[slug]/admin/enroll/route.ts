// Enroll a NEW/replacement Admin device by entering the Admin PIN. Verifying an
// existing secret, so EVERY failure mode returns an IDENTICAL response and runs
// equivalent KDF work — missing room, no PIN configured, wrong PIN, malformed,
// and lockout are indistinguishable. Layered KV rate limiting + lockout. The PIN
// is never a bearer; success mints a normal revocable role='admin' device.

import { NextRequest, NextResponse } from 'next/server';
import { AdminEnrollSchema } from '@/lib/validation';
import { getPublicRoomBySlug, getRoomAdminPinHash, setRoomAdminPinHash } from '@/lib/rooms.server';
import { createDeviceSession } from '@/lib/devices.server';
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
// Uniform failure — reveals nothing about room/PIN existence, closeness, or lock.
const fail = () =>
  NextResponse.json({ error: '등록할 수 없습니다. 잠시 후 다시 시도해 주세요.' }, { status: 401 });

function clientIp(req: NextRequest): string {
  return (
    req.headers.get('cf-connecting-ip') ??
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown'
  );
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;

  if (!rateLimitSecret()) {
    // eslint-disable-next-line no-console
    console.error('[admin-pin] KARAOKE_RATELIMIT_SECRET is not configured — enrollment disabled');
    return unavailable();
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const parsed = AdminEnrollSchema.safeParse(body);

  const room = await getPublicRoomBySlug(slug);
  // Rate-limit key falls back to the slug pseudonym when the room is unknown, so
  // the response can't distinguish "room missing" from "wrong PIN".
  const limiter = await makeLimiter(room?.id ?? `slug:${slug}`, clientIp(req));
  if (!limiter) return unavailable();

  if (await isLockedOut(limiter)) {
    await dummyVerify();
    return fail();
  }

  const norm = parsed.success ? normalizePin(parsed.data.pin) : ({ ok: false } as const);
  const pinHash = room ? await getRoomAdminPinHash(room.id) : null;

  if (!room || !pinHash || !norm.ok) {
    await dummyVerify(); // uniform timing for missing room / no PIN / bad format
    await recordFailure(limiter);
    return fail();
  }

  const result = await verifyPin(pinHash, norm.pin);
  if (!result.ok) {
    await recordFailure(limiter);
    return fail();
  }

  await recordSuccess(limiter);
  const deviceToken = randomToken(24);
  await createDeviceSession({
    roomId: room.id,
    rawToken: deviceToken,
    role: 'admin',
    label: defaultDeviceLabel(req.headers.get('user-agent'), 'admin'),
  });
  if (result.needsRehash) {
    try {
      await setRoomAdminPinHash(room.id, await hashPin(norm.pin));
    } catch {
      /* transparent upgrade is best-effort */
    }
  }
  return NextResponse.json({ ok: true, adminToken: deviceToken });
}
