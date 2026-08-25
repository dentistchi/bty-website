import { describe, it, expect } from 'vitest';
import { decideReconciliation, isUnresolved,
         type AppleRefundSnapshot, type LocalRefundState } from './refund-reconciliation';

// BUILD 26U-R4G-R2-R1 — the nine states of §S, and the two that must fail closed.

const T = 1_787_000_000_000;
const snap = (o: Partial<AppleRefundSnapshot> = {}): AppleRefundSnapshot => ({
  environment: 'Sandbox', transactionId: '2000000900000001', productId: 'p', ...o,
});
const refundedNow = (over: Partial<AppleRefundSnapshot> = {}) =>
  snap({ revocationDate: T, revocationType: 'REFUND_PRORATED', revocationPercentage: 40_000, ...over });
const notRefunded = () => snap({});
const local = (o: Partial<LocalRefundState> = {}): LocalRefundState =>
  ({ found: true, environment: 'Sandbox', transactionId: '2000000900000001', ...o });

describe('R2-1 — §S1 never refunded', () => {
  it('does nothing', () => {
    expect(decideReconciliation({ history: null, current: notRefunded(), local: local() }))
      .toMatchObject({ action: 'NO_ACTION' });
  });
});

describe('R2-2 — §S2 currently refunded, BTY missed it', () => {
  it('applies the refund, using CURRENT state as the authority', () => {
    const d = decideReconciliation({
      history: refundedNow(), current: refundedNow(), local: local(),
    });
    expect(d.action).toBe('APPLY_REFUND');
    expect(d.refund).toEqual({ kind: 'PRORATED', percentage: 40_000, revocationDate: T });
  });

  it('applies a FULL refund too', () => {
    const full = refundedNow({ revocationType: 'REFUND_FULL', revocationPercentage: 100_000 });
    expect(decideReconciliation({ history: full, current: full, local: local() }))
      .toMatchObject({ action: 'APPLY_REFUND', refund: { kind: 'FULL' } });
  });

  it('never applies from HISTORY alone — current state is required', () => {
    expect(decideReconciliation({ history: refundedNow(), current: null, local: local() }))
      .toEqual({ action: 'FAILED', detail: 'CURRENT_STATE_UNVERIFIABLE' });
  });
});

describe('R2-3 — §S3 already applied', () => {
  it('is a no-op when the stored refund matches', () => {
    expect(decideReconciliation({
      history: refundedNow(), current: refundedNow(),
      local: local({ revokedAt: '2026-08-20T00:00:00Z', refundKind: 'PRORATED',
                     refundRevocationType: 'REFUND_PRORATED', refundRevocationPercentage: 40_000 }),
    })).toMatchObject({ action: 'ALREADY_APPLIED' });
  });

  it('a different stored percentage is a CONFLICT, never a silent re-apply', () => {
    expect(decideReconciliation({
      history: refundedNow(), current: refundedNow(),
      local: local({ revokedAt: '2026-08-20T00:00:00Z', refundKind: 'PRORATED',
                     refundRevocationType: 'REFUND_PRORATED', refundRevocationPercentage: 70_000 }),
    })).toEqual({ action: 'FAILED', detail: 'EVIDENCE_CONFLICT' });
  });

  it('a different stored KIND is a conflict too', () => {
    expect(decideReconciliation({
      history: refundedNow(), current: refundedNow(),
      local: local({ revokedAt: '2026-08-20T00:00:00Z', refundKind: 'FULL',
                     refundRevocationType: 'REFUND_FULL' }),
    })).toEqual({ action: 'FAILED', detail: 'EVIDENCE_CONFLICT' });
  });
});

describe('R2-4 — §S4 refunded then reversed, BTY missed BOTH', () => {
  it('does NOT fabricate a refund it never imposed', () => {
    const d = decideReconciliation({
      history: refundedNow(), current: notRefunded(), local: local(),
    });
    expect(d.action).toBe('NO_ACTION_REFUND_ALREADY_REVERSED');
    // The dangerous alternative, named so a future edit has to argue with it: apply then reverse
    // would revoke Room Time retroactively and mint a REFUND_CREDIT nobody earned.
    expect(d.action).not.toBe('APPLY_REFUND');
  });
});

describe('R2-5 — §S5 reversed, BTY applied the refund only', () => {
  it('applies exactly one reversal', () => {
    expect(decideReconciliation({
      history: refundedNow(), current: notRefunded(),
      local: local({ revokedAt: '2026-08-20T00:00:00Z', refundKind: 'PRORATED',
                     refundRevocationType: 'REFUND_PRORATED', refundRevocationPercentage: 40_000 }),
    })).toMatchObject({ action: 'APPLY_REVERSAL' });
  });

  it('…but NOT when the refund we stored was the legacy shape', () => {
    // Absence of a percentage means "reversed" only if a percentage was ever there to go missing.
    expect(decideReconciliation({
      history: refundedNow(), current: notRefunded(),
      local: local({ revokedAt: '2026-08-20T00:00:00Z', refundKind: 'FULL',
                     refundRevocationType: null }),
    })).toEqual({ action: 'FAILED', detail: 'AMBIGUOUS_LEGACY_REFUND_STATE' });
  });
});

describe('R2-6 — §S6 both already applied', () => {
  it('is a no-op', () => {
    expect(decideReconciliation({
      history: refundedNow(), current: notRefunded(),
      local: local({ revokedAt: '2026-08-20T00:00:00Z', refundKind: 'PRORATED',
                     refundRevocationType: 'REFUND_PRORATED', refundRevocationPercentage: 40_000,
                     refundReversedAt: '2026-08-21T00:00:00Z' }),
    })).toMatchObject({ action: 'ALREADY_APPLIED' });
  });
});

describe('R2-7 — §S7 the legacy ambiguity, failing closed on purpose', () => {
  const legacyHistory = snap({ revocationDate: T });   // no type, no percentage

  it('never auto-applies', () => {
    const d = decideReconciliation({ history: legacyHistory, current: notRefunded(), local: local() });
    expect(d).toEqual({ action: 'FAILED', detail: 'AMBIGUOUS_LEGACY_REFUND_STATE' });
    expect(d.action).not.toBe('APPLY_REFUND');
  });

  it('never auto-reverses', () => {
    const d = decideReconciliation({
      history: legacyHistory, current: notRefunded(),
      local: local({ revokedAt: '2026-08-20T00:00:00Z', refundKind: 'FULL' }),
    });
    expect(d).toEqual({ action: 'FAILED', detail: 'AMBIGUOUS_LEGACY_REFUND_STATE' });
    expect(d.action).not.toBe('APPLY_REVERSAL');
  });

  it('a legacy refund that is STILL current applies normally — the ambiguity is only about absence', () => {
    expect(decideReconciliation({
      history: legacyHistory, current: snap({ revocationDate: T }), local: local(),
    })).toMatchObject({ action: 'APPLY_REFUND', refund: { kind: 'FULL', percentage: null } });
  });
});

describe('R2-8 — §S8 conflicting evidence', () => {
  it('a different percentage between history and current state', () => {
    expect(decideReconciliation({
      history: refundedNow({ revocationPercentage: 50_000 }),
      current: refundedNow(), local: local(),
    })).toEqual({ action: 'FAILED', detail: 'EVIDENCE_CONFLICT' });
  });

  it('a different revocationDate', () => {
    expect(decideReconciliation({
      history: refundedNow({ revocationDate: T - 86_400_000 }),
      current: refundedNow(), local: local(),
    })).toEqual({ action: 'FAILED', detail: 'EVIDENCE_CONFLICT' });
  });

  it('a different kind', () => {
    expect(decideReconciliation({
      history: refundedNow({ revocationType: 'REFUND_FULL', revocationPercentage: 100_000 }),
      current: refundedNow(), local: local(),
    })).toEqual({ action: 'FAILED', detail: 'EVIDENCE_CONFLICT' });
  });

  it('BTY revoked something Apple has no refund record of', () => {
    expect(decideReconciliation({
      history: null, current: notRefunded(),
      local: local({ revokedAt: '2026-08-20T00:00:00Z', refundKind: 'FULL' }),
    })).toEqual({ action: 'FAILED', detail: 'EVIDENCE_CONFLICT' });
  });

  it('a malformed CURRENT shape is refused, never widened', () => {
    expect(decideReconciliation({
      history: null,
      current: refundedNow({ revocationType: 'FAMILY_REVOKE', revocationPercentage: null }),
      local: local(),
    })).toEqual({ action: 'FAILED', detail: 'INVALID_APPLE_REFUND_SHAPE' });
  });
});

describe('R2-9 — binding and containment', () => {
  it('an Apple transaction with no local purchase is reported, never ignored', () => {
    expect(decideReconciliation({
      history: refundedNow(), current: refundedNow(), local: { found: false },
    })).toEqual({ action: 'FAILED', detail: 'PURCHASE_NOT_FOUND' });
  });

  it('an environment mismatch never crosses Sandbox and Production', () => {
    expect(decideReconciliation({
      history: null, current: snap({ environment: 'Production' }),
      local: local({ environment: 'Sandbox' }),
    })).toEqual({ action: 'FAILED', detail: 'ENVIRONMENT_MISMATCH' });
  });

  it('every FAILED decision is unresolved, and no other action is', () => {
    for (const action of ['NO_ACTION', 'ALREADY_APPLIED', 'APPLY_REFUND', 'APPLY_REVERSAL',
                          'NO_ACTION_REFUND_ALREADY_REVERSED'] as const) {
      expect(isUnresolved({ action, detail: 'x' })).toBe(false);
    }
    expect(isUnresolved({ action: 'FAILED', detail: 'EVIDENCE_CONFLICT' })).toBe(true);
  });

  it('the decision is a pure function of its inputs', () => {
    const args = { history: refundedNow(), current: refundedNow(), local: local() };
    const a = decideReconciliation(args);
    for (let i = 0; i < 20; i += 1) expect(decideReconciliation(args)).toEqual(a);
  });
});
