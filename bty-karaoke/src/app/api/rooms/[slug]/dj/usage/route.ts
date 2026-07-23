// B2 — Daily FREE Karaoke Minutes: the canonical usage PROJECTION endpoint.
//
// GET returns the server-truth usage state for the ROOM OWNER's account (FREE daily
// minutes remaining, warning banner, next reset). Both clients read the SAME result:
// the web Admin polls this on its queue cadence; the native SwiftUI Admin polls it
// alongside /dj/queue. Neither client re-derives the 300s/120s thresholds — the
// resolved `bannerKind` + `startBlocked` come from the one pure projection (domain/
// usage.ts) over the one SQL entitlement RPC. Read-only: never mutates, never opens a
// segment, never starts a song. Enforcement-disabled → bannerKind 'disabled' (no
// active enforcement warning). PRO → bannerKind 'pro' (no FREE countdown).

import { NextRequest, NextResponse } from 'next/server';
import { roomCredentialFromRequest } from '@/lib/dj-auth.server';
import { authorizeDj } from '@/lib/rooms.server';
import { readRoomEntitlement } from '@/lib/metering.server';
import { projectEntitlement } from '@/domain/usage';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

// Usage is live operational state — never cached (browser, CDN, or Next).
const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' } as const;

export async function GET(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;

  const cred = roomCredentialFromRequest(req);
  if (!cred) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });

  const auth = await authorizeDj(slug, cred);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });

  // Account-scoped: the room's single active owner. Ambiguous/absent ownership → no
  // usage (the same fail-safe the atomic RPCs use); the Admin simply shows no banner.
  const entitlement = await readRoomEntitlement(auth.room.id);
  const usage = projectEntitlement(entitlement);

  return NextResponse.json({ usage }, { headers: NO_STORE });
}
