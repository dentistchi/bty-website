// Admin: rotate global DJ authorization. Revokes every active DJ-role device and
// burns outstanding pairing tokens in one shot; admin devices are left intact so
// the operator keeps control. Every iPad must re-pair afterward.

import { NextRequest, NextResponse } from 'next/server';
import { roomCredentialFromRequest } from '@/lib/dj-auth.server';
import { authorizeAdmin } from '@/lib/rooms.server';
import { revokeAllDjDevices } from '@/lib/devices.server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const bearer = roomCredentialFromRequest(req);
  if (!bearer) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const auth = await authorizeAdmin(slug, bearer);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const revoked = await revokeAllDjDevices(auth.room.id);
  return NextResponse.json({ ok: true, revoked });
}
