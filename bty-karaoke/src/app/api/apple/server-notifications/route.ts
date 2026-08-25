// App Store Server Notifications V2 endpoint (BUILD 26U-R4E-R1).
//
// POST { signedPayload } — Apple's own delivery shape, and the ONLY field read. There is no
// authentication header because there is no shared secret to hold: the JWS itself is the
// credential, verified against a pinned Apple root before a single claim is believed. An
// unverifiable payload mutates nothing at all.
//
// RETRY SEMANTICS (§Q). 200 means applied, or recognised as an already-applied duplicate. A
// processing failure returns 5xx so Apple retries — acknowledging a failure to silence the
// retries would convert a transient outage into a permanently missed refund, which is the exact
// outcome this endpoint exists to prevent. A payload we can verify but cannot act on (an
// unhandled notification type, or a transaction that is not ours) is durably recorded and
// acknowledged, because retrying it forever helps nobody.

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
      { ok: true, handled: outcome.handled, duplicate: outcome.duplicate },
      { status: 200, headers: NO_STORE },
    );
  }
  // An unverifiable or malformed payload is NOT retried: replaying the same bytes cannot make
  // them verify, and Apple's retries would be pure noise. It is refused, and nothing was written.
  if (outcome.code === 'unverifiable' || outcome.code === 'malformed') {
    return NextResponse.json({ error: outcome.code }, { status: 400, headers: NO_STORE });
  }
  // Anything else is ours to fix — ask Apple to come back.
  return NextResponse.json({ error: 'processing_failed' }, { status: 503, headers: NO_STORE });
}
