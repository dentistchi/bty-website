// One-time Admin device enrollment via a setup nonce (from the Mac admin:setup
// QR, delivered in the URL fragment, POSTed here). Atomically consumes the nonce,
// sets the room's Admin PIN, and mints a role='admin' device. Setting your OWN
// new PIN, so format feedback is fine here (it isn't a secret guess). The whole
// PIN feature is gated on the dedicated rate-limit secret being configured.

import { NextRequest, NextResponse } from 'next/server';
import { AdminSetupSchema } from '@/lib/validation';
import { getPublicRoomBySlug } from '@/lib/rooms.server';
import { normalizePin, hashPin } from '@/lib/admin-pin.server';
import { redeemAdminSetup } from '@/lib/admin-setup.server';
import { rateLimitSecret } from '@/lib/rate-limit.server';
import { defaultDeviceLabel } from '@/domain/pairing';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const unavailable = () => NextResponse.json({ error: '지금은 사용할 수 없어요.' }, { status: 503 });

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
  const parsed = AdminSetupSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed' }, { status: 400 });

  const room = await getPublicRoomBySlug(slug);
  if (!room) {
    return NextResponse.json({ error: '설정 링크가 유효하지 않아요.' }, { status: 410 });
  }

  const norm = normalizePin(parsed.data.pin);
  if (!norm.ok) {
    return NextResponse.json(
      { error: 'PIN은 숫자 6자리 이상, 또는 8자 이상의 문구여야 해요. (앞뒤 공백 불가)' },
      { status: 400 },
    );
  }

  const pinHash = await hashPin(norm.pin);
  const label = defaultDeviceLabel(req.headers.get('user-agent'), 'admin');
  const result = await redeemAdminSetup({ roomId: room.id, rawToken: parsed.data.token, pinHash, label });

  if (result.outcome === 'invalid') {
    return NextResponse.json(
      { error: '설정 링크가 만료되었거나 이미 사용되었어요. 새 QR을 받아주세요.' },
      { status: 410 },
    );
  }
  return NextResponse.json({ ok: true, adminToken: result.deviceToken });
}
