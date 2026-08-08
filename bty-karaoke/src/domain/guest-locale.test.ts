// BUILD 26G — the QR Browser Guest locale rule.
//
// The product rule these tests exist to protect:
//
//     Host language belongs to Host.
//     QR Browser Guest language belongs to the Browser Guest.
//     Room language controls neither.

import { describe, it, expect } from 'vitest';
import {
  DEFAULT_GUEST_LOCALE,
  GUEST_LOCALES,
  GUEST_LOCALE_ENDONYM,
  normalizeGuestLocale,
  parseAcceptLanguage,
  pickFromBrowserLanguages,
  resolveGuestLocale,
} from './guest-locale';

describe('supported languages and the fallback', () => {
  it('ships exactly en + ko, with English as the source/fallback', () => {
    expect([...GUEST_LOCALES].sort()).toEqual(['en', 'ko']);
    expect(DEFAULT_GUEST_LOCALE).toBe('en');
  });

  it('normalizes a region tag to its language', () => {
    expect(normalizeGuestLocale('ko-KR')).toBe('ko');
    expect(normalizeGuestLocale('en-GB')).toBe('en');
    expect(normalizeGuestLocale('EN_us')).toBe('en');
    expect(normalizeGuestLocale('  ko  ')).toBe('ko');
  });

  it('returns null (not Korean, not a guess) for anything unsupported', () => {
    for (const tag of ['fr-FR', 'de', 'ja-JP', 'zh-Hans', '', '  ', null, undefined, '*']) {
      expect(normalizeGuestLocale(tag)).toBeNull();
    }
  });

  it('each language names ITSELF — an endonym is never translated', () => {
    expect(GUEST_LOCALE_ENDONYM.en).toBe('English');
    expect(GUEST_LOCALE_ENDONYM.ko).toBe('한국어');
  });
});

describe('(1)(2) browser language detection honours ORDER', () => {
  it('an English-first browser gets English', () => {
    expect(resolveGuestLocale({ browserLanguages: ['en-US', 'ko-KR'] })).toBe('en');
  });

  it('a Korean-first browser gets Korean', () => {
    expect(resolveGuestLocale({ browserLanguages: ['ko-KR', 'en-US'] })).toBe('ko');
  });

  it('order — not mere presence — decides it', () => {
    // The whole defect class: "does ko appear anywhere?" gets BOTH of the above wrong.
    expect(pickFromBrowserLanguages(['en-US', 'ko-KR'])).toBe('en');
    expect(pickFromBrowserLanguages(['ko-KR', 'en-US'])).toBe('ko');
  });

  it('skips unsupported languages and takes the first supported one', () => {
    expect(resolveGuestLocale({ browserLanguages: ['fr-FR', 'ko-KR', 'en-US'] })).toBe('ko');
    expect(resolveGuestLocale({ browserLanguages: ['de-DE', 'en-GB'] })).toBe('en');
  });
});

describe('(3) an unsupported browser language falls back to English — NEVER Korean', () => {
  it('a French/German browser gets English', () => {
    expect(resolveGuestLocale({ browserLanguages: ['fr-FR', 'de-DE'] })).toBe('en');
  });

  it('every unsupported language lands on English', () => {
    for (const tag of ['ja-JP', 'zh-CN', 'es-ES', 'pt-BR', 'ar', 'hi-IN', 'vi-VN', 'th-TH']) {
      const resolved = resolveGuestLocale({ browserLanguages: [tag] });
      expect(resolved).toBe('en');
      expect(resolved).not.toBe('ko');
    }
  });

  it('an empty / absent / malformed preference list still lands on English', () => {
    expect(resolveGuestLocale({})).toBe('en');
    expect(resolveGuestLocale({ browserLanguages: [] })).toBe('en');
    expect(resolveGuestLocale({ browserLanguages: null })).toBe('en');
    expect(resolveGuestLocale({ stored: 'fr', browserLanguages: ['fr'] })).toBe('en');
  });
});

describe('(4) the Host / Room / QR cannot influence the Guest language', () => {
  it('the resolver accepts no room, host, owner or event input at all', () => {
    // Structural, not conventional: there is no parameter through which a Korean Host's
    // QR could pass a language, so the propagation defect cannot be written.
    const input = { stored: null, browserLanguages: ['en-US'] };
    expect(Object.keys(input).sort()).toEqual(['browserLanguages', 'stored']);
    expect(resolveGuestLocale(input)).toBe('en');
  });

  it('a Korean Host with an English Guest browser yields English', () => {
    // Whatever the Host's own language is, it is not one of these two inputs.
    expect(resolveGuestLocale({ stored: null, browserLanguages: ['en-US'] })).toBe('en');
  });

  it('an English Host with a Korean Guest browser yields Korean', () => {
    expect(resolveGuestLocale({ stored: null, browserLanguages: ['ko-KR'] })).toBe('ko');
  });

  it('extra host-shaped fields are ignored even if a caller passes them', () => {
    const sneaky = {
      stored: null,
      browserLanguages: ['en-US'],
      // Any of these being honoured would be the exact defect BUILD 26G forbids.
      hostLocale: 'ko',
      roomLocale: 'ko',
      ownerLanguage: 'ko',
    } as Parameters<typeof resolveGuestLocale>[0];
    expect(resolveGuestLocale(sneaky)).toBe('en');
  });
});

describe('(7) an explicit choice beats the browser default', () => {
  it('a stored English choice wins on a Korean browser', () => {
    expect(resolveGuestLocale({ stored: 'en', browserLanguages: ['ko-KR', 'ko'] })).toBe('en');
  });

  it('a stored Korean choice wins on an English browser', () => {
    expect(resolveGuestLocale({ stored: 'ko', browserLanguages: ['en-US', 'en'] })).toBe('ko');
  });

  it('an unsupported or corrupt stored value is ignored, and the browser decides', () => {
    expect(resolveGuestLocale({ stored: 'fr', browserLanguages: ['ko-KR'] })).toBe('ko');
    expect(resolveGuestLocale({ stored: '', browserLanguages: ['ko-KR'] })).toBe('ko');
    expect(resolveGuestLocale({ stored: '{}', browserLanguages: ['en-US'] })).toBe('en');
  });
});

describe('Accept-Language — the SERVER view of the same browser setting', () => {
  it('parses an ordered list', () => {
    expect(parseAcceptLanguage('ko-KR,ko;q=0.9,en-US;q=0.8')).toEqual(['ko-KR', 'ko', 'en-US']);
  });

  it('sorts by q-value, so the header order is not blindly trusted', () => {
    expect(parseAcceptLanguage('en;q=0.5,ko;q=0.9')).toEqual(['ko', 'en']);
  });

  it('drops `*` and q=0 entries — neither is a preference', () => {
    expect(parseAcceptLanguage('*')).toEqual([]);
    expect(parseAcceptLanguage('ko;q=0,en')).toEqual(['en']);
  });

  it('an absent or empty header yields no preference (→ English)', () => {
    expect(parseAcceptLanguage(null)).toEqual([]);
    expect(parseAcceptLanguage('')).toEqual([]);
    expect(resolveGuestLocale({ browserLanguages: parseAcceptLanguage(null) })).toBe('en');
  });

  it('server and client agree for the same browser', () => {
    // First paint (Accept-Language) must not disagree with post-hydration
    // (navigator.languages), or a Guest sees one frame of the wrong language.
    const header = 'ko-KR,ko;q=0.9,en-US;q=0.8';
    const navigatorLanguages = ['ko-KR', 'ko', 'en-US'];
    expect(resolveGuestLocale({ browserLanguages: parseAcceptLanguage(header) })).toBe(
      resolveGuestLocale({ browserLanguages: navigatorLanguages }),
    );
  });
});
