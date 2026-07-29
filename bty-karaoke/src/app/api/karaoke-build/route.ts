// Served-build proof — BUILD 20B-WEB7-R4.
//
// Returns the build id the LIVE server is running (NEXT_PUBLIC_KARAOKE_BUILD, baked
// at build time). The guest freshness guard fetches this on a bfcache restore to
// decide whether the running tab is stale. Non-secret: exposes only a short build
// identifier — never tokens, accounts, or deployment credentials. force-dynamic +
// no-store so the answer is always the live build, never an edge-cached one.

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const NO_STORE = { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' } as const;

export function GET() {
  const build = process.env.NEXT_PUBLIC_KARAOKE_BUILD ?? 'unknown';
  return NextResponse.json(
    { build },
    { headers: { ...NO_STORE, 'x-karaoke-build': build } },
  );
}
