// Room Branding V1 — controlled PUBLIC logo proxy.
//
// GET /api/public/rooms/{slug}/logo?v={logoVersion}
//   Resolve ONLY the Room's current canonical logo pointer, fetch the normalized
//   WebP from the PRIVATE bucket server-side, and stream it as image/webp. The private
//   Storage URL is never revealed and no arbitrary object key is ever accepted — the
//   client provides only the public Room slug (and an opaque cache-busting version).
//   No logo → a uniform 404 (no private-Room-existence signal beyond the slug itself,
//   which is already public). No Host auth required (guests must see the logo).

import { NextRequest, NextResponse } from 'next/server';
import { getPublicRoomBySlug } from '@/lib/rooms.server';
import { downloadLogoObject } from '@/lib/logo-storage.server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const NOT_FOUND = () =>
  new NextResponse('Not found', { status: 404, headers: { 'Cache-Control': 'no-store, max-age=0' } });

export async function GET(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const room = await getPublicRoomBySlug(slug);
  if (!room || !room.logo_object_key) return NOT_FOUND();

  const bytes = await downloadLogoObject(room.logo_object_key);
  if (!bytes) return NOT_FOUND(); // pointer without object (mid-replacement / orphaned) → clean 404

  // The URL is versioned (?v=logo_version), so the object at a given URL is immutable
  // and safely long-cached; a new upload rotates the version → a fresh URL.
  const versioned = req.nextUrl.searchParams.get('v') === room.logo_version;
  return new NextResponse(bytes.slice().buffer, {
    status: 200,
    headers: {
      'content-type': 'image/webp',
      'cache-control': versioned ? 'public, max-age=31536000, immutable' : 'public, max-age=60',
    },
  });
}
