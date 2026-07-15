// YouTube search — server-side only. GET ?q=<query>.
//
// Real YouTube Data API v3 search, karaoke-biased. The API key never leaves the
// server and is never returned. On a missing key (`gated`) or API failure
// (`degraded`) the response still carries a `fallbackUrl` so the guest can open
// a standard YouTube search. Explicit search only — no per-keystroke calls here.

import { NextRequest, NextResponse } from 'next/server';
import { normalizeSearchQuery } from '@/domain/youtube-search';
import { normalizeStyle } from '@/domain/performance-style';
import { SearchQuerySchema } from '@/lib/validation';
import { searchYoutube } from '@/lib/youtube.server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const q = normalizeSearchQuery(req.nextUrl.searchParams.get('q') ?? '');

  const parsed = SearchQuerySchema.safeParse({ q });
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors.q?.[0] ?? 'Invalid query' },
      { status: 400 },
    );
  }

  // Performance Style drives the bias. New callers pass `?style=mr|karaoke|
  // original` (MR is the default). The legacy `?original=1` flag still maps to
  // the Original style for backward compatibility.
  const styleParam = req.nextUrl.searchParams.get('style');
  const original = req.nextUrl.searchParams.get('original') === '1';
  const style = styleParam ? normalizeStyle(styleParam) : original ? 'original' : undefined;
  const result = style
    ? await searchYoutube(parsed.data.q, { style })
    : await searchYoutube(parsed.data.q, { bias: true });
  // result never contains the API key.
  return NextResponse.json(result);
}
