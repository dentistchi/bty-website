// Room Branding V1 — logo upload / replacement (multipart).
//
// POST (Host cookie + CSRF, multipart) /api/host/rooms/{slug}/logo   field: logo (File)
//   Authenticated owner → normalize in the Worker → store the canonical WebP in the
//   PRIVATE bucket under a server-generated key → update the Room pointer → delete the
//   previous object. Compensation-safe: the old object is removed ONLY after the new
//   object AND the DB pointer both succeed; a DB failure rolls back the new object.
//
// Owner authorization is derived server-side (Host session → account → active Room
// ownership). Unknown/unauthorized Room → the same 404. No object key/path is ever
// accepted from the client. Creates ZERO Events.

import { NextRequest, NextResponse } from 'next/server';
import { authorizeHost, accountHasRoomAccess } from '@/lib/host-auth.server';
import { hostTokenFromRequest } from '@/lib/host-web-session.server';
import { verifyHostCsrf, csrfFromForm } from '@/lib/host-csrf.server';
import { getPublicRoomBySlug, setRoomLogoPointer } from '@/lib/rooms.server';
import { normalizeLogoToWebp } from '@/lib/logo-image.server';
import { newLogoObjectKey, newLogoVersion, uploadLogoObject, deleteLogoObject } from '@/lib/logo-storage.server';
import { IMAGE_LIMITS } from '@/domain/image-inspect';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' } as const;
const back = (req: NextRequest, slug: string, notice: string) =>
  NextResponse.redirect(new URL(`/host/rooms/${encodeURIComponent(slug)}/settings?notice=${notice}`, req.nextUrl.origin), 303);

/** Map a normalizer rejection to a guest-safe settings notice. */
function noticeFor(reason: string): string {
  if (reason === 'too_large' || reason === 'too_large_decoded' || reason === 'side_too_large' || reason === 'too_many_pixels') return 'logo_too_large';
  if (reason === 'unsupported_format') return 'logo_format';
  return 'logo_bad';
}

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

  const file = form?.get('logo');
  if (!(file instanceof File) || file.size === 0) return back(req, room.slug, 'logo_bad');
  if (file.size > IMAGE_LIMITS.maxBytes) return back(req, room.slug, 'logo_too_large');

  const bytes = new Uint8Array(await file.arrayBuffer());
  const norm = await normalizeLogoToWebp(bytes);
  if (!norm.ok) return back(req, room.slug, noticeFor(norm.reason));

  const newKey = newLogoObjectKey(room.id);
  const version = newLogoVersion();
  const oldKey = room.logo_object_key;

  // 1) upload the new object
  try {
    await uploadLogoObject(newKey, norm.webp);
  } catch {
    return back(req, room.slug, 'logo_failed');
  }
  // 2) point the Room at it — on failure, roll back the just-uploaded object
  try {
    await setRoomLogoPointer(room.id, newKey, version);
  } catch {
    await deleteLogoObject(newKey);
    return back(req, room.slug, 'logo_failed');
  }
  // 3) delete the previous object AFTER both succeed. A delete failure is non-fatal:
  //    the new pointer is intact; the old object is surfaced as an orphan in logs.
  if (oldKey && oldKey !== newKey) {
    const removed = await deleteLogoObject(oldKey);
    if (!removed) console.warn(`[branding] orphaned previous logo object (delete failed): ${oldKey}`);
  }

  return back(req, room.slug, 'logo_saved');
}
