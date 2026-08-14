// Apple paid fulfilment (BUILD 26S-R1 — Track B Slice 4).
//
// POST (web cookie OR native Bearer host session) { purchaseId } ->
//   atomically settle ONE durably VERIFIED Apple purchase into EXACTLY ONE paid AVAILABLE
//   Timed Pass grant, link both directions, and audit it — all inside a single database
//   transaction (`fulfil_apple_purchase`).
//
// A SIBLING OF /verify, NEVER A REPLACEMENT FOR IT. BUILD 26P's verification endpoint keeps its
// contract exactly: it verifies, records, and grants nothing. Folding fulfilment into it would
// mean the act of presenting a JWS silently became the act of creating entitlement, and the two
// need separate gates because they answer separate questions — "is this payment genuine?" and
// "has this payment been settled?".
//
// SETTLEMENT DOES NOT CHECK `is_active` (BUILD 26S-R0 §8, Contract B). That column authorizes
// ACCEPTANCE of NEW transactions and still guards /verify unchanged. Apple has already charged
// the customer here; refusing to settle a durable VERIFIED purchase because our product is
// switched off would turn a completed payment into a permanent loss.
//
// NO RESPONSE HERE AUTHORIZES `Transaction.finish()`. Not a 200, not a replay. Finishing requires
// the SEPARATE durable read-back at GET /api/host/purchases/apple/fulfilment, because a response
// can be lost or proxied and is not proof that anything committed. This route cannot finish a
// transaction in any case — that authority is native, and belongs to BUILD 26S-R2.
//
// The account is ALWAYS derived server-side from the session. The body carries exactly one field
// (`.strict()`), so there is no accountId, duration, product, or grant attribute to forge.

import { NextRequest, NextResponse } from 'next/server';
import { bearerFromHeader } from '@/lib/dj-auth.server';
import { authorizeHost } from '@/lib/host-auth.server';
import { hostTokenFromRequest } from '@/lib/host-web-session.server';
import { FulfilApplePurchaseSchema } from '@/lib/validation';
import { fulfilApplePurchase, type FulfilApplePurchaseError } from '@/lib/apple-fulfilment.server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' } as const;

async function account(req: NextRequest) {
  const token = bearerFromHeader(req.headers.get('authorization')) ?? hostTokenFromRequest(req);
  return authorizeHost(token);
}

/**
 * 404 — not this account's purchase (or no such purchase). Deliberately indistinguishable.
 * 409 — the purchase is real but not in a state that may be settled.
 * 500 — the durable record contradicts itself. A human must look; nothing is auto-repaired.
 */
function statusFor(error: FulfilApplePurchaseError): number {
  switch (error) {
    case 'purchase_not_found':
      return 404;
    case 'purchase_not_verified':
    case 'purchase_product_unresolved':
    case 'grant_revoked':
    case 'fulfilment_conflict':
      return 409;
    case 'catalog_product_not_found':
    case 'product_identity_mismatch':
    case 'ledger_invariant_conflict':
      return 500;
  }
}

export async function POST(req: NextRequest) {
  const acct = await account(req);
  if (!acct) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400, headers: NO_STORE });
  }
  const parsed = FulfilApplePurchaseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400, headers: NO_STORE });
  }

  const outcome = await fulfilApplePurchase({
    accountId: acct.id,
    purchaseId: parsed.data.purchaseId,
  });

  if (!outcome.ok) {
    return NextResponse.json(
      { ok: false, error: outcome.error, detail: outcome.detail, entitlementIssued: false },
      { status: statusFor(outcome.error), headers: NO_STORE },
    );
  }

  // Durable facts only, and identifiers as fingerprints: the raw Apple transaction id, the
  // appAccountToken and the JWS never travel back to a client that already has, or does not need,
  // them. `authorizesFinish: false` is stated rather than implied, at the one place a reader might
  // infer the opposite from a 200.
  return NextResponse.json(
    { ok: true, ...outcome.fulfilment, authorizesFinish: false },
    { headers: NO_STORE },
  );
}
