// "Songs that go well with this one" — server-resolved to real YouTube results.
// GET ?title=&channel=&videoId=. Separate from primary search so it never blocks
// or delays the main results. Returns [] (section hidden) when unavailable.

import { NextRequest, NextResponse } from 'next/server';
import { normalizeSearchQuery } from '@/domain/youtube-search';
import { getRecommendations } from '@/lib/recommendations.server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const title = normalizeSearchQuery(req.nextUrl.searchParams.get('title') ?? '');
  const channel = normalizeSearchQuery(req.nextUrl.searchParams.get('channel') ?? '');
  const videoId = (req.nextUrl.searchParams.get('videoId') ?? '').trim() || undefined;

  if (!title) return NextResponse.json({ items: [] });

  try {
    const items = await getRecommendations({ title, channelTitle: channel }, videoId);
    return NextResponse.json({ items });
  } catch {
    // Recommendations are best-effort; never surface an error to the guest.
    return NextResponse.json({ items: [] });
  }
}
