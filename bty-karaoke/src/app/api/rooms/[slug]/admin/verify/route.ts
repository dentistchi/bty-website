// Admin bootstrap / session check for a room. The bearer is the room master
// credential (first time, from the operator's secure file) OR a durable admin
// device token. On master verify we mint a revocable admin device session so the
// phone never has to hold the master credential again. 401 with no data on fail.

import { NextRequest, NextResponse } from 'next/server';
import { bearerFromHeader, randomToken } from '@/lib/dj-auth.server';
import { authorizeAdmin } from '@/lib/rooms.server';
import { createDeviceSession } from '@/lib/devices.server';
import { defaultDeviceLabel } from '@/domain/pairing';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const bearer = bearerFromHeader(req.headers.get('authorization'));
  if (!bearer) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const auth = await authorizeAdmin(slug, bearer);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Master-credential bootstrap → upgrade the phone to a durable admin device.
  let adminToken: string | undefined;
  if (auth.deviceId === null) {
    adminToken = randomToken(24);
    await createDeviceSession({
      roomId: auth.room.id,
      rawToken: adminToken,
      role: 'admin',
      label: defaultDeviceLabel(req.headers.get('user-agent'), 'admin'),
    });
  }

  return NextResponse.json({
    ok: true,
    room: { slug: auth.room.slug, display_name: auth.room.display_name, status: auth.room.status },
    adminToken,
  });
}
