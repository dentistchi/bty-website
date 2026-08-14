// Pre-purchase commerce catalog (BUILD 26T-R1A).
//
// GET (web cookie OR native Bearer host session) -> { ok, products, activeCount }
//   the products the BTY server is CURRENTLY willing to accept a new paid transaction for.
//
// WHY IT EXISTS. BUILD 26T-R0 measured that `is_active` is consulted only inside `/verify` — after
// a signed transaction arrives, which is after Apple has already charged the customer. Without
// this read, the first time a client could learn we are not selling is the moment after the money
// moved. This is the read that lets a client refuse BEFORE the purchase sheet opens.
//
// STRICTLY READ ONLY. One select. It never writes, never activates anything, and returns no
// financial row, no account data and no price — price belongs to Apple and is read from StoreKit's
// localized product on the device.
//
// IT IS NOT THE GATE. `/verify` keeps its own independent `is_active` check, unchanged. This
// endpoint is a courtesy to the customer, not a replacement for the check that protects the
// ledger, and the client is required to ALSO see the product offered by StoreKit before a purchase
// may begin (the BUILD 26T-R1A dual gate).
//
// Authenticated Host only, and the answer is account-independent: activation is an operational
// property of the product, not of the caller. The session is required so the surface is not a
// public description of our commerce posture.

import { NextRequest, NextResponse } from 'next/server';
import { bearerFromHeader } from '@/lib/dj-auth.server';
import { authorizeHost } from '@/lib/host-auth.server';
import { hostTokenFromRequest } from '@/lib/host-web-session.server';
import { readActiveCommerceCatalog } from '@/lib/commerce-catalog.server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' } as const;

export async function GET(req: NextRequest) {
  const token = bearerFromHeader(req.headers.get('authorization')) ?? hostTokenFromRequest(req);
  const acct = await authorizeHost(token);
  if (!acct) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });

  const products = await readActiveCommerceCatalog();

  // `activeCount` is stated rather than left to be inferred from the array length, so an empty
  // list reads as "we are selling nothing right now" instead of as a response that failed to
  // populate. With the BUILD 26T-R0 census (0 of 3 active) the truthful answer is 0.
  return NextResponse.json(
    { ok: true, products, activeCount: products.length },
    { headers: NO_STORE },
  );
}
