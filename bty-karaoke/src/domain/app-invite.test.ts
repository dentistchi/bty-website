import { describe, it, expect } from 'vitest';
import {
  GUEST_FUNNEL_EVENTS,
  inviteShownKey,
  shouldShowInvite,
  appStoreAction,
  inviteCopy,
  persistentCtaCopy,
  appUrlKey,
  persistentCtaShownKey,
  resolvePersistentCta,
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
  it('defines the closed funnel set (one-time + persistent, kept separate)', () => {
    expect(GUEST_FUNNEL_EVENTS).toEqual([
      'INVITE_ELIGIBLE',
      'INVITE_SHOWN',
      'APP_OPEN_TAPPED',
      'APP_STORE_TAPPED',
      'CONTINUE_WEB',
      'PERSISTENT_APP_CTA_SHOWN',
      'PERSISTENT_APP_CTA_TAPPED',
    ]);
  });
  it('the persistent CTA events are distinct from the one-time invitation events', () => {
    expect(GUEST_FUNNEL_EVENTS).toContain('PERSISTENT_APP_CTA_SHOWN');
    expect(GUEST_FUNNEL_EVENTS).toContain('PERSISTENT_APP_CTA_TAPPED');
    // never merged / aliased with the one-time INVITE_SHOWN
    expect('PERSISTENT_APP_CTA_SHOWN').not.toBe('INVITE_SHOWN');
  });
  it('copy is action-first and leaks no token/URL/identity', () => {
    const all = Object.values(inviteCopy('ko')).join(' ');
    expect(all).not.toMatch(/http|token|apple|id\d{6,}/i);
    expect(inviteCopy('ko').openApp).toBe('앱에서 열기');
    expect(inviteCopy('ko').continueWeb).toBe('웹에서 계속하기');
  });
});

describe('persistent app-entry CTA (BUILD 19C — always under the hero)', () => {
  it('uses the exact product copy', () => {
    expect(persistentCtaCopy('ko').label).toBe('앱에서 보기');
    expect(persistentCtaCopy('ko').supporting).toBe('내 노래 순서와 준비 상태를 앱에서 바로 확인하세요');
  });
  it('never uses the forbidden install/App Store wording before BUILD 19D', () => {
    const all = Object.values(persistentCtaCopy('ko')).join(' ');
    expect(all).not.toContain('앱 설치하기');
    expect(all).not.toContain('App Store');
    expect(all).not.toMatch(/http|token|apple|id\d{6,}/i);
  });
  it('is ACTIVE only with a Universal Link, else INFORMATIONAL (no dead link)', () => {
    expect(resolvePersistentCta({ universalLink: 'https://norebang.btydaily.com/app/join/abc' }).active).toBe(true);
    expect(resolvePersistentCta({ universalLink: null }).active).toBe(false);
    expect(resolvePersistentCta({ universalLink: '' }).active).toBe(false);
    expect(resolvePersistentCta({ universalLink: '   ' }).active).toBe(false);
  });
  it('persists the link + shown flag per room+event (a new Event re-activates)', () => {
    expect(appUrlKey('joy', 'e1')).toBe('bty:appurl:joy:e1');
    expect(appUrlKey('joy', 'e2')).not.toBe(appUrlKey('joy', 'e1'));
    expect(persistentCtaShownKey('joy', 'e1')).toBe('bty:appcta:shown:joy:e1');
    expect(persistentCtaShownKey('joy', null)).toBe('bty:appcta:shown:joy:');
    // distinct namespace from the one-time invite flag
    expect(persistentCtaShownKey('joy', 'e1')).not.toBe(inviteShownKey('joy', 'e1'));
  });
});
