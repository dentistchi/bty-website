// BUILD 24-G1 — regression for the FOUNDER-OBSERVED contradiction on Host Web.
//
// With 1:50 of FREE time remaining and a 4:41 next song, one screen showed BOTH:
//     "무료 이용 시간이 1:50 남았어요"          (banner, correct)
//     "오늘의 무료 이용 시간을 모두 사용했어요"   (block, FALSE)
//
// The server refusal was correct — a 2:51 shortfall is far past the 90s Final Song Grace bound —
// but `upgrade_required` is raised for the whole predicate `charge > remaining`, and three call
// sites had hard-coded "all time used" as its only wording.
//
// These tests pin the distinction itself. They assert on the PURE copy selector, so they cannot
// be satisfied by a component happening to render something else.

import { describe, it, expect } from 'vitest';
import {
  upgradeRequiredCopy,
  UPGRADE_REQUIRED_EXHAUSTED,
  UPGRADE_REQUIRED_TOO_LONG,
  publishAdmissionFields,
} from './admission-copy';

/** The founder's exact scenario. */
const FOUNDER = { remainingSeconds: 110, requiredChargeSeconds: 281, durationSeconds: 281 };

describe('BUILD 24-G1 — positive remaining must never say "all time used"', () => {
  it('the founder scenario does NOT claim exhaustion', () => {
    const copy = upgradeRequiredCopy(FOUNDER);
    expect(copy).not.toContain('모두 사용했어요');
    expect(copy).toContain('남은 무료 이용 시간보다 이 곡이 길어서');
  });

  it('names the remedy that actually works right now — a shorter song', () => {
    expect(upgradeRequiredCopy(FOUNDER)).toContain('더 짧은 곡');
  });

  it('quotes the authority’s own numbers when it published them', () => {
    const copy = upgradeRequiredCopy(FOUNDER);
    expect(copy).toContain('4:41'); // required charge
    expect(copy).toContain('1:50'); // remaining
  });

  it('leads with the REQUIRED time, not the raw song length, when a lease makes them differ', () => {
    // An active lease already covers part of the song: needs 60s, song is 4:41 long.
    const copy = upgradeRequiredCopy({ remainingSeconds: 30, requiredChargeSeconds: 60, durationSeconds: 281 });
    expect(copy).toContain('필요한 시간은 1:00');
    expect(copy).toContain('(곡 길이 4:41)'); // named separately, never presented as "needed"
  });

  it('omits the song-length note when it equals the required time', () => {
    expect(upgradeRequiredCopy(FOUNDER)).not.toContain('곡 길이');
  });

  it('any positive remaining avoids the exhausted sentence', () => {
    for (const remaining of [1, 30, 110, 300, 899]) {
      expect(upgradeRequiredCopy({ remainingSeconds: remaining })).not.toContain('모두 사용했어요');
    }
  });
});

describe('BUILD 24-G1 — zero remaining DOES say "all time used"', () => {
  it('zero is the exhausted sentence', () => {
    expect(upgradeRequiredCopy({ remainingSeconds: 0 })).toBe(UPGRADE_REQUIRED_EXHAUSTED);
    expect(upgradeRequiredCopy({ remainingSeconds: 0 })).toContain('모두 사용했어요');
  });

  it('a negative balance also reads as exhausted, never as "you have time"', () => {
    expect(upgradeRequiredCopy({ remainingSeconds: -45 })).toBe(UPGRADE_REQUIRED_EXHAUSTED);
  });

  it('an ABSENT remaining falls back to exhausted — the safe direction', () => {
    // It must never claim the Host has time it cannot prove they have.
    expect(upgradeRequiredCopy(null)).toBe(UPGRADE_REQUIRED_EXHAUSTED);
    expect(upgradeRequiredCopy(undefined)).toBe(UPGRADE_REQUIRED_EXHAUSTED);
    expect(upgradeRequiredCopy({})).toBe(UPGRADE_REQUIRED_EXHAUSTED);
    expect(upgradeRequiredCopy({ remainingSeconds: null })).toBe(UPGRADE_REQUIRED_EXHAUSTED);
  });

  it('degrades to the plain sentence when remaining is known but the charge is not', () => {
    expect(upgradeRequiredCopy({ remainingSeconds: 110 })).toBe(UPGRADE_REQUIRED_TOO_LONG);
  });
});

describe('BUILD 24-G1 — the two sentences are genuinely distinct', () => {
  it('exhausted and too-long share no claim', () => {
    expect(UPGRADE_REQUIRED_EXHAUSTED).not.toBe(UPGRADE_REQUIRED_TOO_LONG);
    expect(UPGRADE_REQUIRED_TOO_LONG).not.toContain('모두 사용');
    expect(UPGRADE_REQUIRED_EXHAUSTED).not.toContain('더 짧은 곡');
  });
});

describe('BUILD 24-G1 — Final Song Grace: admitted and refused are distinct outcomes', () => {
  it('an ADMITTED grace start publishes grace fields and produces NO refusal copy', () => {
    // Grace admitted the song, so there is no `upgrade_required` and no block sentence at all.
    const admitted = publishAdmissionFields({
      finalSongGraceApplied: true,
      finalSongGraceSeconds: 70,
      finalSongChargedSeconds: 30,
      remainingBeforeSeconds: 30,
      leaseEndsAt: '2026-08-02T11:33:00.000Z',
      durationSeconds: 100,
    });
    expect(admitted.finalSongGraceApplied).toBe(true);
    expect(admitted.finalSongGraceSeconds).toBe(70);
    // Nothing in a successful admission carries a refusal sentence.
    expect(Object.values(admitted)).not.toContain(UPGRADE_REQUIRED_EXHAUSTED);
    expect(Object.values(admitted)).not.toContain(UPGRADE_REQUIRED_TOO_LONG);
  });

  it('a NON-eligible shortfall is refused with the too-long sentence, not the exhausted one', () => {
    // The founder's case: 2:51 shortfall, far past the 90s bound. Balance is NOT zero.
    const refused = upgradeRequiredCopy(FOUNDER);
    expect(refused).toBe(
      `${UPGRADE_REQUIRED_TOO_LONG}\n이번 재생에 필요한 시간은 4:41인데, 남은 무료 시간은 1:50이에요.`,
    );
    expect(refused).not.toContain('모두 사용했어요');
  });

  it('a refusal AFTER grace was consumed (balance now 0) correctly reads as exhausted', () => {
    // Grace charges exactly the remaining balance, so the next refusal is genuine exhaustion.
    expect(upgradeRequiredCopy({ remainingSeconds: 0, requiredChargeSeconds: 60 }))
      .toBe(UPGRADE_REQUIRED_EXHAUSTED);
  });

  it('an ordinary start publishes no grace key at all', () => {
    const ordinary = publishAdmissionFields({ leaseEndsAt: '2026-08-02T11:33:00.000Z', durationSeconds: 162 });
    expect('finalSongGraceApplied' in ordinary).toBe(false);
  });
});

describe('BUILD 24-G1 — no client-side admission authority is introduced', () => {
  it('the selector takes no clock and no duration policy — it only reads published values', () => {
    // One argument, no `now`, no thresholds. It cannot decide admissibility; the server already did.
    expect(upgradeRequiredCopy.length).toBe(1);
  });

  it('it never computes eligibility: identical inputs always give identical output', () => {
    const a = upgradeRequiredCopy(FOUNDER);
    const realNow = Date.now;
    try {
      Date.now = () => realNow() + 86_400_000;
      expect(upgradeRequiredCopy(FOUNDER)).toBe(a);
    } finally {
      Date.now = realNow;
    }
  });

  it('does not re-derive the 90s Final Song Grace bound', () => {
    // A 90s shortfall (grace-eligible) and a 91s shortfall (not) are both SERVER decisions.
    // If the server refused, the copy is the same shape either way — this module never judges.
    const eligible = upgradeRequiredCopy({ remainingSeconds: 100, requiredChargeSeconds: 190 });
    const notEligible = upgradeRequiredCopy({ remainingSeconds: 100, requiredChargeSeconds: 191 });
    expect(eligible).toContain('남은 무료 이용 시간보다');
    expect(notEligible).toContain('남은 무료 이용 시간보다');
  });
});
