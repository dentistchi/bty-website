// Apple paid fulfilment (BUILD 26S-R1, Slice 4). VERIFIED PURCHASE -> ONE DURABLE PAID GRANT.
//
// BUILD 26P recorded that a genuine Apple transaction happened. This module is what turns one
// into entitlement — and it is deliberately thin, because the entire operation belongs to the
// database. `fulfil_apple_purchase` performs the grant INSERT, the ledger UPDATE and the audit
// INSERT inside ONE PostgreSQL transaction; doing that here, as three supabase-js calls, would be
// three transactions with two crash windows between them. BUILD 26S-R0 measured that gap.
//
// NOTHING THIS MODULE RETURNS AUTHORIZES `Transaction.finish()`. A successful fulfilment is a
// necessary condition, never a sufficient one: the R2 predicate additionally requires a SEPARATE
// durable read-back (`readApplePurchaseFulfilment` below), because a response can be lost,
// proxied, or reflect a transaction that has not committed. Finishing destroys the customer's
// only re-presentable evidence of a purchase they paid for, so the bar is proof of durability.
//
// SETTLEMENT DOES NOT CONSULT `is_active`. BUILD 26S-R0 §8 Contract B: that column authorizes
// ACCEPTANCE of NEW transactions, which is the /verify route's gate and stays exactly as it is.
// It is not a settlement gate — the money was already taken.

import { karaokeDb } from './supabase.server';
import { sha256Hex } from './dj-auth.server';

/**
 * The native `PassGateFingerprint.of` contract, reproduced byte-for-byte: lowercase the value,
 * SHA-256 it, take the first 12 hex characters, append '…'. Identical on both sides so R2 can
 * compare a device-side fingerprint to a server-side one with plain string equality — a subtly
 * different fingerprint would read as a mismatch in the evidence chain rather than as a bug.
 */
async function fingerprint(value: string | null | undefined): Promise<string> {
  if (!value) return 'nil';
  return `${(await sha256Hex(value.toLowerCase())).slice(0, 12)}…`;
}

export type FulfilApplePurchaseError =
  /** No such purchase FOR THIS ACCOUNT. Says nothing about whether it exists elsewhere. */
  | 'purchase_not_found'
  /** Apple did not vouch for it, or withdrew it. FAILED/REVOKED/PENDING are never fulfilled. */
  | 'purchase_not_verified'
  /** Recorded before the catalog could name the product; there is nothing to resolve a duration from. */
  | 'purchase_product_unresolved'
  /** The catalog row the ledger points at has vanished. Structurally near-impossible (FK RESTRICT). */
  | 'catalog_product_not_found'
  /** Ledger and catalog disagree about which Apple product was bought. Neither may win silently. */
  | 'product_identity_mismatch'
  /** The grant was issued and later revoked. Re-issuing is an operational act, never automatic. */
  | 'grant_revoked'
  /** A duplicate arrived by a path that did not take the account lock. Nothing was written. */
  | 'fulfilment_conflict'
  /** The durable record contradicts itself. Surfaced for forensics, NEVER repaired. */
  | 'ledger_invariant_conflict';

/** The durable facts a fulfilment produced. Fingerprints, never raw Apple identifiers. */
export interface ApplePaidFulfilment {
  purchaseId: string;
  grantStatus: 'GRANTED';
  passGrantId: string;
  grantedSeconds: number;
  environment: string;
  storekitProductId: string;
  productCode: string;
  passType: string;
  sourceType: 'PAID';
  isPaid: true;
  /** The grant's own lifecycle status — 'AVAILABLE' for a fresh paid grant. */
  passStatus: string;
  /** 12-hex SHA-256 prefix + '…', byte-identical to the native `PassGateFingerprint.of`. */
  transactionFingerprint: string;
  appAccountTokenFingerprint: string;
  /** true when this call found the purchase already fulfilled and wrote nothing. */
  replayed: boolean;
}

export type FulfilApplePurchaseOutcome =
  | { ok: true; fulfilment: ApplePaidFulfilment }
  | { ok: false; error: FulfilApplePurchaseError; detail?: string };

function toFulfilment(row: Record<string, unknown>): ApplePaidFulfilment {
  return {
    purchaseId: String(row.purchaseId),
    grantStatus: 'GRANTED',
    passGrantId: String(row.passGrantId),
    grantedSeconds: Number(row.grantedSeconds),
    environment: String(row.environment),
    storekitProductId: String(row.storekitProductId),
    productCode: String(row.productCode),
    passType: String(row.passType),
    sourceType: 'PAID',
    isPaid: true,
    passStatus: String(row.grantStatusOfGrant),
    transactionFingerprint: String(row.transactionFingerprint),
    appAccountTokenFingerprint: String(row.appAccountTokenFingerprint),
    replayed: row.replayed === true,
  };
}

/**
 * Settle ONE durably VERIFIED Apple purchase into EXACTLY ONE paid AVAILABLE grant.
 *
 * `accountId` is SERVER-DERIVED from the authenticated session and is never read from a request
 * body. It scopes the lookup inside the same transaction that performs the write, so there is no
 * read-then-write window a cross-account claim could pass through — the reason the RPC takes it
 * rather than trusting a check performed out here. A wrong value can only produce
 * `purchase_not_found`; it can never move a payment to another account.
 *
 * Replay is idempotent at three independent levels (see the migration header), so a retried call
 * returns the SAME `passGrantId` and writes nothing.
 */
export async function fulfilApplePurchase(input: {
  accountId: string;
  purchaseId: string;
}): Promise<FulfilApplePurchaseOutcome> {
  const { data, error } = await karaokeDb().rpc('fulfil_apple_purchase', {
    p_purchase_id: input.purchaseId,
    p_account_id: input.accountId,
  });
  if (error) throw error;
  const row = (data ?? {}) as Record<string, unknown>;
  if (row.ok !== true) {
    return {
      ok: false,
      error: String(row.error ?? 'ledger_invariant_conflict') as FulfilApplePurchaseError,
      detail: row.detail == null ? undefined : String(row.detail),
    };
  }
  return { ok: true, fulfilment: toFulfilment(row) };
}

// ── The R2 durable read-back seam (READ ONLY) ────────────────────────────────

export interface FulfilmentReadback {
  purchaseId: string;
  accountMatches: boolean;
  verificationStatus: string;
  grantStatus: string;
  passGrantId: string | null;
  grantedSeconds: number | null;
  environment: string;
  storekitProductId: string;
  productCode: string | null;
  /** Same 12-hex+'…' form the fulfilment response and the native client produce. */
  transactionFingerprint: string;
  appAccountTokenFingerprint: string;
  grant: {
    id: string;
    accountMatches: boolean;
    applePurchaseIdMatches: boolean;
    sourceType: string;
    isPaid: boolean;
    passType: string;
    durationSeconds: number;
    status: string;
  } | null;
  /**
   * The single question R2 asks. TRUE only when every linkage fact holds simultaneously; it is
   * computed from what was read, never asserted, and a FALSE never triggers a repair.
   */
  linkageVerified: boolean;
}

const PURCHASE_COLS =
  'id, account_id, purchase_owner_ref, environment, apple_transaction_id, storekit_product_id, product_code, verification_status, grant_status, pass_grant_id, granted_seconds';
const GRANT_COLS =
  'id, account_id, apple_purchase_id, source_type, is_paid, pass_type, duration_seconds, carryover_seconds, status';

/**
 * Prove, in a SEPARATE request from the one that wrote it, that a purchase maps to a durable,
 * committed paid grant for this account and product.
 *
 * This exists because a fulfilment RESPONSE is not evidence of a fulfilment. R2 may finish an
 * Apple transaction only after this read agrees, and this read touches nothing: it is two selects
 * and a comparison. A drifted linkage returns `linkageVerified: false` with the facts that
 * disagree — it never rewrites them.
 */
export async function readApplePurchaseFulfilment(input: {
  accountId: string;
  purchaseId: string;
}): Promise<FulfilmentReadback | null> {
  const db = karaokeDb();
  const { data: p, error } = await db
    .from('karaoke_apple_purchases')
    .select(PURCHASE_COLS)
    .eq('id', input.purchaseId)
    .maybeSingle();
  if (error) throw error;
  if (!p) return null;
  const pr = p as Record<string, unknown>;

  // Ownership is checked here, not in the query, so a purchase belonging to someone else is
  // reported as absent rather than as a permission error that confirms it exists.
  const accountMatches = String(pr.account_id) === input.accountId;
  if (!accountMatches) return null;

  const passGrantId = pr.pass_grant_id == null ? null : String(pr.pass_grant_id);
  let grant: FulfilmentReadback['grant'] = null;
  if (passGrantId) {
    const { data: g, error: gErr } = await db
      .from('timed_access_pass_grants')
      .select(GRANT_COLS)
      .eq('id', passGrantId)
      .maybeSingle();
    if (gErr) throw gErr;
    if (g) {
      const gr = g as Record<string, unknown>;
      grant = {
        id: String(gr.id),
        accountMatches: String(gr.account_id) === input.accountId,
        applePurchaseIdMatches: String(gr.apple_purchase_id) === String(pr.id),
        sourceType: String(gr.source_type),
        isPaid: gr.is_paid === true,
        passType: String(gr.pass_type),
        durationSeconds: Number(gr.duration_seconds),
        status: String(gr.status),
      };
    }
  }

  const grantedSeconds = pr.granted_seconds == null ? null : Number(pr.granted_seconds);
  const linkageVerified =
    accountMatches &&
    String(pr.verification_status) === 'VERIFIED' &&
    String(pr.grant_status) === 'GRANTED' &&
    passGrantId != null &&
    grant != null &&
    grant.accountMatches &&
    grant.applePurchaseIdMatches &&
    grant.sourceType === 'PAID' &&
    grant.isPaid &&
    grantedSeconds != null &&
    grant.durationSeconds === grantedSeconds;

  return {
    purchaseId: String(pr.id),
    accountMatches,
    verificationStatus: String(pr.verification_status),
    grantStatus: String(pr.grant_status),
    passGrantId,
    grantedSeconds,
    environment: String(pr.environment),
    storekitProductId: String(pr.storekit_product_id),
    productCode: pr.product_code == null ? null : String(pr.product_code),
    transactionFingerprint: await fingerprint(String(pr.apple_transaction_id)),
    appAccountTokenFingerprint: await fingerprint(String(pr.purchase_owner_ref)),
    grant,
    linkageVerified,
  };
}
