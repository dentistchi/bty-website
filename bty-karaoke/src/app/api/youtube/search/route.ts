// YouTube search — server-side only. GET ?q=<query>.
//
// Real YouTube Data API v3 search, karaoke-biased. The API key never leaves the
// server and is never returned. On a missing key (`gated`) or API failure
// (`degraded`) the response still carries a `fallbackUrl` so the guest can open
// a standard YouTube search. Explicit search only — no per-keystroke calls here.

import { NextRequest, NextResponse } from 'next/server';
import { normalizeSearchQuery, youtubeSearchUrl } from '@/domain/youtube-search';
import { biasStyleQuery, normalizeStyle } from '@/domain/performance-style';

/** The bias `searchYoutube` applies when no explicit style is given (its legacy `bias: true`). */
const DEFAULT_BIAS_STYLE = 'karaoke' as const;
import { SearchQuerySchema } from '@/lib/validation';
import { searchYoutube } from '@/lib/youtube.server';
import { enrichItemsWithDuration } from '@/lib/youtube-duration.server';
import { signYouTubeProvenance } from '@/lib/youtube-provenance.server';
import { checkSearchRateLimit, cloudflareClientIp } from '@/lib/youtube-search-guard.server';
import { recordSearchServe } from '@/lib/youtube-search-telemetry.server';

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

  // BUILD R2.5 — PER-IP CONTAINMENT. This endpoint is public, anonymous and cookieless, and the
  // KV cache only defends against REPEATED queries: unique cold queries miss it every time, so one
  // client could drain the daily grant. The limit is deliberately generous — a singer picking songs
  // all evening never approaches it — and it lives HERE rather than in the service because this is
  // the only layer that sees the edge client IP.
  //
  // A refusal returns 200 with the ordinary `degraded` shape and the YouTube fallback link, rather
  // than a 4xx: every existing client (web and the shipped native build) already renders that as
  // "search is busy, here is the fallback", so containment needs no client release to be usable.
  // `rateLimited` is carried explicitly for future clients and for the admin surface.
  const rate = await checkSearchRateLimit(cloudflareClientIp(req.headers));
  if (!rate.allowed) {
    // Counted as BLOCKED, never as a visible search — and no outbound call is made, so no quota
    // row can exist for it.
    await recordSearchServe('RATE_LIMITED').catch(() => {});
    // The fallback link is biased exactly as a served search would have been, so the guest lands
    // on the search they actually asked for rather than a raw-title one.
    const biasedQuery = biasStyleQuery(parsed.data.q, style ?? DEFAULT_BIAS_STYLE);
    return NextResponse.json({
      ok: false,
      gated: false,
      degraded: true,
      quotaExceeded: false,
      rateLimited: true,
      items: [],
      query: parsed.data.q,
      biasedQuery,
      fallbackUrl: youtubeSearchUrl(biasedQuery),
      youtubeFetchedAt: null,
    });
  }

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
