// Verify a DJ credential for a room. The credential is read ONLY from the
// Authorization header (never the URL/body/query). Returns minimal public room
// info on success; 401 with no room data on failure.

import { NextRequest, NextResponse } from 'next/server';
import { bearerFromHeader } from '@/lib/dj-auth.server';
import { authorizeDj } from '@/lib/rooms.server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const cred = bearerFromHeader(req.headers.get('authorization'));
  if (!cred) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const auth = await authorizeDj(slug, cred);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  return NextResponse.json({
    ok: true,
    role: auth.role,
    room: { slug: auth.room.slug, display_name: auth.room.display_name, status: auth.room.status },
  });
}
