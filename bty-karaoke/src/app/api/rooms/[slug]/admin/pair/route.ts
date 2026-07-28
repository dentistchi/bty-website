// Admin mints a one-use DJ pairing token and gets back a ready-to-show QR. The
// raw token lives ONLY inside the returned pairing URL / QR (never logged, never
// a reusable bearer). Admin authority required.

import { NextRequest, NextResponse } from 'next/server';
import { roomCredentialFromRequest } from '@/lib/dj-auth.server';
import { authorizeAdmin } from '@/lib/rooms.server';
import { mintPairingToken } from '@/lib/pairing.server';
import { qrSvg } from '@/lib/qr.server';
import { PairMintSchema } from '@/lib/validation';
import { pairingSecondsRemaining } from '@/domain/pairing';
import { canonicalGuestOrigin } from '@/domain/guest-origin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const bearer = roomCredentialFromRequest(req);
  if (!bearer) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const auth = await authorizeAdmin(slug, bearer);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let label: string | undefined;
  try {
    const body = await req.json().catch(() => undefined);
    const parsed = PairMintSchema.safeParse(body);
    if (parsed.success) label = parsed.data?.label;
  } catch {
    /* no body is fine */
  }

  const minted = await mintPairingToken({ roomId: auth.room.id, role: 'dj', label });

  const origin = canonicalGuestOrigin();   // BUILD 20B-R1 — no workers.dev in a scanned QR
  const pairUrl = `${origin}/r/${encodeURIComponent(slug)}/dj/pair?token=${encodeURIComponent(minted.token)}`;
  const svg = await qrSvg(pairUrl);

  return NextResponse.json({
    ok: true,
    pairUrl,
    qrSvg: svg,
    expiresAt: minted.expiresAt,
    ttlSeconds: pairingSecondsRemaining(minted.expiresAt, Date.now()),
    roomName: auth.room.display_name,
  });
}
