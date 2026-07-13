import { describe, it, expect } from 'vitest';
import { guestNameKey, normalizeGuestName, isValidGuestName, GUEST_NAME_MAX } from './guest-identity';
import {
  isHorizontalIntent,
  clampToDirection,
  swipeCommitted,
  swipeProgress,
  decideIntent,
  commitThresholdPx,
  isEdgeStart,
  DEFAULT_SWIPE_THRESHOLD,
} from './swipe';

describe('guest-identity', () => {
  it('scopes the storage key per room slug', () => {
    expect(guestNameKey('bty-home')).toBe('bty-karaoke:bty-home:guest-name');
    expect(guestNameKey('room-2')).not.toBe(guestNameKey('bty-home'));
  });
  it('normalizes and caps the name', () => {
    expect(normalizeGuestName('  Han   bit  ')).toBe('Han bit');
    expect(normalizeGuestName('x'.repeat(60))).toHaveLength(GUEST_NAME_MAX);
  });
  it('validates presence', () => {
    expect(isValidGuestName('Hanbit')).toBe(true);
    expect(isValidGuestName('   ')).toBe(false);
    expect(isValidGuestName('')).toBe(false);
  });
});

describe('swipe', () => {
  it('detects horizontal intent only when sideways dominates', () => {
    expect(isHorizontalIntent(40, 5)).toBe(true);
    expect(isHorizontalIntent(5, 40)).toBe(false); // vertical scroll wins
    expect(isHorizontalIntent(6, 2)).toBe(false); // under slop
  });
  it('clamps to the allowed direction', () => {
    expect(clampToDirection(50, 'right')).toBe(50);
    expect(clampToDirection(-50, 'right')).toBe(0);
    expect(clampToDirection(-50, 'left')).toBe(-50);
    expect(clampToDirection(50, 'left')).toBe(0);
  });
  it('commits only past the threshold in the right direction', () => {
    expect(swipeCommitted(DEFAULT_SWIPE_THRESHOLD, 'right')).toBe(true);
    expect(swipeCommitted(DEFAULT_SWIPE_THRESHOLD - 1, 'right')).toBe(false);
    expect(swipeCommitted(-DEFAULT_SWIPE_THRESHOLD, 'left')).toBe(true);
    expect(swipeCommitted(-DEFAULT_SWIPE_THRESHOLD, 'right')).toBe(false); // wrong way
  });
  it('reports 0..1 progress', () => {
    expect(swipeProgress(0, 'right')).toBe(0);
    expect(swipeProgress(DEFAULT_SWIPE_THRESHOLD / 2, 'right')).toBeCloseTo(0.5);
    expect(swipeProgress(DEFAULT_SWIPE_THRESHOLD * 2, 'right')).toBe(1);
  });
});

describe('decideIntent (iPhone touch fix)', () => {
  it('stays pending inside the slop zone — never abandons the noisy start', () => {
    // The exact real-finger case that used to kill the gesture: first sample dy>dx, tiny.
    expect(decideIntent(1, 2, 'left')).toBe('pending');
    expect(decideIntent(-8, 10, 'left')).toBe('pending'); // still under slop
  });
  it('claims horizontal once past slop and beating vertical by the ratio', () => {
    expect(decideIntent(-40, 10, 'left')).toBe('horizontal');
    expect(decideIntent(40, 10, 'right')).toBe('horizontal');
  });
  it('yields to vertical scroll when vertical dominates', () => {
    expect(decideIntent(-14, 40, 'left')).toBe('vertical');
  });
  it('treats a wrong-direction horizontal move as vertical (not ours)', () => {
    expect(decideIntent(40, 5, 'left')).toBe('vertical'); // rightward on a left card
  });
});

describe('commitThresholdPx', () => {
  it('is a clamped fraction of card width', () => {
    expect(commitThresholdPx(300, 0.35)).toBeCloseTo(105);
    expect(commitThresholdPx(100, 0.35)).toBe(64); // min clamp
    expect(commitThresholdPx(1000, 0.35)).toBe(180); // max clamp
    expect(commitThresholdPx(0)).toBe(DEFAULT_SWIPE_THRESHOLD); // fallback
  });
});

describe('isEdgeStart', () => {
  it('flags gestures starting near either screen edge (OS nav)', () => {
    expect(isEdgeStart(8, 390)).toBe(true);
    expect(isEdgeStart(384, 390)).toBe(true);
    expect(isEdgeStart(200, 390)).toBe(false);
  });
});
