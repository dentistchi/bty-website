// iPad redeems a one-use pairing token to become the DJ. The token is read from
// the request body (never the URL server-side, never logged). On success we
// return a durable DEVICE token the iPad stores locally; the raw pairing token is
// now dead. Atomic redemption guarantees exactly one winner under a double-scan.

import { NextRequest, NextResponse } from 'next/server';
import { PairRedeemSchema } from '@/lib/validation';
import { getPublicRoomBySlug } from '@/lib/rooms.server';
import { redeemPairingToken } from '@/lib/pairing.server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;

  const room = await getPublicRoomBySlug(slug);
  if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const parsed = PairRedeemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed' }, { status: 400 });
  }

  const result = await redeemPairingToken({
    roomId: room.id,
    rawToken: parsed.data.token,
    userAgent: req.headers.get('user-agent'),
    label: parsed.data.label,
  });

  if (result.outcome === 'invalid') {
    // Expired, already used, or unknown — no room/queue data leaked either way.
    return NextResponse.json(
      { error: 'This pairing code is no longer valid. Ask the host for a new one.' },
      { status: 410 },
    );
  }

  return NextResponse.json({
    ok: true,
    deviceToken: result.deviceToken,
    deviceLabel: result.device.label,
    room: { slug: room.slug, display_name: room.display_name },
  });
}
