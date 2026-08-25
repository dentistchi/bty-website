import { describe, it, expect } from 'vitest';
import {
  classifyRefundEvidence, valueRefund, PERCENTAGE_SCALE,
} from './partial-refund';

// BUILD 26U-R4G-R2A-R1 — the valuation, pinned to the numbers the spec named.
// The same matrix is measured against the REAL RPC in scripts/verify-r4g-r2a.sh; both are
// anchored to these figures, so a divergence between the domain rule and the database cannot
// hide in one of them.

describe('R2A-1 — classifying verified Apple refund evidence', () => {
  it('the LEGACY shape (no type, no percentage) stays a full refund', () => {
    expect(classifyRefundEvidence({})).toEqual({ ok: true, kind: 'FULL', percentage: null });
  });

  it('explicit REFUND_FULL with no percentage is full', () => {
    expect(classifyRefundEvidence({ revocationType: 'REFUND_FULL' }))
      .toEqual({ ok: true, kind: 'FULL', percentage: null });
  });

  it('explicit REFUND_FULL at exactly 100000 is full', () => {
    expect(classifyRefundEvidence({ revocationType: 'REFUND_FULL', revocationPercentage: 100_000 }))
      .toEqual({ ok: true, kind: 'FULL', percentage: 100_000 });
  });

  it('REFUND_FULL carrying any other percentage is REFUSED, never widened', () => {
    for (const pct of [0, 1, 99_999, 100_001]) {
      expect(classifyRefundEvidence({ revocationType: 'REFUND_FULL', revocationPercentage: pct }))
        .toEqual({ ok: false, reason: 'full_percentage_mismatch' });
    }
  });

  it('REFUND_PRORATED accepts 1..99999', () => {
    for (const pct of [1, 33_333, 40_000, 50_000, 99_999]) {
      expect(classifyRefundEvidence({ revocationType: 'REFUND_PRORATED', revocationPercentage: pct }))
        .toEqual({ ok: true, kind: 'PRORATED', percentage: pct });
    }
  });

  it('REFUND_PRORATED with no percentage is refused — it is the one number it carries', () => {
    expect(classifyRefundEvidence({ revocationType: 'REFUND_PRORATED' }))
      .toEqual({ ok: false, reason: 'prorated_percentage_missing' });
  });

  it('REFUND_PRORATED outside 1..99999 is refused, at both ends', () => {
    for (const pct of [0, -1, 100_000, 100_001]) {
      expect(classifyRefundEvidence({ revocationType: 'REFUND_PRORATED', revocationPercentage: pct }))
        .toEqual({ ok: false, reason: 'prorated_percentage_out_of_range' });
    }
  });

  it('FAMILY_REVOKE is refused — it is not a refund of this purchase', () => {
    expect(classifyRefundEvidence({ revocationType: 'FAMILY_REVOKE' }))
      .toEqual({ ok: false, reason: 'unsupported_revocation_type' });
  });

  it('an unknown future type is refused, never guessed', () => {
    for (const t of ['REFUND_SOMETHING', '', 'refund_full', 7, {}]) {
      expect(classifyRefundEvidence({ revocationType: t }).ok).toBe(false);
    }
  });

  it('a percentage with NO type is refused rather than assigned a meaning', () => {
    expect(classifyRefundEvidence({ revocationPercentage: 40_000 }))
      .toEqual({ ok: false, reason: 'unsupported_revocation_type' });
  });

  it('a non-integer percentage is refused', () => {
    expect(classifyRefundEvidence({ revocationType: 'REFUND_PRORATED', revocationPercentage: 40_000.5 }).ok)
      .toBe(false);
  });
});

describe('R2A-2 — rounding is customer-favourable and never upward', () => {
  const nominal = (pct: number, D = 3600) =>
    valueRefund({ kind: 'PRORATED', percentage: pct, status: 'AVAILABLE',
                  durationSeconds: D, carryoverSeconds: 0 }).nominalRefundedSeconds;

  it('matches the specified figures exactly', () => {
    expect(nominal(1)).toBe(0);
    expect(nominal(33_333)).toBe(1_199);
    expect(nominal(40_000)).toBe(1_440);
    expect(nominal(50_000)).toBe(1_800);
    expect(nominal(99_999)).toBe(3_599);
  });

  it('a tiny refund removes ZERO whole seconds, and is not nudged to one', () => {
    expect(nominal(1)).toBe(0);
    expect(nominal(27)).toBe(0);
  });

  it('99999 never becomes a full refund', () => {
    expect(nominal(99_999)).toBeLessThan(3_600);
  });

  it('never exceeds the purchased duration, across the whole scale', () => {
    for (let pct = 1; pct < PERCENTAGE_SCALE; pct += 137) {
      expect(nominal(pct)).toBeLessThanOrEqual(3_600);
      expect(nominal(pct)).toBe(Math.floor((3600 * pct) / PERCENTAGE_SCALE));
    }
  });

  it('is exact for the largest product too — no float drift at 24 hours', () => {
    expect(nominal(33_333, 86_400)).toBe(28_799);
    expect(nominal(99_999, 86_400)).toBe(86_399);
  });
});

describe('R2A-3 — §P the measured defect: FULL refund with FOREIGN carryover', () => {
  it('denies the purchase only, and 86399 foreign seconds SURVIVE', () => {
    const v = valueRefund({
      kind: 'FULL', percentage: null, status: 'SELECTED',
      durationSeconds: 3_600, carryoverSeconds: 86_399,
    });
    expect(v.deniedSeconds).toBe(3_600);
    expect(v.deniedSeconds).not.toBe(89_999);      // the measured over-revocation
    expect(v.survivingFutureSeconds).toBe(86_399);
  });

  it('…and the denial stays inside REFUND_CREDIT’s bound, so a reversal can still pay out', () => {
    const v = valueRefund({
      kind: 'FULL', percentage: null, status: 'SELECTED',
      durationSeconds: 86_400, carryoverSeconds: 86_399,
    });
    expect(v.deniedSeconds).toBeLessThanOrEqual(86_400);
  });
});

describe('R2A-4 — the specified lifecycle examples', () => {
  it('§Q ACTIVE full refund with carryover', () => {
    const v = valueRefund({ kind: 'FULL', percentage: null, status: 'ACTIVE',
                            durationSeconds: 3_600, carryoverSeconds: 900, elapsedSeconds: 600 });
    expect(v).toMatchObject({ baseRemainingSeconds: 3_000, carryRemainingSeconds: 900,
                              deniedSeconds: 3_000, survivingFutureSeconds: 900 });
  });

  it('§R AVAILABLE prorated 40%', () => {
    const v = valueRefund({ kind: 'PRORATED', percentage: 40_000, status: 'AVAILABLE',
                            durationSeconds: 3_600, carryoverSeconds: 0 });
    expect(v).toMatchObject({ nominalRefundedSeconds: 1_440, baseRemainingSeconds: 3_600,
                              deniedSeconds: 1_440, survivingFutureSeconds: 2_160 });
  });

  it('§S SELECTED prorated with carryover', () => {
    const v = valueRefund({ kind: 'PRORATED', percentage: 40_000, status: 'SELECTED',
                            durationSeconds: 3_600, carryoverSeconds: 900 });
    expect(v.deniedSeconds).toBe(1_440);
    expect(v.survivingFutureSeconds).toBe(3_060);
  });

  it('§T ACTIVE prorated, and conservation holds exactly', () => {
    const elapsed = 600;
    const v = valueRefund({ kind: 'PRORATED', percentage: 40_000, status: 'ACTIVE',
                            durationSeconds: 3_600, carryoverSeconds: 0, elapsedSeconds: elapsed });
    expect(v).toMatchObject({ baseRemainingSeconds: 3_000, nominalRefundedSeconds: 1_440,
                              deniedSeconds: 1_440, survivingFutureSeconds: 1_560 });
    expect(elapsed + v.survivingFutureSeconds + v.deniedSeconds).toBe(3_600);
  });

  it('§U a refund worth more than the unused purchase removes only what is left', () => {
    const v = valueRefund({ kind: 'PRORATED', percentage: 40_000, status: 'ACTIVE',
                            durationSeconds: 3_600, carryoverSeconds: 0, elapsedSeconds: 3_000 });
    expect(v.nominalRefundedSeconds).toBe(1_440);
    expect(v.baseRemainingSeconds).toBe(600);
    expect(v.deniedSeconds).toBe(600);            // NOT 1440 — consumed time is not confiscated
    expect(v.survivingFutureSeconds).toBe(0);
  });

  it('§V a 1-milliunit refund denies nothing and preserves the whole future service', () => {
    const v = valueRefund({ kind: 'PRORATED', percentage: 1, status: 'AVAILABLE',
                            durationSeconds: 3_600, carryoverSeconds: 0 });
    expect(v.deniedSeconds).toBe(0);
    expect(v.survivingFutureSeconds).toBe(3_600);
  });
});

describe('R2A-5 — carryover is never touched, whatever the refund', () => {
  it('a 100% refund still leaves every foreign second', () => {
    for (const C of [1, 900, 14_405, 86_399]) {
      const v = valueRefund({ kind: 'FULL', percentage: null, status: 'SELECTED',
                              durationSeconds: 3_600, carryoverSeconds: C });
      expect(v.carryRemainingSeconds).toBe(C);
      expect(v.survivingFutureSeconds).toBe(C);
    }
  });

  it('base-first accounting maximises the surviving foreign carry', () => {
    // Elapsed has eaten the whole purchase and 100s of carry.
    const v = valueRefund({ kind: 'FULL', percentage: null, status: 'ACTIVE',
                            durationSeconds: 3_600, carryoverSeconds: 900, elapsedSeconds: 3_700 });
    expect(v.baseRemainingSeconds).toBe(0);
    expect(v.carryRemainingSeconds).toBe(800);
    expect(v.deniedSeconds).toBe(0);
    expect(v.survivingFutureSeconds).toBe(800);
  });

  it('surviving service may legitimately exceed one product duration', () => {
    const v = valueRefund({ kind: 'PRORATED', percentage: 1, status: 'SELECTED',
                            durationSeconds: 86_400, carryoverSeconds: 86_399 });
    expect(v.survivingFutureSeconds).toBe(172_799);
    expect(v.survivingFutureSeconds).toBeGreaterThan(86_400);
  });
});

describe('R2A-6 — terminal grants have no future service to remove', () => {
  it.each(['EXPIRED', 'REVOKED'] as const)('%s denies nothing and survives nothing', (status) => {
    const v = valueRefund({ kind: 'FULL', percentage: null, status,
                            durationSeconds: 3_600, carryoverSeconds: 900 });
    expect(v.deniedSeconds).toBe(0);
    expect(v.survivingFutureSeconds).toBe(0);
  });

  it('a stale ACTIVE window is already spent', () => {
    const v = valueRefund({ kind: 'FULL', percentage: null, status: 'ACTIVE',
                            durationSeconds: 3_600, carryoverSeconds: 0, elapsedSeconds: 99_999 });
    expect(v.deniedSeconds).toBe(0);
    expect(v.survivingFutureSeconds).toBe(0);
  });
});

describe('R2A-7 — invariants that must hold for every input', () => {
  it('denied never exceeds the product duration, and never exceeds what remains', () => {
    for (const status of ['AVAILABLE', 'SELECTED', 'ACTIVE'] as const) {
      for (const D of [3_600, 14_400, 86_400]) {
        for (const C of [0, 900, 86_399]) {
          for (const pct of [1, 40_000, 99_999, null]) {
            for (const elapsed of [0, 600, 3_600, 90_000]) {
              const v = valueRefund({
                kind: pct === null ? 'FULL' : 'PRORATED', percentage: pct, status,
                durationSeconds: D, carryoverSeconds: status === 'AVAILABLE' ? 0 : C,
                elapsedSeconds: elapsed,
              });
              expect(v.deniedSeconds).toBeGreaterThanOrEqual(0);
              expect(v.deniedSeconds).toBeLessThanOrEqual(D);
              expect(v.deniedSeconds).toBeLessThanOrEqual(86_400);
              expect(v.deniedSeconds).toBeLessThanOrEqual(v.baseRemainingSeconds);
              expect(v.survivingFutureSeconds).toBeGreaterThanOrEqual(0);
              // Conservation: what remained is either denied or survives. Nothing evaporates.
              expect(v.baseRemainingSeconds + v.carryRemainingSeconds)
                .toBe(v.deniedSeconds + v.survivingFutureSeconds);
            }
          }
        }
      }
    }
  });
});
