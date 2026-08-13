// The Apple purchase ledger writer (BUILD 26P, Slice 3). VERIFY + DURABLY RECORD.
//
// WHAT THIS DOES NOT DO, deliberately: it never creates a Timed Pass grant. BUILD 26P records
// that a genuine Apple transaction happened; it does not turn one into entitlement. Every row
// this module writes is `grant_status = 'NOT_GRANTED'`, `pass_grant_id = NULL`,
// `granted_seconds = NULL` — the shape BUILD 26L's `grant_linkage_chk` was designed to allow, and
// what BUILD 18C invariant #3 ("Purchase does not activate a Pass") requires.
//
// IDEMPOTENCY IS THE DATABASE'S JOB. `karaoke_apple_purchases_env_txn_idx` is
// UNIQUE (environment, apple_transaction_id). We INSERT and handle the conflict; we never SELECT
// first and then INSERT. BUILD 26O-R1 is the reason that distinction is written down: a read
// cannot serialize two concurrent callers, and the window between the read and the write is
// exactly where a duplicate — or a cross-account claim — gets through. The unique index has no
// such window.
//
// OWNERSHIP NEVER MOVES. On conflict we read the durable winner and classify. A replay by the
// same account is idempotent; a different account is refused. No path UPDATEs an existing
// transaction into another account, and no path rewrites verified Apple facts.

import { karaokeDb } from './supabase.server';
import type { AcceptedAppleTransaction } from '@/domain/apple-transaction';

function is23505(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === '23505';
}

export type LedgerOutcome =
  /** A new row was written for this transaction. */
  | { ok: true; purchaseId: string; productCode: string; replayed: false }
  /** This exact transaction was already recorded for THIS account. */
  | { ok: true; purchaseId: string; productCode: string; replayed: true }
  /** The (environment, transactionId) identity belongs to a different account. */
  | { ok: false; code: 'transaction_already_claimed' }
  /**
   * The stored row contradicts immutable verified Apple facts. This should be impossible; it is
   * surfaced rather than silently reconciled, because quietly rewriting history is how a ledger
   * stops being evidence.
   */
  | { ok: false; code: 'ledger_invariant_conflict' };

export interface RecordArgs {
  accountId: string;
  purchaseOwnerRef: string;
  transaction: AcceptedAppleTransaction;
  /** Catalog row resolved from the VERIFIED productId — never from the request. */
  productCode: string;
  signedTransaction: string;
  signedTransactionSha256: string;
}

const ROW_COLS = 'id, account_id, product_code, apple_transaction_id, environment, verification_status, grant_status, pass_grant_id';

/**
 * Durably record one verified Apple transaction.
 *
 * A revoked transaction is recorded as `verification_status = 'REVOKED'`: the signature is
 * genuine (so it is not a verification FAILURE), but Apple says the purchase no longer stands.
 * The `verification_status` CHECK admits exactly that value, so this is the schema's own
 * vocabulary rather than an invented meaning. It still grants nothing.
 */
export async function recordVerifiedApplePurchase(args: RecordArgs): Promise<LedgerOutcome> {
  const db = karaokeDb();
  const t = args.transaction;

  const row = {
    account_id: args.accountId,
    purchase_owner_ref: args.purchaseOwnerRef,
    environment: t.environment,
    apple_transaction_id: t.transactionId,
    apple_original_transaction_id: t.originalTransactionId,
    storekit_product_id: t.productId,
    product_code: args.productCode,
    purchase_date: t.purchaseDate,
    quantity: t.quantity,
    signed_transaction_payload: args.signedTransaction,
    signed_transaction_sha256: args.signedTransactionSha256,
    // Genuine signature + Apple-declared revocation => REVOKED, not FAILED.
    verification_status: t.revoked ? 'REVOKED' : 'VERIFIED',
    verified_at: new Date().toISOString(),
    verification_attempts: 1,
    // BUILD 26P grants nothing. These three move together or not at all (grant_linkage_chk).
    grant_status: 'NOT_GRANTED',
    granted_seconds: null,
    pass_grant_id: null,
    refunded_at: t.revoked ? t.revocationDate : null,
    revoked_at: t.revoked ? t.revocationDate : null,
    revocation_reason: t.revoked ? String(t.revocationReason ?? 'apple_revoked') : null,
    source: 'STOREKIT_CLIENT',
  };

  const { data, error } = await db
    .from('karaoke_apple_purchases')
    .insert(row)
    .select(ROW_COLS)
    .maybeSingle();

  if (!error && data) {
    return {
      ok: true,
      purchaseId: String((data as { id: unknown }).id),
      productCode: args.productCode,
      replayed: false,
    };
  }
  if (!error) return { ok: false, code: 'ledger_invariant_conflict' };
  if (!is23505(error)) throw error;

  // ---- the unique index fired: read the durable winner and classify -------------------------
  const { data: existing, error: readError } = await db
    .from('karaoke_apple_purchases')
    .select(ROW_COLS)
    .eq('environment', t.environment)
    .eq('apple_transaction_id', t.transactionId)
    .maybeSingle();
  if (readError) throw readError;
  // The row vanished between the failed insert and this read — surface the real error rather
  // than inventing an outcome.
  if (!existing) throw error;

  const winner = existing as Record<string, unknown>;

  // A different account owns this payment. Refuse, and say NOTHING about who: the caller learns
  // only that the transaction is not theirs to claim.
  if (String(winner.account_id) !== args.accountId) {
    return { ok: false, code: 'transaction_already_claimed' };
  }

  // Same account, same transaction — but the immutable facts must still agree. If the stored
  // product differs from the verified one, something is wrong that a replay must not paper over.
  if (String(winner.product_code) !== args.productCode) {
    return { ok: false, code: 'ledger_invariant_conflict' };
  }

  return {
    ok: true,
    purchaseId: String(winner.id),
    productCode: String(winner.product_code),
    replayed: true,
  };
}

/**
 * The account's `purchase_owner_ref` — the value Apple's `appAccountToken` must equal.
 *
 * BUILD 26E created it as an independent random UUID (not the primary key, not `authority_ref`)
 * precisely so Apple never sees an account primary key, and BUILD 26L §11 designates it as the
 * appAccountToken carrier. Read here rather than widened into `authorizeHost`, so BUILD 26P
 * touches no authentication code.
 */
export async function readPurchaseOwnerRef(accountId: string): Promise<string | null> {
  const { data, error } = await karaokeDb()
    .from('karaoke_accounts')
    .select('purchase_owner_ref')
    .eq('id', accountId)
    .maybeSingle();
  if (error) throw error;
  const ref = (data as { purchase_owner_ref?: unknown } | null)?.purchase_owner_ref;
  return typeof ref === 'string' && ref.length > 0 ? ref : null;
}

/** Resolve the VERIFIED Apple productId against the catalog. Never seeds or activates a row. */
export async function resolveCatalogProduct(
  storekitProductId: string,
): Promise<{ productCode: string; isActive: boolean } | null> {
  const { data, error } = await karaokeDb()
    .from('karaoke_product_catalog')
    .select('product_code, is_active')
    .eq('storekit_product_id', storekitProductId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as { product_code: string; is_active: boolean };
  return { productCode: row.product_code, isActive: row.is_active === true };
}
