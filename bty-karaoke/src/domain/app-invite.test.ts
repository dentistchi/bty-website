import { describe, it, expect } from 'vitest';
import {
  GUEST_FUNNEL_EVENTS,
  inviteShownKey,
  shouldShowInvite,
  appStoreAction,
  INVITE_COPY,
} from './app-invite';

describe('inviteShownKey (once per session per Event)', () => {
  it('is scoped by slug + eventId so a new Event can show again', () => {
    expect(inviteShownKey('joy', 'e1')).toBe('bty:appinvite:joy:e1');
    expect(inviteShownKey('joy', 'e2')).not.toBe(inviteShownKey('joy', 'e1'));
    expect(inviteShownKey('joy', null)).toBe('bty:appinvite:joy:');
  });
});

describe('shouldShowInvite', () => {
  it('shows only on first success with a Universal Link', () => {
    expect(shouldShowInvite({ succeeded: true, alreadyShownThisEvent: false, hasUniversalLink: true })).toBe(true);
  });
  it('never shows when not succeeded', () => {
    expect(shouldShowInvite({ succeeded: false, alreadyShownThisEvent: false, hasUniversalLink: true })).toBe(false);
  });
  it('never re-shows when already shown this Event (idempotent on replay)', () => {
    expect(shouldShowInvite({ succeeded: true, alreadyShownThisEvent: true, hasUniversalLink: true })).toBe(false);
  });
  it('never shows a broken invite without a Universal Link', () => {
    expect(shouldShowInvite({ succeeded: true, alreadyShownThisEvent: false, hasUniversalLink: false })).toBe(false);
  });
});

describe('appStoreAction (hidden until a real product page exists — BUILD 19D)', () => {
  it('is hidden for null/empty', () => {
    expect(appStoreAction(null)).toEqual({ visible: false, url: null });
    expect(appStoreAction('')).toEqual({ visible: false, url: null });
    expect(appStoreAction('   ')).toEqual({ visible: false, url: null });
  });
  it('is visible only with a real URL', () => {
    expect(appStoreAction('https://apps.apple.com/app/id123')).toEqual({ visible: true, url: 'https://apps.apple.com/app/id123' });
  });
});

describe('funnel event vocabulary + copy', () => {
  it('defines the closed funnel set', () => {
    expect(GUEST_FUNNEL_EVENTS).toEqual(['INVITE_ELIGIBLE', 'INVITE_SHOWN', 'APP_OPEN_TAPPED', 'APP_STORE_TAPPED', 'CONTINUE_WEB']);
  });
  it('copy is action-first and leaks no token/URL/identity', () => {
    const all = Object.values(INVITE_COPY).join(' ');
    expect(all).not.toMatch(/http|token|apple|id\d{6,}/i);
    expect(INVITE_COPY.openApp).toBe('앱에서 열기');
    expect(INVITE_COPY.continueWeb).toBe('웹에서 계속하기');
  });
});
