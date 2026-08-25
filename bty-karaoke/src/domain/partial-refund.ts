// BUILD 26U-R4G-R2A-R1 — what an Apple refund actually removes from a customer's Room Time.
//
// PURE. No SQL, no network, no clock of its own. The database RPC is the authority that mutates;
// this module owns the two decisions that must be exhaustively testable without one: whether a
// piece of verified Apple evidence is a refund we can act on, and exactly how many seconds of
// FUTURE service it takes away.
//
// THE TWO DEFECTS THIS EXISTS TO CLOSE, both measured by R4G-R2A-R0 against production migrations:
//
//   1. The refund denied `duration_seconds + carryover_seconds`. Carryover is written only by
//      `switch_timed_access_pass`, out of a DIFFERENT grant's residual — measured at 86399
//      seconds belonging to a different Apple purchase. Refunding a 1-hour purchase therefore
//      confiscated 89999 seconds, 86399 of which that purchase never sold.
//
//   2. That 89999 then exceeded REFUND_CREDIT's 1..86400 bound, so a later REFUND_REVERSED failed
//      closed with `denied_seconds_out_of_range` and the customer got NOTHING back.
//
// Capping denial at the purchase's own remaining base closes both: `denied <= D <= 86400` always.
//
// A NOTE ON ARITHMETIC. Everything here is integer. `D * percentage` is at most
// 86400 * 100000 = 8.64e9, far below Number.MAX_SAFE_INTEGER (9.007e15), so the products below
// are exact in IEEE-754 doubles and `Math.floor` is a true floor rather than a rounding artifact.
// The RPC does the same sums in `bigint`. Neither uses floating-point division.

/** Apple's `revocationType`. Anything else is unknown evidence and is refused. */
export const REVOCATION_TYPES = ['REFUND_FULL', 'REFUND_PRORATED', 'FAMILY_REVOKE'] as const;
export type RevocationType = (typeof REVOCATION_TYPES)[number];

/** What BTY does about it. FAMILY_REVOKE is deliberately NOT a kind — it is refused. */
export type RefundKind = 'FULL' | 'PRORATED';

/** Apple expresses proration in milliunits: 100000 is the whole purchase. */
export const PERCENTAGE_SCALE = 100_000;

export type RefundEvidenceRejection =
  /** FAMILY_REVOKE, or a revocationType this build has never heard of. */
  | 'unsupported_revocation_type'
  /** REFUND_FULL carrying a percentage that is not the whole purchase. */
  | 'full_percentage_mismatch'
  /** REFUND_PRORATED with no percentage at all — the one number it exists to carry. */
  | 'prorated_percentage_missing'
  /** REFUND_PRORATED at 0, at/above 100000, or otherwise not a partial share. */
  | 'prorated_percentage_out_of_range';

export type RefundClassification =
  | { ok: true; kind: RefundKind; percentage: number | null }
  | { ok: false; reason: RefundEvidenceRejection };

/**
 * Classify VERIFIED Apple refund evidence. Nothing unsigned ever reaches this.
 *
 * FAIL CLOSED IN BOTH DIRECTIONS. Malformed evidence is never widened into a full refund — that
 * would take a customer's whole hour on the strength of a field we could not read — and it is
 * never narrowed into "no refund", which would leave paid time in place after the money went
 * back. It is refused, and R4G-R1 keeps the notification recoverable so a corrected event, or a
 * fixed reader, can still apply it.
 */
export function classifyRefundEvidence(input: {
  revocationType?: unknown;
  revocationPercentage?: unknown;
}): RefundClassification {
  const rawType = input.revocationType;
  const rawPct = input.revocationPercentage;

  const pct =
    rawPct === undefined || rawPct === null
      ? null
      : typeof rawPct === 'number' && Number.isInteger(rawPct)
        ? rawPct
        : NaN;

  // 1. THE LEGACY SHAPE. Every REFUND Apple has ever sent this build carried neither field, and
  //    the deployed contract treats that as a full refund. Preserved exactly, so ingesting the
  //    historical record does not change its meaning.
  if (rawType === undefined || rawType === null) {
    if (pct === null) return { ok: true, kind: 'FULL', percentage: null };
    // A percentage with no type is evidence we cannot classify. Refuse rather than pick one.
    return { ok: false, reason: 'unsupported_revocation_type' };
  }

  if (typeof rawType !== 'string') return { ok: false, reason: 'unsupported_revocation_type' };

  switch (rawType) {
    case 'REFUND_FULL':
      if (pct === null) return { ok: true, kind: 'FULL', percentage: null };
      if (pct === PERCENTAGE_SCALE) return { ok: true, kind: 'FULL', percentage: PERCENTAGE_SCALE };
      return { ok: false, reason: 'full_percentage_mismatch' };

    case 'REFUND_PRORATED':
      if (pct === null) return { ok: false, reason: 'prorated_percentage_missing' };
      if (!Number.isInteger(pct) || pct <= 0 || pct >= PERCENTAGE_SCALE) {
        return { ok: false, reason: 'prorated_percentage_out_of_range' };
      }
      return { ok: true, kind: 'PRORATED', percentage: pct };

    // FAMILY_REVOKE is a Family Sharing removal, not a refund of this customer's purchase. It has
    // no defined Room Time meaning here, and guessing one would be inventing a product rule.
    case 'FAMILY_REVOKE':
    default:
      return { ok: false, reason: 'unsupported_revocation_type' };
  }
}

/** The grant lifecycle positions a refund can land on. */
export type GrantLifecycle = 'AVAILABLE' | 'SELECTED' | 'ACTIVE' | 'EXPIRED' | 'REVOKED';

export interface RefundValuationInput {
  kind: RefundKind;
  /** Milliunits for PRORATED; null (or 100000) for FULL. */
  percentage: number | null;
  status: GrantLifecycle;
  /** The PRODUCT's own duration. The only thing an Apple refund can reach. */
  durationSeconds: number;
  /** Time carried in from ANOTHER grant. Never refundable by this purchase. */
  carryoverSeconds: number;
  /**
   * Whole seconds elapsed since activation, at the SERVER's cutoff. Required for ACTIVE and
   * ignored otherwise. Never a device clock, and already floored by the caller so the boundary
   * is decided in one place.
   */
  elapsedSeconds?: number | null;
}

export interface RefundValuation {
  /** What Apple's percentage is worth in seconds of the purchased duration. */
  nominalRefundedSeconds: number;
  /** Purchased seconds not yet consumed. */
  baseRemainingSeconds: number;
  /** Foreign seconds not yet consumed. Reported so the audit can show they SURVIVED. */
  carryRemainingSeconds: number;
  /** The future Room Time BTY actually removes. Never more than the purchase had left. */
  deniedSeconds: number;
  /** The future Room Time that survives, and becomes exactly one REFUND_REMAINDER. */
  survivingFutureSeconds: number;
}

const clampNonNegative = (n: number) => (n > 0 ? n : 0);

/**
 * How much future service this refund removes, and what survives it.
 *
 * BASE-FIRST ACCOUNTING (§I). An ACTIVE window is one undivided interval as far as entitlement is
 * concerned — `expires_at = activated_at + (duration + carryover)`, and nothing in the database
 * expresses an order. So this order is a REFUND-VALUATION rule only, invented here and used
 * nowhere else: purchased seconds are treated as consumed first, which is the reading least
 * favourable to BTY and most favourable to the customer, because it maximises the foreign
 * carryover that survives.
 */
export function valueRefund(input: RefundValuationInput): RefundValuation {
  const D = clampNonNegative(Math.trunc(input.durationSeconds));
  const C = clampNonNegative(Math.trunc(input.carryoverSeconds));

  // What Apple's share is worth, before asking what is actually left to take.
  const nominalRefundedSeconds =
    input.kind === 'FULL'
      ? D
      : Math.floor((D * (input.percentage ?? 0)) / PERCENTAGE_SCALE);

  let baseRemainingSeconds = 0;
  let carryRemainingSeconds = 0;

  switch (input.status) {
    case 'AVAILABLE':
      // Structurally carries nothing: `timed_pass_available_no_carry_chk` refuses otherwise.
      baseRemainingSeconds = D;
      carryRemainingSeconds = 0;
      break;
    case 'SELECTED':
      // Armed, not started. The whole purchase is still ahead, and so is the foreign carry.
      baseRemainingSeconds = D;
      carryRemainingSeconds = C;
      break;
    case 'ACTIVE': {
      const elapsed = clampNonNegative(Math.trunc(input.elapsedSeconds ?? 0));
      baseRemainingSeconds = clampNonNegative(D - elapsed);
      carryRemainingSeconds = clampNonNegative(C - clampNonNegative(elapsed - D));
      break;
    }
    // Nothing is ahead of an EXPIRED or already-REVOKED grant, so a refund removes no future
    // service from it. The money is still returned; the purchase row carries that truth.
    case 'EXPIRED':
    case 'REVOKED':
      break;
  }

  // THE CAP THAT CLOSES BOTH DEFECTS. Apple's percentage can be worth more than the purchase has
  // left — a 40% refund of an hour that is 50 minutes spent is worth 1440 seconds against 600
  // remaining. BTY cannot remove time already delivered, so it removes what is there.
  const deniedSeconds = Math.min(nominalRefundedSeconds, baseRemainingSeconds);

  // Carryover is added back whole. It belongs to another grant and this purchase never sold it.
  const survivingFutureSeconds = baseRemainingSeconds - deniedSeconds + carryRemainingSeconds;

  return {
    nominalRefundedSeconds,
    baseRemainingSeconds,
    carryRemainingSeconds,
    deniedSeconds,
    survivingFutureSeconds,
  };
}
