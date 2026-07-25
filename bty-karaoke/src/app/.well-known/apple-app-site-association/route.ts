// AASA at the well-known location (BUILD 19B). HTTPS, 200, no redirect, valid JSON,
// application/json, no file extension, claims only /app/join/*.
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
