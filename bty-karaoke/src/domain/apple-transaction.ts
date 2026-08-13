// Pure validation of a VERIFIED Apple StoreKit transaction's CLAIMS (BUILD 26P, Track B Slice 3).
// No I/O: the server verifies the JWS signature and certificate chain first, then hands the
// decoded payload here. Keeping the rule set pure makes every rejection path exhaustively
// testable without a network, a device, or a live Apple transaction.
//
// This module NEVER decides trust on its own. A caller that skips the chain check and calls only
// this function has proved nothing — the claims below are attacker-controlled until
// `apple-iap.server.ts` has anchored the chain to Apple's root. Same two-halves discipline as
// apple-identity.ts.
//
// FULFILMENT IS NOT DECIDED HERE, and is not decided by BUILD 26P at all. An `ok: true` decision
// means "this transaction is genuine and we may durably record it" — it does NOT mean an
// entitlement was granted, and it is NOT a signal for the future native client to call
// `Transaction.finish()`. Verification and recording are not fulfilment.

/** The subset of Apple's JWSTransaction payload we rely on. All values start untrusted. */
export interface AppleTransactionClaims {
  transactionId?: unknown;
  originalTransactionId?: unknown;
  bundleId?: unknown;
  productId?: unknown;
  purchaseDate?: unknown;
  quantity?: unknown;
  type?: unknown;
  inAppOwnershipType?: unknown;
  environment?: unknown;
  appAccountToken?: unknown;
  revocationDate?: unknown;
  revocationReason?: unknown;
}

/** The Apple environments we accept. They are DISTINCT authorities and never normalised together. */
export type AppleEnvironment = 'Sandbox' | 'Production';

/** BUILD 18C ships consumables only; an auto-renewable would be a different product contract. */
export const ACCEPTED_TRANSACTION_TYPES = ['Consumable'] as const;

/**
 * The verified facts we are willing to act on. Every field here came out of a payload whose
 * signature chained to Apple's root — none of it came from the request body.
 */
export interface AcceptedAppleTransaction {
  transactionId: string;
  originalTransactionId: string;
  bundleId: string;
  productId: string;
  environment: AppleEnvironment;
  purchaseDate: string | null;
  quantity: number;
  appAccountToken: string;
  /** True when Apple says this transaction is revoked/refunded. Recorded, never granted. */
  revoked: boolean;
  revocationDate: string | null;
  revocationReason: number | null;
}

export type AppleTransactionDecision =
  | { ok: true; transaction: AcceptedAppleTransaction }
  | { ok: false; code: AppleTransactionRejection };

/** Stable machine codes. The route maps these to HTTP; nothing here knows about HTTP. */
export type AppleTransactionRejection =
  | 'malformed_transaction'
  | 'wrong_bundle_id'
  | 'environment_not_accepted'
  | 'environment_mismatch'
  | 'unsupported_transaction_type'
  | 'invalid_quantity'
  | 'missing_app_account_token'
  | 'account_binding_mismatch';

export interface ValidateTransactionArgs {
  claims: AppleTransactionClaims;
  /** The bundle id this deployment ships. A transaction for another app is not ours. */
  expectedBundleId: string;
  /**
   * The environment the VERIFIER established, independently of the payload. The payload's own
   * `environment` must equal it. This is what stops an unverified hint from steering the check:
   * the hint may select a verifier, but the verifier's own conclusion is what is compared here.
   */
  verifiedEnvironment: AppleEnvironment;
  /**
   * `purchase_owner_ref` of the AUTHENTICATED account — never a body field. Apple's
   * `appAccountToken` must equal this, which is what binds a payment to a Host account.
   */
  expectedAppAccountToken: string;
}

const isNonEmptyString = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;

/** Apple sends millisecond epochs for dates; normalise to ISO or null. Never throws. */
function isoFromAppleDate(v: unknown): string | null {
  if (typeof v !== 'number' || !Number.isFinite(v)) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** UUID comparison that cannot be fooled by case or surrounding whitespace. */
const normalizeUuid = (v: string) => v.trim().toLowerCase();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * Validate the claims of an already-cryptographically-verified transaction.
 *
 * Order matters: shape → app → environment → product contract → account binding. Each rejection
 * is a distinct code so the caller can answer honestly instead of collapsing everything into
 * "invalid".
 */
export function validateAppleTransaction(args: ValidateTransactionArgs): AppleTransactionDecision {
  const { claims, expectedBundleId, verifiedEnvironment, expectedAppAccountToken } = args;

  // ---- shape -------------------------------------------------------------------------------
  if (!isNonEmptyString(claims.transactionId)) return { ok: false, code: 'malformed_transaction' };
  if (!isNonEmptyString(claims.productId)) return { ok: false, code: 'malformed_transaction' };
  if (!isNonEmptyString(claims.bundleId)) return { ok: false, code: 'malformed_transaction' };
  // Apple omits originalTransactionId only when it equals transactionId (a first purchase).
  const originalTransactionId = isNonEmptyString(claims.originalTransactionId)
    ? claims.originalTransactionId
    : claims.transactionId;

  // ---- this app ----------------------------------------------------------------------------
  if (claims.bundleId !== expectedBundleId) return { ok: false, code: 'wrong_bundle_id' };

  // ---- environment: the payload must AGREE with what the verifier established ---------------
  if (claims.environment !== 'Sandbox' && claims.environment !== 'Production') {
    return { ok: false, code: 'environment_not_accepted' };
  }
  if (claims.environment !== verifiedEnvironment) {
    // A Sandbox payload presented down a Production-verified path, or the reverse. Sandbox and
    // Production are separate ID spaces (BUILD 26L FD-3); collapsing them is how a sandbox
    // transaction could ever be mistaken for a paid one.
    return { ok: false, code: 'environment_mismatch' };
  }

  // ---- product contract --------------------------------------------------------------------
  if (claims.type !== undefined && !ACCEPTED_TRANSACTION_TYPES.includes(claims.type as never)) {
    return { ok: false, code: 'unsupported_transaction_type' };
  }
  const quantity = typeof claims.quantity === 'number' ? claims.quantity : 1;
  if (!Number.isInteger(quantity) || quantity < 1) return { ok: false, code: 'invalid_quantity' };

  // ---- account binding ---------------------------------------------------------------------
  // BUILD 26P requires it: there are ZERO legacy Apple purchases, so there is no population for a
  // bypass to serve, and adding one would only create a way to land a payment on the wrong account.
  if (!isNonEmptyString(claims.appAccountToken)) {
    return { ok: false, code: 'missing_app_account_token' };
  }
  const token = normalizeUuid(claims.appAccountToken);
  if (!UUID_RE.test(token)) return { ok: false, code: 'missing_app_account_token' };
  if (token !== normalizeUuid(expectedAppAccountToken)) {
    return { ok: false, code: 'account_binding_mismatch' };
  }

  // ---- revocation: classified, never a reason to grant --------------------------------------
  const revocationDate = isoFromAppleDate(claims.revocationDate);
  const revoked = revocationDate !== null;

  return {
    ok: true,
    transaction: {
      transactionId: claims.transactionId,
      originalTransactionId,
      bundleId: claims.bundleId,
      productId: claims.productId,
      environment: claims.environment,
      purchaseDate: isoFromAppleDate(claims.purchaseDate),
      quantity,
      appAccountToken: token,
      revoked,
      revocationDate,
      revocationReason: typeof claims.revocationReason === 'number' ? claims.revocationReason : null,
    },
  };
}
