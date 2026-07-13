// Admin: revoke a single paired device. Blocks that device on its next call.

import { NextRequest, NextResponse } from 'next/server';
import { bearerFromHeader } from '@/lib/dj-auth.server';
import { authorizeAdmin } from '@/lib/rooms.server';
import { revokeDevice } from '@/lib/devices.server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ slug: string; id: string }> },
) {
  const { slug, id } = await ctx.params;
  const bearer = bearerFromHeader(req.headers.get('authorization'));
  if (!bearer) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const auth = await authorizeAdmin(slug, bearer);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const device = await revokeDevice(auth.room.id, id);
  if (!device) return NextResponse.json({ error: 'Device not found' }, { status: 404 });
  return NextResponse.json({ ok: true, device });
}
