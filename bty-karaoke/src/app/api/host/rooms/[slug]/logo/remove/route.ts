// Room Branding V1 — logo removal.
//
// POST (Host cookie + CSRF) /api/host/rooms/{slug}/logo/remove
//   Authenticated owner → clear the Room's logo pointer → delete the previous
//   managed object (best effort). Never accepts a deletion key from the client — the
//   object removed is exactly the Room's current canonical pointer. Creates ZERO Events.

import { NextRequest, NextResponse } from 'next/server';
import { authorizeHost, accountHasRoomAccess } from '@/lib/host-auth.server';
import { hostTokenFromRequest } from '@/lib/host-web-session.server';
import { verifyHostCsrf, csrfFromForm } from '@/lib/host-csrf.server';
import { getPublicRoomBySlug, clearRoomLogoPointer } from '@/lib/rooms.server';
import { deleteLogoObject } from '@/lib/logo-storage.server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' } as const;

export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;

  const hostToken = hostTokenFromRequest(req);
  const account = await authorizeHost(hostToken);
  if (!account) return NextResponse.redirect(new URL('/', req.nextUrl.origin), 303);

  const form = await req.formData().catch(() => null);
  const csrf = await verifyHostCsrf(req, hostToken, csrfFromForm(form));
  if (!csrf.ok) return NextResponse.json({ error: 'Invalid request' }, { status: 403, headers: NO_STORE });

  const room = await getPublicRoomBySlug(slug);
  if (!room || !(await accountHasRoomAccess(account.id, room.id))) {
    return NextResponse.json({ error: 'Room not found' }, { status: 404, headers: NO_STORE });
  }

  const oldKey = room.logo_object_key;
  await clearRoomLogoPointer(room.id); // clear the pointer first — the guest fallback is instant
  if (oldKey) {
    const removed = await deleteLogoObject(oldKey);
    if (!removed) console.warn(`[branding] orphaned logo object after removal (delete failed): ${oldKey}`);
  }

  return NextResponse.redirect(
    new URL(`/host/rooms/${encodeURIComponent(room.slug)}/settings?notice=logo_removed`, req.nextUrl.origin),
    303,
  );
}
