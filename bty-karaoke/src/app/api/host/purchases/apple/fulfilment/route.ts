// Apple fulfilment durable read-back (BUILD 26S-R1 — the R2 finish gate's evidence source).
//
// GET (web cookie OR native Bearer host session) ?purchaseId=<uuid> ->
//   the durable purchase <-> paid-grant linkage for THIS account, and one boolean saying whether
//   every linkage fact holds at once.
//
// WHY THIS EXISTS SEPARATELY FROM /fulfil. BUILD 26S-R2 may call `Transaction.finish()` only after
// the server PROVES the transaction maps to a committed paid grant. A fulfilment response cannot
// be that proof: it can be lost, replayed from a cache, served by a proxy, or describe a
// transaction that did not commit. A second, independent read is the only thing that establishes
// durability — so the finish predicate requires one, and this is it.
//
// STRICTLY READ ONLY. Two selects and a comparison. It never fulfils, never repairs a drifted
// linkage, and never writes. A linkage that disagrees is REPORTED (`linkageVerified: false`) with
// the facts that disagree, because quietly reconciling a financial record is how a ledger stops
// being evidence.
//
// A purchase belonging to another account is reported as 404, exactly as an absent one is: the
// caller learns only that it is not theirs to read.

import { NextRequest, NextResponse } from 'next/server';
import { bearerFromHeader } from '@/lib/dj-auth.server';
import { authorizeHost } from '@/lib/host-auth.server';
import { hostTokenFromRequest } from '@/lib/host-web-session.server';
import { readApplePurchaseFulfilment } from '@/lib/apple-fulfilment.server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' } as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function account(req: NextRequest) {
  const token = bearerFromHeader(req.headers.get('authorization')) ?? hostTokenFromRequest(req);
  return authorizeHost(token);
}

export async function GET(req: NextRequest) {
  const acct = await account(req);
  if (!acct) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });

  const purchaseId = req.nextUrl.searchParams.get('purchaseId') ?? '';
  if (!UUID.test(purchaseId)) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400, headers: NO_STORE });
  }

  const readback = await readApplePurchaseFulfilment({ accountId: acct.id, purchaseId });
  if (!readback) {
    return NextResponse.json({ ok: false, error: 'purchase_not_found' }, { status: 404, headers: NO_STORE });
  }

  // `authorizesFinish` mirrors `linkageVerified` because this read is the LAST of the finish
  // predicate's clauses to be satisfied — but it remains the CLIENT's job to also match the
  // transaction identity, account and product it holds locally. The server can prove durability;
  // only the device can prove it is the same transaction in its own queue.
  return NextResponse.json(
    { ok: true, ...readback, authorizesFinish: readback.linkageVerified },
    { headers: NO_STORE },
  );
}
