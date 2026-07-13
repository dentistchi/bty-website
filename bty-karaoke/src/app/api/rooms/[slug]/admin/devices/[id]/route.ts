// Admin: revoke a single paired device. Blocks that device on its next call.

import { NextRequest, NextResponse } from 'next/server';
import { bearerFromHeader } from '@/lib/dj-auth.server';
import { authorizeAdmin } from '@/lib/rooms.server';
import { revokeDeviceSafely } from '@/lib/devices.server';

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

  const result = await revokeDeviceSafely(auth.room.id, id);
  if (result.outcome === 'not_found') {
    return NextResponse.json({ error: 'Device not found' }, { status: 404 });
  }
  if (result.outcome === 'last_admin') {
    return NextResponse.json(
      { error: '마지막 관리자 기기는 해제할 수 없어요. 다른 관리자 기기를 먼저 등록하세요.' },
      { status: 409 },
    );
  }
  return NextResponse.json({ ok: true, device: result.device });
}
