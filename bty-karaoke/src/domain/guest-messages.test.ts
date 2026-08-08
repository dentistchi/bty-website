// BUILD 26G — the Guest copy contract.
//
// These read the SHIPPED catalog and the SHIPPED Guest sources. Nothing is restated here, so
// a missing translation, a broken placeholder, or a new Korean literal fails as a defect
// rather than surviving as an unnoticed regression.

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { GUEST_LOCALES, type GuestLocale } from './guest-locale';
import {
  GUEST_MESSAGES,
  GUEST_MESSAGE_KEYS,
  guestT,
  type GuestMessageKey,
  type Message,
} from './guest-messages';

/** Every format string a language can produce for a key (plain + every plural variant). */
function formats(key: GuestMessageKey, locale: GuestLocale): string[] {
  const message = GUEST_MESSAGES[key][locale] as Message;
  if (typeof message === 'string') return [message];
  return [message.other, ...(message.one ? [message.one] : [])];
}

/** The `{name}` placeholders a template consumes. */
function placeholders(template: string): Set<string> {
  return new Set([...template.matchAll(/\{(\w+)\}/g)].map((m) => m[1]));
}

describe('(9) every shipped Guest key has BOTH languages', () => {
  it('declares at least the full Guest surface', () => {
    expect(GUEST_MESSAGE_KEYS.length).toBeGreaterThanOrEqual(120);
  });

  it('no key is missing English', () => {
    const missing = GUEST_MESSAGE_KEYS.filter((k) => formats(k, 'en').some((v) => !v?.trim()));
    expect(missing).toEqual([]);
  });

  it('no key is missing Korean', () => {
    const missing = GUEST_MESSAGE_KEYS.filter((k) => formats(k, 'ko').some((v) => !v?.trim()));
    expect(missing).toEqual([]);
  });

  it('every key RESOLVES in both languages — never to its own key name', () => {
    for (const key of GUEST_MESSAGE_KEYS) {
      for (const locale of GUEST_LOCALES) {
        const value = guestT(locale, key, { count: 1, position: 1, name: 'x', title: 'y', slug: 'z', reason: 'r' });
        expect(value, `${key}[${locale}]`).toBeTruthy();
        expect(value, `${key}[${locale}]`).not.toBe(key);
      }
    }
  });

  it('is actually TRANSLATED, not the same string filed twice', () => {
    // Brand/design tokens and pure punctuation templates are legitimately identical.
    const IDENTICAL_BY_DESIGN = new Set<GuestMessageKey>([
      'guest.style.mr.label',          // "🎹 MR" — MR is a product term, not a word
      'guest.resolution.a11y',         // "{title}. {reason}" — punctuation only
      'guest.name.honorific',          // English is deliberately the bare name
    ]);
    const suspicious = GUEST_MESSAGE_KEYS.filter((k) => {
      if (IDENTICAL_BY_DESIGN.has(k)) return false;
      const en = formats(k, 'en')[0];
      const ko = formats(k, 'ko')[0];
      // Only flag entries that contain real words — a template of pure placeholders/symbols
      // is expected to match.
      return en === ko && /[A-Za-z]{3,}|[가-힣]/.test(en);
    });
    expect(suspicious).toEqual([]);
  });
});

describe('(10) placeholder parity', () => {
  it('en and ko consume exactly the same placeholders for every key', () => {
    const mismatched: string[] = [];
    for (const key of GUEST_MESSAGE_KEYS) {
      const en = new Set(formats(key, 'en').flatMap((f) => [...placeholders(f)]));
      const ko = new Set(formats(key, 'ko').flatMap((f) => [...placeholders(f)]));
      if (en.size !== ko.size || [...en].some((p) => !ko.has(p))) mismatched.push(key);
    }
    expect(mismatched).toEqual([]);
  });

  it('every placeholder is actually substituted at render time', () => {
    for (const key of GUEST_MESSAGE_KEYS) {
      const names = new Set(formats(key, 'en').flatMap((f) => [...placeholders(f)]));
      if (names.size === 0) continue;
      const params = Object.fromEntries([...names].map((n) => [n, n === 'count' || n === 'position' ? 3 : `«${n}»`]));
      for (const locale of GUEST_LOCALES) {
        expect(guestT(locale, key, params), `${key}[${locale}]`).not.toMatch(/\{\w+\}/);
      }
    }
  });
});

describe('plural grammar is correct in both languages', () => {
  it('English never renders "1 songs"', () => {
    expect(guestT('en', 'guest.queue.count', { count: 1 })).toBe('1 song');
    expect(guestT('en', 'guest.queue.count', { count: 2 })).toBe('2 songs');
    expect(guestT('en', 'guest.queue.count', { count: 0 })).toBe('0 songs');
  });

  it('Korean has no plural agreement, and does not invent one', () => {
    expect(guestT('ko', 'guest.queue.count', { count: 1 })).toBe('1곡');
    expect(guestT('ko', 'guest.queue.count', { count: 5 })).toBe('5곡');
  });

  it('every pluralized key declares English one+other and Korean other-only', () => {
    const badEnglish: string[] = [];
    const badKorean: string[] = [];
    for (const key of GUEST_MESSAGE_KEYS) {
      const en = GUEST_MESSAGES[key].en;
      const ko = GUEST_MESSAGES[key].ko;
      const isPlural = typeof en !== 'string' || typeof ko !== 'string';
      if (!isPlural) continue;
      if (typeof en === 'string' || !en.one || !en.other) badEnglish.push(key);
      // Korean must declare `other` ONLY. The literal type of a Korean plural entry has no
      // `one` at all, which is the point — read it structurally so the check is real.
      const koCategories = typeof ko === 'string' ? [] : Object.keys(ko);
      if (typeof ko === 'string' || koCategories.join(',') !== 'other') badKorean.push(key);
    }
    expect(badEnglish).toEqual([]);
    expect(badKorean).toEqual([]);
  });

  it('the plural-bearing Guest counts all read correctly at 1 and at many', () => {
    for (const key of ['guest.queue.count', 'guest.search.show_more', 'guest.dock.open_a11y', 'guest.subtitle.ready_ahead'] as const) {
      expect(guestT('en', key, { count: 1 })).toBeTruthy();
      expect(guestT('en', key, { count: 1 })).not.toMatch(/\b1 [a-z]+s\b/);
      expect(guestT('en', key, { count: 4 })).toBeTruthy();
    }
  });
});

describe('(13) server identifiers stay untranslated — only presentation is localized', () => {
  it('no catalog VALUE is a bare server code', () => {
    const CODES = [
      'guest_cancelled', 'host_removed', 'host_skipped', 'event_ended', 'unknown_resolution',
      'song_too_long', 'idempotency_conflict', 'room_unavailable', 'server_temporary',
      'EVENT_ENDED', 'ROOM_NOT_FOUND', 'INVALID_REQUEST', 'IDEMPOTENCY_CONFLICT',
    ];
    for (const key of GUEST_MESSAGE_KEYS) {
      for (const locale of GUEST_LOCALES) {
        for (const format of formats(key, locale)) {
          for (const code of CODES) expect(format, `${key}[${locale}]`).not.toContain(code);
        }
      }
    }
  });

  it('no catalog value leaks an endpoint, token, or stack', () => {
    for (const key of GUEST_MESSAGE_KEYS) {
      for (const locale of GUEST_LOCALES) {
        for (const format of formats(key, locale)) {
          expect(format, `${key}[${locale}]`).not.toMatch(/\/api\/|Bearer|undefined|null|localhost|http:\/\//);
        }
      }
    }
  });

  it('brand and design tokens are byte-identical in both languages', () => {
    // "Norebang" is a product name and is never translated.
    for (const [en, ko] of [
      [guestT('en', 'guest.style.mr.label'), guestT('ko', 'guest.style.mr.label')],
    ]) {
      expect(en).toBe(ko);
    }
    expect(guestT('en', 'guest.event.ended.title')).toContain('norebang');
    expect(guestT('en', 'guest.submit.error.event_closed')).toContain('norebang');
  });
});

// ── (11) no unauthorized shipped Korean literal in the Guest surface ────────────────────

/** Guest-surface sources. Host / DJ / Display / admin are out of BUILD 26G's scope. */
const GUEST_SOURCES = [
  'src/app/r/[slug]/page.tsx',
  'src/app/r/[slug]/RequestForm.tsx',
  'src/app/r/[slug]/MyRequestsDock.tsx',
  'src/app/r/[slug]/QueueBoard.tsx',
  'src/app/r/[slug]/RequestResultCard.tsx',
  'src/app/r/[slug]/RecentlySungSection.tsx',
  'src/app/r/[slug]/SwipeableCard.tsx',
  'src/app/r/[slug]/AppInvitationCard.tsx',
  'src/app/r/[slug]/PersistentAppEntry.tsx',
  'src/app/r/[slug]/RoomLiveGuard.tsx',
  'src/app/r/[slug]/GuestFreshnessGuard.tsx',
  'src/app/r/[slug]/GuestDiagnosticPanel.tsx',
  'src/app/app/join/[token]/JoinFallbackClient.tsx',
  'src/app/app/join/[token]/page.tsx',
  'src/components/legal/GuestConsentGate.tsx',
  'src/components/guest/GuestLegalLinks.tsx',
  'src/components/guest/GuestLocaleProvider.tsx',
  'src/components/guest/GuestLanguageSwitcher.tsx',
  'src/domain/app-invite.ts',
  'src/domain/guest-requests.ts',
  'src/domain/request-resolution.ts',
  'src/domain/request-submit.ts',
];

/**
 * The ONLY Korean allowed to remain in Guest source, each with its reason.
 *
 * These are not copy: they decide what YouTube is ASKED for, or they are a language's own
 * name. A new user-visible Korean literal is not on this list and therefore fails.
 */
const APPROVED_KOREAN = [
  { file: 'src/domain/performance-style.ts', reason: 'search-query bias + Hangul detection — decides what YouTube is asked for, not what the Guest reads' },
  { file: 'src/domain/guest-locale.ts', reason: 'the Korean endonym 한국어 — a language names itself and is never translated' },
  { file: 'src/domain/song-title.ts', reason: 'YouTube title normalization patterns — content matching, never displayed' },
  { file: 'src/domain/video-kind.ts', reason: 'video classification patterns — content matching, never displayed' },
  { file: 'src/domain/youtube-rank.ts', reason: 'result ranking heuristics — content matching, never displayed' },
  { file: 'src/domain/youtube-search.ts', reason: 'query building — content matching, never displayed' },
];

/** Strip comments; a `//` inside a string literal (e.g. `https://…`) is not a comment. */
function code(src: string): string {
  let out = '';
  let inString: string | null = null;
  let escaped = false;
  for (let i = 0; i < src.length; i += 1) {
    const c = src[i];
    const next = src[i + 1];
    if (inString) {
      out += c;
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === inString) inString = null;
      continue;
    }
    if (c === '/' && next === '/') {
      while (i < src.length && src[i] !== '\n') i += 1;
      out += '\n';
      continue;
    }
    if (c === '/' && next === '*') {
      i += 2;
      while (i + 1 < src.length && !(src[i] === '*' && src[i + 1] === '/')) {
        if (src[i] === '\n') out += '\n';
        i += 1;
      }
      i += 1;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') inString = c;
    out += c;
  }
  return out;
}

const HANGUL = /[가-힣]/;

describe('(11) no unauthorized Korean literal survives in the Guest surface', () => {
  it('sees the whole Guest surface (the scan cannot pass by reading nothing)', () => {
    for (const file of GUEST_SOURCES) {
      expect(statSync(file).size, file).toBeGreaterThan(0);
    }
    expect(GUEST_SOURCES.length).toBeGreaterThanOrEqual(20);
  });

  it('every Guest source is free of Korean outside comments', () => {
    const offenders: string[] = [];
    for (const file of GUEST_SOURCES) {
      const src = code(readFileSync(file, 'utf8'));
      src.split('\n').forEach((line, i) => {
        if (HANGUL.test(line)) offenders.push(`${file}:${i + 1}: ${line.trim().slice(0, 80)}`);
      });
    }
    expect(offenders).toEqual([]);
  });

  it('the approved exceptions are explicit, and each still exists', () => {
    for (const { file, reason } of APPROVED_KOREAN) {
      expect(reason.length, file).toBeGreaterThan(20); // a real justification, not a rubber stamp
      const src = code(readFileSync(file, 'utf8'));
      expect(HANGUL.test(src), `${file} no longer needs its exemption`).toBe(true);
    }
  });

  it('no NEW Guest source quietly acquires Korean', () => {
    // Everything under the Guest route that is not a test must be either localized or
    // explicitly exempted. A new file added without either fails here.
    const dir = 'src/app/r/[slug]';
    const approved = new Set(APPROVED_KOREAN.map((a) => a.file));
    const known = new Set([...GUEST_SOURCES, ...approved]);
    const offenders: string[] = [];
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (!statSync(path).isFile() || !/\.tsx?$/.test(name) || /\.test\./.test(name)) continue;
      if (known.has(path)) continue;
      if (HANGUL.test(code(readFileSync(path, 'utf8')))) offenders.push(path);
    }
    expect(offenders).toEqual([]);
  });
});
