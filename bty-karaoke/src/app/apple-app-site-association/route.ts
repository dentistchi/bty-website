// AASA at the root location (BUILD 19B) — served alongside /.well-known for older clients.
import { NextResponse } from 'next/server';
import { APPLE_APP_SITE_ASSOCIATION } from '@/domain/aasa';

export const dynamic = 'force-static';
export const runtime = 'nodejs';

export function GET() {
  return NextResponse.json(APPLE_APP_SITE_ASSOCIATION, {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600' },
  });
}
