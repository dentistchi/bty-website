// App Store Server Notifications V2 endpoint (BUILD 26U-R4E-R1).
//
// POST { signedPayload } — Apple's own delivery shape, and the ONLY field read. There is no
// authentication header because there is no shared secret to hold: the JWS itself is the
// credential, verified against a pinned Apple root before a single claim is believed. An
// unverifiable payload mutates nothing at all.
//
// RETRY SEMANTICS (§Q, corrected by BUILD 26U-R4G-R1). 200 means applied, or that a prior inbox
// row is ALREADY in a successfully terminal state — APPLIED or IGNORED. It no longer means "we
// have a row with this uuid", which is what let a verified refund whose apply had failed be
// acknowledged on the very next retry and lost. A processing failure returns 5xx so Apple retries.
// An unhandled notification type is durably recorded, marked IGNORED and acknowledged, because
// retrying it forever helps nobody.

import { NextRequest, NextResponse } from 'next/server';
import { handleAppleServerNotification } from '@/lib/apple-server-notifications.server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' } as const;

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400, headers: NO_STORE });
  }
  const signedPayload = (body as { signedPayload?: unknown } | null)?.signedPayload;
  if (typeof signedPayload !== 'string' || signedPayload === '') {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400, headers: NO_STORE });
  }

  const outcome = await handleAppleServerNotification(signedPayload);

  if (outcome.ok) {
    return NextResponse.json(
      {
        ok: true,
        handled: outcome.handled,
        duplicate: outcome.duplicate,
        // BUILD 26U-R4G-R1 — `duplicate` now means "already successfully handled", never "we have
        // seen this uuid". The disposition says which of the four things actually happened, so an
        // operator reading a response can tell a first application from a repair.
        disposition: outcome.disposition,
      },
      { status: 200, headers: NO_STORE },
    );
  }
  // An unverifiable or malformed payload is NOT retried: replaying the same bytes cannot make
  // them verify, and Apple's retries would be pure noise. It is refused, and nothing was written.
  if (outcome.code === 'unverifiable' || outcome.code === 'malformed') {
    return NextResponse.json({ error: outcome.code }, { status: 400, headers: NO_STORE });
  }
  // Anything else is ours to fix — ask Apple to come back. That deliberately includes
  // `not_found`: BUILD 26U-R4G-R1 stopped treating "we have no such purchase" as terminal,
  // because fulfilment and Apple's notification are independent arrivals with no guaranteed
  // order, and a refund that lands first is not a refund that does not apply.
  return NextResponse.json({ error: 'processing_failed' }, { status: 503, headers: NO_STORE });
}
