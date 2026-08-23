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
import { resolveAccountRelease } from '@/lib/release-contract.server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' } as const;

export async function GET(req: NextRequest) {
  const token = bearerFromHeader(req.headers.get('authorization')) ?? hostTokenFromRequest(req);
  const acct = await authorizeHost(token);
  if (!acct) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });

  // ── BUILD 26U-R4 §0 — RELEASE-CONTRACT PROJECTION ────────────────────────────────────────
  //
  // THE HAZARD THIS CLOSES. The public v1.0 binary (build 109) already ships a dormant commerce
  // surface. Activating a catalog row for the v1.1 validation would otherwise make that surface
  // populate on a binary that was approved as FREE, has no Premium Room concept, and cannot
  // explain what the customer would be buying.
  //
  // So a client on the LEGACY contract is told what is true FOR IT: nothing is on sale. The empty
  // list is the same fail-closed shape the route already used when no product was active, so
  // every shipped client — including build 109 — already renders it correctly with no new code.
  //
  // THIS IS A PROJECTION, NOT FINANCIAL AUTHORITY, and the distinction is load-bearing:
  //   * it decides only what a client is SHOWN;
  //   * it can never create entitlement — the chain is still StoreKit offer × server-active
  //     product × verified Apple purchase → fulfilment → grant;
  //   * `/verify` and `/fulfil` are deliberately NOT touched. A purchase a customer legitimately
  //     made must settle even if this projection later hides the product from them — their money
  //     moved, and a display rule must never be able to strand it (COMMERCE-COMPAT-4).
  //
  // Defence in depth, not the only defence: BUILD 26T-R1B-R6's `paidPurchaseCompiledIn` already
  // makes a remote activation inert for any Release build, because the purchase call is not
  // compiled in. This closes the display half for future builds that do compile it in.
  // ACCOUNT-scoped on purpose (BUILD 26U-R4A §6): BTY Room time is bought FOR AN ACCOUNT, so
  // an account inside the controlled rollout may be shown the store. WHERE that time may be
  // spent stays exact (account, room) scoped by `resolveRoomRelease` — the Founder's other
  // rooms, including bty-home, remain legacy while the test room is allowlisted.
  const release = await resolveAccountRelease(req, acct.id);
  if (release.contract !== 'premium') {
    return NextResponse.json(
      { ok: true, products: [], activeCount: 0 },
      { headers: NO_STORE },
    );
  }

  const products = await readActiveCommerceCatalog();

  // `activeCount` is stated rather than left to be inferred from the array length, so an empty
  // list reads as "we are selling nothing right now" instead of as a response that failed to
  // populate. With the BUILD 26T-R0 census (0 of 3 active) the truthful answer is 0.
  return NextResponse.json(
    { ok: true, products, activeCount: products.length },
    { headers: NO_STORE },
  );
}
