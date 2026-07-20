// Rotate / set the Admin PIN from an already-authenticated Admin device. This
// changes ONLY karaoke_rooms.admin_pin_hash — it never revokes, invalidates, or
// promotes any device token (no DJ device becomes Admin). Admin-only.

import { NextRequest, NextResponse } from 'next/server';
import { AdminPinRotateSchema } from '@/lib/validation';
import { roomCredentialFromRequest } from '@/lib/dj-auth.server';
import { authorizeAdmin, setRoomAdminPinHash } from '@/lib/rooms.server';
import { normalizePin, hashPin } from '@/lib/admin-pin.server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;

  const bearer = roomCredentialFromRequest(req);
  if (!bearer) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const auth = await authorizeAdmin(slug, bearer);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const parsed = AdminPinRotateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed' }, { status: 400 });

  const norm = normalizePin(parsed.data.pin);
  if (!norm.ok) {
    return NextResponse.json(
      { error: 'PIN은 숫자 6자리 이상, 또는 8자 이상의 문구여야 해요. (앞뒤 공백 불가)' },
      { status: 400 },
    );
  }

  await setRoomAdminPinHash(auth.room.id, await hashPin(norm.pin));
  return NextResponse.json({ ok: true });
}
