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
import { enrichItemsWithDuration } from '@/lib/youtube-duration.server';
import { signYouTubeProvenance } from '@/lib/youtube-provenance.server';

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

  // BUILD 22 — attach the duration verdict so a Guest sees a song's length BEFORE choosing it.
  // Deliberately AFTER the search (including its KV cache read): enrichment costs at most ONE
  // additional videos.list unit for the whole page, versus 100 for the search itself, and a
  // full duration-cache hit costs zero. It never fails the response — an unresolved item comes
  // back `unknown` and stays selectable, so a duration outage can never block requesting.
  const items = await enrichItemsWithDuration(result.items);

  // BUILD 26T-R1B-R6-R1B-R1 — attach server provenance.
  //
  // ONE factual `fetchedAt` for the whole response (§D): every item came from a single YouTube
  // response, so per-item timestamps would be three ways of saying the same thing. But the SEAL is
  // per item, because the client persists exactly one result and the proof must bind THAT
  // snapshot — a response-level seal would let a fresh proof be attached to a different row.
  //
  // No seal is issued when provenance is unknown (legacy cache value, gated/degraded response).
  // An unsealed item is still fully requestable; its write simply records NULL freshness, which
  // retention handles fail-safe. Manufacturing a timestamp here is the one thing we must not do.
  const fetchedAt = result.fetchedAt ?? null;
  const sealed = fetchedAt
    ? await Promise.all(
        items.map(async (it) => ({
          ...it,
          youtubeProvenance: await signYouTubeProvenance(
            {
              videoId: it.videoId,
              title: it.title,
              channelTitle: it.channelTitle,
              thumbnailUrl: it.thumbnailUrl,
            },
            Date.parse(fetchedAt),
          ),
        })),
      )
    : items;

  // result never contains the API key.
  return NextResponse.json({ ...result, items: sealed, youtubeFetchedAt: fetchedAt });
}
