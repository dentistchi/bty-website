import { describe, it, expect } from 'vitest';
import { guestNameKey, normalizeGuestName, isValidGuestName, GUEST_NAME_MAX } from './guest-identity';
import {
  isHorizontalIntent,
  clampToDirection,
  swipeCommitted,
  swipeProgress,
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
