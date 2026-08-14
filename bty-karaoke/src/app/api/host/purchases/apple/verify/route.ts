// Apple StoreKit transaction verification (BUILD 26P — Track B Slice 3).
//
// POST (web cookie OR native Bearer host session) { signedTransaction } ->
//   verify the Apple-signed JWS against Apple's root, validate the claims, and durably RECORD
//   one karaoke_apple_purchases row.
//
// VERIFY + RECORD. NOT VERIFY + ISSUE. This endpoint never creates a Timed Pass grant, never
// touches entitlement, and never activates a catalog product. BUILD 18C invariant #3 — "Purchase
// does not activate a Pass" — is the contract, and the recorded row is always
// grant_status = NOT_GRANTED.
//
// NO RESPONSE HERE AUTHORIZES `Transaction.finish()`. Not 200, not a replay, not anything. A
// finished transaction is one the customer can never re-present, so finishing it before an
// entitlement exists would destroy the customer's only evidence of a purchase they paid for.
// The future paid-entitlement slice must define its own durable fulfilment gate; until then
// verification and recording are NOT fulfilment.
//
// The account is ALWAYS derived server-side from the session, and every Apple fact comes from the
// VERIFIED payload. The body carries exactly one field (`.strict()`), so there is no accountId,
// appAccountToken, transactionId, productId, environment or bundleId for a caller to forge.
//
// BUILD 26T-R1A-R2 — THE MONEY BOUNDARY. This endpoint no longer refuses a genuine transaction
// because its product is currently inactive. `is_active` authorizes STARTING a charge, not
// settling one that already happened; see step 6 for the full statement and for what was
// deliberately NOT weakened. Every other refusal on this route is unchanged.

import { NextRequest, NextResponse } from 'next/server';
import { bearerFromHeader } from '@/lib/dj-auth.server';
import { authorizeHost } from '@/lib/host-auth.server';
import { hostTokenFromRequest } from '@/lib/host-web-session.server';
import { optionalEnv } from '@/lib/env.server';
import { VerifyAppleTransactionSchema } from '@/lib/validation';
import { verifyAppleSignedTransaction, signedTransactionDigest } from '@/lib/apple-iap.server';
import { validateAppleTransaction } from '@/domain/apple-transaction';
import {
  recordVerifiedApplePurchase,
  resolveCatalogProduct,
  readPurchaseOwnerRef,
} from '@/lib/apple-purchase-ledger.server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' } as const;

/** Same accessor shape apple-auth.server.ts uses for the identity-token audience. */
function expectedBundleId(): string {
  return optionalEnv('KARAOKE_APPLE_BUNDLE_ID') ?? 'com.bty.BTYNorebangAdmin';
}

async function account(req: NextRequest) {
  const token = bearerFromHeader(req.headers.get('authorization')) ?? hostTokenFromRequest(req);
  return authorizeHost(token);
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
  const parsed = VerifyAppleTransactionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400, headers: NO_STORE });
  }
  const signedTransaction = parsed.data.signedTransaction;

  // ---- 1. cryptographic verification, before ANY claim is read ------------------------------
  const verified = await verifyAppleSignedTransaction(signedTransaction);
  if (!verified.ok) {
    // 422: the request was well-formed but the transaction is not something we can trust. None of
    // these write anything — an unverifiable blob leaves no trace in the ledger.
    return NextResponse.json(
      { ok: false, error: verified.code, verified: false, recorded: false, entitlementIssued: false },
      { status: 422, headers: NO_STORE },
    );
  }

  // ---- 2. account binding + domain claims ---------------------------------------------------
  const purchaseOwnerRef = await readPurchaseOwnerRef(acct.id);
  if (!purchaseOwnerRef) {
    return NextResponse.json({ error: 'Server error' }, { status: 500, headers: NO_STORE });
  }

  const decision = validateAppleTransaction({
    claims: verified.claims,
    expectedBundleId: expectedBundleId(),
    // The verifier's OWN environment reading, not an unverified hint from the caller.
    verifiedEnvironment: verified.environment,
    expectedAppAccountToken: purchaseOwnerRef,
  });
  if (!decision.ok) {
    // A binding mismatch is 403 — authenticated, but this payment is not this account's to claim.
    // It reveals nothing about which account it does belong to, and writes nothing.
    const status = decision.code === 'account_binding_mismatch' ? 403 : 422;
    return NextResponse.json(
      { ok: false, error: decision.code, verified: true, recorded: false, entitlementIssued: false },
      { status, headers: NO_STORE },
    );
  }
  const transaction = decision.transaction;

  // ---- 3. catalog authority ------------------------------------------------------------------
  // A product we do not know cannot satisfy the ledger's product_code FK, and we never seed or
  // activate a catalog row inside request handling. The transaction stays unfinished on the
  // client, so a later operational fix can still reconcile it.
  const product = await resolveCatalogProduct(transaction.productId);
  if (!product) {
    return NextResponse.json(
      { ok: false, error: 'unknown_product', verified: true, recorded: false, entitlementIssued: false },
      { status: 422, headers: NO_STORE },
    );
  }

  // ---- 4. durable record ---------------------------------------------------------------------
  // Recorded BEFORE the is_active decision, deliberately: Apple has already charged the customer,
  // so discarding a genuine transaction because our product is not switched on would lose their
  // money silently. Recording it preserves the claim for reconciliation. Recording is not granting.
  const outcome = await recordVerifiedApplePurchase({
    accountId: acct.id,
    purchaseOwnerRef,
    transaction,
    productCode: product.productCode,
    signedTransaction,
    signedTransactionSha256: await signedTransactionDigest(signedTransaction),
  });

  if (!outcome.ok) {
    const status = outcome.code === 'transaction_already_claimed' ? 409 : 500;
    return NextResponse.json(
      { ok: false, error: outcome.code, verified: true, recorded: false, entitlementIssued: false },
      { status, headers: NO_STORE },
    );
  }

  // Deliberately WITHOUT `purchaseId`. A refusal must not hand back a durable row identifier: the
  // revoked and inactive branches below spread this, and addressability is granted only to a
  // caller whose transaction was accepted. See the 200 at the bottom of this function.
  const base = {
    verified: true,
    recorded: true,
    entitlementIssued: false as const,
    replayed: outcome.replayed,
    productCode: outcome.productCode,
  };

  // ---- 5. revoked -----------------------------------------------------------------------------
  // Genuine signature, but Apple says the purchase no longer stands. Recorded as REVOKED for
  // forensics; never entitlement.
  if (transaction.revoked) {
    return NextResponse.json(
      { ok: false, error: 'revoked_transaction', ...base },
      { status: 422, headers: NO_STORE },
    );
  }

  // ---- 6. the money boundary (BUILD 26T-R1A-R2) -------------------------------------------------
  // THERE IS NO `is_active` CHECK HERE ANY MORE, AND ITS ABSENCE IS THE CONTRACT.
  //
  // `karaoke_product_catalog.is_active` is the authority to START a new Apple charge. By the time
  // a signed transaction reaches this endpoint that decision is already spent: Apple has taken the
  // customer's money. Refusing to settle at this point does not undo the charge — it strands it,
  // and the customer's only re-presentable evidence sits unfinished on their device while our
  // ledger declines to converge. An operator toggling a switch must never be able to do that to
  // someone who has already paid.
  //
  // So activation is now formally defined at the money boundary:
  //
  //   BEFORE a charge   is_active authorizes initiation. Enforced by the pre-purchase catalog read
  //                     (BUILD 26T-R1A) and, decisively, by the just-in-time authority taken
  //                     immediately before the app's single `product.purchase` call (R1A-R2).
  //   AFTER a charge    is_active is silent. Settlement converges on the strength of the Apple
  //                     signature, the bindings and the durable ledger — never on a switch.
  //
  // NOTHING ELSE WAS WEAKENED. The signature, the bundle identity, the environment, the product
  // IDENTITY (step 3 — an unknown product is still refused, and an inactive product was never an
  // unknown one), the owner binding, the appAccountToken binding, the replay identity and the
  // revocation branch above all stand exactly as they were.
  //
  // HISTORICAL NOTE. BUILD 26L §5, 26P, 26R-R2 and 26S recorded `product_inactive` here, and under
  // the contract of those milestones that was correct — there was no shipping purchase path, so
  // the only thing this gate could refuse was a transaction we had no way to have originated.
  // BUILD 26T is the first production commerce path, and it made the distinction load-bearing.
  // This is contract evolution; that evidence remains true of the contract it was written against.
  //
  // `product.isActive` is still READ (step 3 resolves it) and is deliberately not consulted, so a
  // future reader can see that the omission is a decision rather than an oversight.

  // Verified, recorded, and settleable. Still no entitlement — that is `/fulfil`'s job.
  //
  // BUILD 26T-R1A-R1 — `purchaseId` is the durable `karaoke_apple_purchases.id` this call just
  // wrote, or, on a replay, the id of the row that already existed. It is ADDITIVE: every field
  // above keeps its name, its type and its meaning, and no status code moves.
  //
  // WHY IT IS HERE NOW. BUILD 26P defined VERIFY + RECORD and withheld the id, which was correct
  // then — there was no caller that needed to address the row, and an identifier nobody uses is
  // surface with no purpose. BUILD 26T built the production settlement pipeline, and `/fulfil`
  // and `/fulfilment` both take exactly this UUID. Without it a genuine paid transaction is
  // recorded and then unreachable. This is a NEW addressability requirement, not a correction.
  //
  // IT IS STILL NOT FULFILMENT. The response grants nothing, issues nothing and authorizes no
  // `Transaction.finish()`. `/fulfil` re-authorizes the caller against the row for itself; being
  // told the id is not being told it is yours to settle.
  //
  // The value is the row's own `gen_random_uuid()` primary key — never the Apple transaction id,
  // the original transaction id, the appAccountToken or the product. It is opaque, and it is the
  // only internal field this endpoint discloses.
  return NextResponse.json(
    { ok: true, ...base, purchaseId: outcome.purchaseId },
    { headers: NO_STORE },
  );
}
