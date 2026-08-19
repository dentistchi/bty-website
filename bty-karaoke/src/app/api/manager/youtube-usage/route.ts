// Manager YouTube quota console — READ-ONLY (BUILD R3).
//
// GET -> today's Search Queries consumption, cache efficiency, containment counts, health, and the
// 7/30-day trend, taken verbatim from the existing `karaoke_youtube_search_usage` aggregation RPC.
//
// Requires the EXISTING global Manager authority (the signed `bty_mgr` cookie). There is no second
// admin auth system here, and an unauthenticated caller gets a uniform 401 carrying no telemetry —
// not a count, not a date, not a hint that any data exists.
//
// STRICTLY READ-ONLY: no write, no KV mutation, no search execution, no YouTube Data API call, no
// Google Cloud API call. Opening this console spends ZERO quota, which matters because a monitoring
// surface that consumed the thing it monitors would corrupt its own evidence.

import { NextRequest, NextResponse } from 'next/server';
import { managerEnabled, managerAuthorized } from '@/lib/manager-auth.server';
import { getYoutubeUsage } from '@/lib/youtube-usage.server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' } as const;

export async function GET(req: NextRequest) {
  if (!managerEnabled()) {
    return NextResponse.json(
      { error: 'Usage console is not enabled.' },
      { status: 503, headers: NO_STORE },
    );
  }
  if (!(await managerAuthorized(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
  }

  try {
    const usage = await getYoutubeUsage(30);
    return NextResponse.json({ ok: true, usage }, { headers: NO_STORE });
  } catch {
    // 502, never a 200 with zeros: "no data" and "no calls today" must never look alike, and the
    // upstream error text (which can carry connection or role detail) never reaches the client.
    return NextResponse.json(
      { error: 'Usage data is unavailable.' },
      { status: 502, headers: NO_STORE },
    );
  }
}
