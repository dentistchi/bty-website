// BUILD 26U-R4G-R2-R1 — what to do about a refund Apple can still see and BTY may have missed.
//
// PURE. Given historical Refund History evidence, current Transaction Info state, and what the
// local ledger already recorded, it returns ONE action. It performs no I/O and mutates nothing;
// the canonical RPCs do that, unchanged.
//
// THE RULE THIS FILE EXISTS TO ENFORCE (§L, and the reason R4G-R2-R0 refused to authorize a
// naive backstop): a Refund History record is HISTORY. Applying it because it exists would
// revoke a customer's Room Time for a refund Apple has since REVERSED — fabricating a service
// interruption that never happened. Historical evidence is a reason to LOOK; current verified
// Apple state is the only thing that may authorize a write.
//
// AND ABSENCE IS NOT EVIDENCE. A missing revocationPercentage means "reversed" only when the
// refund we are comparing against was itself explicit. For a legacy shape — no type, no
// percentage, either then or now — absence is exactly as consistent with "still refunded" as with
// "reversed", so the honest answer is to stop and say so.

import { classifyRefundEvidence, type RefundKind } from './partial-refund';

/** One verified Apple transaction snapshot, from either endpoint. */
export interface AppleRefundSnapshot {
  environment: 'Sandbox' | 'Production';
  transactionId: string;
  productId?: string | null;
  /** Epoch millis, or null/absent when Apple sent none. */
  revocationDate?: number | null;
  revocationReason?: number | string | null;
  revocationType?: string | null;
  revocationPercentage?: number | null;
}

/** What the ledger already knows. */
export interface LocalRefundState {
  found: boolean;
  environment?: 'Sandbox' | 'Production';
  transactionId?: string;
  revokedAt?: string | null;
  refundKind?: RefundKind | null;
  /** The RAW Apple type we stored. Null means the refund we recorded was the legacy shape. */
  refundRevocationType?: string | null;
  refundRevocationPercentage?: number | null;
  refundReversedAt?: string | null;
}

export type ReconciliationAction =
  | 'NO_ACTION'
  | 'ALREADY_APPLIED'
  | 'APPLY_REFUND'
  | 'APPLY_REVERSAL'
  | 'NO_ACTION_REFUND_ALREADY_REVERSED'
  | 'FAILED';

export type ReconciliationFailure =
  | 'PURCHASE_NOT_FOUND'
  | 'INVALID_APPLE_REFUND_SHAPE'
  | 'EVIDENCE_CONFLICT'
  | 'AMBIGUOUS_LEGACY_REFUND_STATE'
  | 'CURRENT_STATE_UNVERIFIABLE'
  | 'ENVIRONMENT_MISMATCH';

export interface ReconciliationDecision {
  action: ReconciliationAction;
  detail: ReconciliationFailure | string;
  /** Present only for APPLY_REFUND, and taken from CURRENT state, never from history. */
  refund?: { kind: RefundKind; percentage: number | null; revocationDate: number | null };
}

const isRefunded = (s: AppleRefundSnapshot | null | undefined): boolean =>
  s != null && s.revocationDate != null;

/** True when a snapshot carries Apple's explicit refund SHAPE, not just the fact of a refund. */
const isExplicit = (s: AppleRefundSnapshot | null | undefined): boolean =>
  s != null && typeof s.revocationType === 'string' && s.revocationType !== '';

/**
 * Decide one transaction.
 *
 * `history` is the Refund History record for this transaction, if Apple returned one.
 * `current` is the freshly verified Get Transaction Info snapshot — REQUIRED. Without it there is
 * no current state to cross-check against, and §H forbids writing on history alone.
 */
export function decideReconciliation(input: {
  history: AppleRefundSnapshot | null;
  current: AppleRefundSnapshot | null;
  local: LocalRefundState;
}): ReconciliationDecision {
  const { history, current, local } = input;

  if (!local.found) return { action: 'FAILED', detail: 'PURCHASE_NOT_FOUND' };
  // No current reading means no authority. Never fall back to history.
  if (!current) return { action: 'FAILED', detail: 'CURRENT_STATE_UNVERIFIABLE' };
  if (local.environment && local.environment !== current.environment) {
    return { action: 'FAILED', detail: 'ENVIRONMENT_MISMATCH' };
  }

  const localRefunded = local.revokedAt != null;
  const localReversed = local.refundReversedAt != null;

  // ── APPLE SAYS IT IS REFUNDED RIGHT NOW ────────────────────────────────────
  if (isRefunded(current)) {
    const shape = classifyRefundEvidence({
      revocationType: current.revocationType ?? undefined,
      revocationPercentage: current.revocationPercentage ?? undefined,
    });
    if (!shape.ok) return { action: 'FAILED', detail: 'INVALID_APPLE_REFUND_SHAPE' };

    // History and current state must describe the SAME refund. A mismatch is not something to
    // average out — there is no cumulative-refund contract in this build.
    if (history && isRefunded(history)) {
      const hShape = classifyRefundEvidence({
        revocationType: history.revocationType ?? undefined,
        revocationPercentage: history.revocationPercentage ?? undefined,
      });
      if (!hShape.ok) return { action: 'FAILED', detail: 'INVALID_APPLE_REFUND_SHAPE' };
      if (hShape.kind !== shape.kind) return { action: 'FAILED', detail: 'EVIDENCE_CONFLICT' };
      if (shape.kind === 'PRORATED' && hShape.percentage !== shape.percentage) {
        return { action: 'FAILED', detail: 'EVIDENCE_CONFLICT' };
      }
      if (history.revocationDate != null && current.revocationDate != null
          && history.revocationDate !== current.revocationDate) {
        return { action: 'FAILED', detail: 'EVIDENCE_CONFLICT' };
      }
    }

    if (!localRefunded) {
      // §M case 2 — Apple refunded it, BTY never applied it.
      return {
        action: 'APPLY_REFUND',
        detail: `refund_${shape.kind.toLowerCase()}`,
        refund: {
          kind: shape.kind,
          percentage: shape.percentage,
          revocationDate: current.revocationDate ?? null,
        },
      };
    }

    // Already applied. It must be the SAME refund, or something we do not understand happened.
    const storedKind = local.refundKind ?? 'FULL';
    if (storedKind !== shape.kind) return { action: 'FAILED', detail: 'EVIDENCE_CONFLICT' };
    if (shape.kind === 'PRORATED'
        && (local.refundRevocationPercentage ?? null) !== shape.percentage) {
      return { action: 'FAILED', detail: 'EVIDENCE_CONFLICT' };
    }
    // A reversal we recorded that Apple's current state contradicts is also a conflict, not a
    // reason to re-refund.
    if (localReversed) return { action: 'FAILED', detail: 'EVIDENCE_CONFLICT' };
    return { action: 'ALREADY_APPLIED', detail: 'refund_already_applied' };
  }

  // ── APPLE SAYS IT IS NOT REFUNDED RIGHT NOW ────────────────────────────────

  // Nothing ever happened, and BTY agrees.
  if (!history || !isRefunded(history)) {
    if (localRefunded && !localReversed) {
      // BTY revoked something Apple has no refund record of at all. That is not a reversal we can
      // demonstrate; it is a disagreement, and it needs eyes.
      return { action: 'FAILED', detail: 'EVIDENCE_CONFLICT' };
    }
    return { action: 'NO_ACTION', detail: 'never_refunded' };
  }

  // History says a refund existed and current state no longer shows one. That reads as a
  // reversal — but only if the historical refund was EXPLICIT. For a legacy shape, "no type, no
  // percentage" is what BOTH a legacy refund and a reversal look like.
  if (!isExplicit(history)) {
    return { action: 'FAILED', detail: 'AMBIGUOUS_LEGACY_REFUND_STATE' };
  }

  if (!localRefunded) {
    // §M case 4 — refunded then reversed, and BTY missed BOTH. The customer never lost anything,
    // so nothing is owed and nothing is taken. Applying the refund and then reversing it would
    // fabricate an interruption that never happened and leave a REFUND_CREDIT nobody earned.
    return { action: 'NO_ACTION_REFUND_ALREADY_REVERSED', detail: 'never_applied_locally' };
  }

  if (localReversed) return { action: 'ALREADY_APPLIED', detail: 'refund_and_reversal_applied' };

  // §M case 5 — BTY applied the refund; Apple has since reversed it. Compensate, but only when
  // the refund WE recorded was itself explicit: inferring a reversal from a missing percentage
  // is only sound when a percentage was there to go missing.
  if (!local.refundRevocationType) {
    return { action: 'FAILED', detail: 'AMBIGUOUS_LEGACY_REFUND_STATE' };
  }
  return { action: 'APPLY_REVERSAL', detail: 'reversal_detected' };
}

/** Whether an operator run may exit 0 with this decision in it. */
export function isUnresolved(d: ReconciliationDecision): boolean {
  return d.action === 'FAILED';
}
