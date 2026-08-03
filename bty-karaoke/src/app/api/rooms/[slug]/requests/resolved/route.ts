// BUILD 25 — owner-only resolved-request retrieval.
//
// POST because the request carries capability tokens, and a token in a URL leaks into access
// logs, Referer headers, and browser history. Nothing about this endpoint is a mutation.
//
// PRIVACY CONTRACT, in the order it is enforced:
//   1. every (requestId, token) pair is verified BEFORE any database read — an unproven id never
//      reaches a query;
//   2. Event scope is resolved CANONICALLY from the room, never from the caller;
//   3. the response is built key by key from an allowlist, so no column can leak by accident;
//   4. an unexpected failure returns a fixed sentence — never database error text.
//
// The sibling `GET /requests/[id]` stays public and deliberately still omits every resolution
// field: it has no capability check, so a reason there would be readable by anyone holding an id.

import { NextRequest, NextResponse } from 'next/server';
import { ResolvedRequestsSchema } from '@/lib/validation';
import { getPublicRoomBySlug } from '@/lib/rooms.server';
import { getCanonicalEvent } from '@/lib/events.server';
import { verifyOwnedClaims, listOwnedResolvedRequests } from '@/lib/request-resolution.server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

// Resolution state is per-guest and changes the moment a Host acts — it must never be served
// from a browser, CDN, or Next cache, exactly like the live queue position.
const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' } as const;

export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400, headers: NO_STORE });
  }
  const parsed = ResolvedRequestsSchema.safeParse(body);
  if (!parsed.success) {
    // The Zod issue list is deliberately not echoed — it would restate the caller's own payload
    // and invites probing the schema.
    return NextResponse.json({ error: 'Validation failed' }, { status: 400, headers: NO_STORE });
  }

  const room = await getPublicRoomBySlug(slug);
  if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404, headers: NO_STORE });

  try {
    // Ownership first. Claims that fail are dropped, not reported: telling a caller WHICH ids it
    // failed to prove would confirm that those ids exist.
    const verified = await verifyOwnedClaims(parsed.data.items);
    if (verified.length === 0) {
      // An honest client whose capabilities have all expired gets the same shape as a prober:
      // an empty list. No 403 — the difference between "not yours" and "does not exist" is
      // exactly what must not be observable here.
      return NextResponse.json({ resolved: [] }, { headers: NO_STORE });
    }

    // Canonical Event, from the SERVER. A stale client still polling a previous Event sends ids
    // that simply do not match this scope and gets nothing back for them.
    const live = await getCanonicalEvent(room.id);
    const resolved = await listOwnedResolvedRequests(room.id, live?.id ?? null, verified);

    return NextResponse.json(
      { resolved, eventId: live?.id ?? null },
      { headers: NO_STORE },
    );
  } catch {
    // Never surface the underlying error: a Postgres message can carry column names, constraint
    // names, and row content. One fixed sentence, and the caller can retry.
    return NextResponse.json(
      { error: 'Could not load request results.' },
      { status: 503, headers: NO_STORE },
    );
  }
}
