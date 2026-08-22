// BUILD 24-G1 → BUILD 26U-R1. THIS FILE'S CONTRACT WAS DELIBERATELY INVERTED.
//
// WHAT IT USED TO PROVE. BUILD 24-G1 fixed a real, Founder-photographed defect: with 1분 50초 of
// FREE time left and a 4분 41초 song queued, the Host was shown "무료 이용 시간이 1:50 남았어요"
// and "오늘의 무료 이용 시간을 모두 사용했어요" on the same screen. `upgrade_required` covered two
// different facts and the copy said only one, so this file pinned two distinct sentences, the
// discriminator between them, and the itemised numbers each had to carry.
//
// WHY IT NO LONGER APPLIES. Founder decision O-3 (BUILD 26U-R0/R1) retired the 900-second FREE
// video-second meter as an entitlement mechanism, and BUILD 26T-R1B-R6-R1A (E1) had already
// removed its enforcement from `karaoke_begin_song_v2`. There is no free balance to quote, no
// required charge to lead with, and no upgrade to offer as permission to play a video. Every
// sentence this file measured is gone.
//
// WHAT IT PROVES NOW. The same defect class, from the other side: the copy must not be able to
// make ANY claim about a quantity, because there is no quantity. A sentence that cannot cite a
// balance cannot cite the wrong one. The original bug is therefore not merely fixed but
// unexpressible — and the Founder's exact phrase is kept as a negative control so a regression
// that reintroduced it would fail here first.

import { describe, it, expect } from 'vitest';
import {
  upgradeRequiredCopy,
  UPGRADE_REQUIRED_EXHAUSTED,
  PASS_INSUFFICIENT_COPY,
} from './admission-copy';
import { PREMIUM_ROOM_EXPIRED_KO } from './premium-room-copy';

/** The exact shape the Founder photographed: time genuinely remained, and the copy denied it. */
const FOUNDER = { remainingSeconds: 110, requiredChargeSeconds: 281, durationSeconds: 281 };

/** The phrase from the photograph. Nothing may emit it, in any state. */
const EXHAUSTED_CLAIM = '모두 사용했어요';

describe('the original BUILD 24-G1 defect is now unexpressible', () => {
  it('never claims the allowance is used up — in the exact photographed state', () => {
    expect(upgradeRequiredCopy(FOUNDER)).not.toContain(EXHAUSTED_CLAIM);
  });

  it('never claims it in ANY state, including the one that used to be "truly exhausted"', () => {
    for (const d of [
      FOUNDER,
      { remainingSeconds: 0 },
      { remainingSeconds: -45 },
      { remainingSeconds: null },
      {},
      null,
      undefined,
    ]) {
      expect(upgradeRequiredCopy(d as never)).not.toContain(EXHAUSTED_CLAIM);
    }
  });

  it('cites no quantity at all, so it can never cite the wrong one', () => {
    const copy = upgradeRequiredCopy(FOUNDER);
    for (const n of ['1분 50초', '4분 41초', '110', '281', '분', '초']) {
      expect(copy, `copy must not contain "${n}"`).not.toContain(n);
    }
  });

  it('is CONSTANT across every possible detail — the detail is not consulted', () => {
    const shapes = [
      FOUNDER,
      { remainingSeconds: 0 },
      { remainingSeconds: 9999, requiredChargeSeconds: 1, durationSeconds: 1 },
      { remainingSeconds: 30, requiredChargeSeconds: 60, durationSeconds: 281 },
      {},
      null,
      undefined,
    ];
    const rendered = new Set(shapes.map((d) => upgradeRequiredCopy(d as never)));
    expect(rendered.size).toBe(1);
    expect([...rendered][0]).toBe(UPGRADE_REQUIRED_EXHAUSTED);
  });
});

describe('the retired sentences say the BTY Room thing instead (UX-2)', () => {
  it('both constants resolve to the one Premium Room sentence', () => {
    expect(UPGRADE_REQUIRED_EXHAUSTED).toBe(PREMIUM_ROOM_EXPIRED_KO);
    expect(PASS_INSUFFICIENT_COPY).toBe(PREMIUM_ROOM_EXPIRED_KO);
  });

  it('it names BTY Room time as what ended', () => {
    expect(UPGRADE_REQUIRED_EXHAUSTED).toContain('BTY 룸');
  });

  it('it says the free YouTube path still works, unprompted', () => {
    expect(UPGRADE_REQUIRED_EXHAUSTED).toContain('YouTube');
  });

  it('it never tells anyone to pick a shorter song, or to upgrade in order to play one', () => {
    for (const retired of ['더 짧은 곡', '더 짧은', 'PRO로 업그레이드', '다음 곡을 지금 시작']) {
      expect(UPGRADE_REQUIRED_EXHAUSTED).not.toContain(retired);
      expect(PASS_INSUFFICIENT_COPY).not.toContain(retired);
    }
  });

  it('it never prices a video: no reference to a song at all', () => {
    expect(UPGRADE_REQUIRED_EXHAUSTED).not.toContain('곡');
    expect(PASS_INSUFFICIENT_COPY).not.toContain('곡');
  });
});
