// @vitest-environment jsdom
//
// BUILD 26G — the QR Browser Guest language contract, exercised through the REAL components.
//
// The defect class this protects against is not "a string is untranslated". It is:
//
//     a Korean Host's QR decides what an English Guest reads.
//
// So these mount the actual Guest surfaces, drive the actual switcher, and assert what a
// Guest would see — including that a Host's language has no path into any of it.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import {
  GUEST_LOCALE_COOKIE,
  GUEST_LOCALE_STORAGE_KEY,
  type GuestLocale,
} from '@/domain/guest-locale';
import { guestT } from '@/domain/guest-messages';
import { GuestLocaleProvider, useGuestT } from './GuestLocaleProvider';
import GuestLanguageSwitcher from './GuestLanguageSwitcher';
import GuestLegalLinks from './GuestLegalLinks';
import QueueBoard from '@/app/r/[slug]/QueueBoard';

/** Pretend this browser prefers `languages`, exactly as a real device would report. */
function browserPrefers(languages: string[]) {
  Object.defineProperty(window.navigator, 'languages', { value: languages, configurable: true });
  Object.defineProperty(window.navigator, 'language', { value: languages[0], configurable: true });
}

function clearCookies() {
  for (const part of document.cookie.split(';')) {
    const name = part.split('=')[0]?.trim();
    if (name) document.cookie = `${name}=; Path=/; Max-Age=0`;
  }
}

/** A probe that prints the resolved copy for a key — the Guest's-eye view. */
function Probe() {
  const t = useGuestT();
  return <span data-testid="probe">{t('guest.search.action')}</span>;
}

beforeEach(() => {
  window.localStorage.clear();
  clearCookies();
  browserPrefers(['en-US']);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('(1)(2)(3) the Guest browser decides the language', () => {
  it('an English browser renders English', async () => {
    browserPrefers(['en-US', 'ko-KR']);
    render(
      <GuestLocaleProvider>
        <Probe />
      </GuestLocaleProvider>,
    );
    expect((await screen.findByTestId('probe')).textContent).toBe(guestT('en', 'guest.search.action'));
  });

  it('a Korean browser renders Korean', async () => {
    browserPrefers(['ko-KR', 'en-US']);
    render(
      <GuestLocaleProvider>
        <Probe />
      </GuestLocaleProvider>,
    );
    expect((await screen.findByTestId('probe')).textContent).toBe(guestT('ko', 'guest.search.action'));
  });

  it('an unsupported (French) browser renders English, never Korean', async () => {
    browserPrefers(['fr-FR', 'de-DE']);
    render(
      <GuestLocaleProvider>
        <Probe />
      </GuestLocaleProvider>,
    );
    const shown = (await screen.findByTestId('probe')).textContent;
    expect(shown).toBe(guestT('en', 'guest.search.action'));
    expect(shown).not.toBe(guestT('ko', 'guest.search.action'));
  });
});

describe('(4) the Host language has NO path into the Guest surface', () => {
  it("a Korean Host's server hint is overridden by the Guest's own English browser", async () => {
    // `initialLocale` is the only value the server can hand in. Even if something upstream
    // were to hand in Korean, the Guest's OWN browser wins after mount.
    browserPrefers(['en-US']);
    render(
      <GuestLocaleProvider initialLocale="ko">
        <Probe />
      </GuestLocaleProvider>,
    );
    expect((await screen.findByTestId('probe')).textContent).toBe(guestT('en', 'guest.search.action'));
  });

  it("an English Host's hint is overridden by the Guest's own Korean browser", async () => {
    browserPrefers(['ko-KR']);
    render(
      <GuestLocaleProvider initialLocale="en">
        <Probe />
      </GuestLocaleProvider>,
    );
    expect((await screen.findByTestId('probe')).textContent).toBe(guestT('ko', 'guest.search.action'));
  });

  it('the provider exposes no room / host / event prop to carry a language', () => {
    const source = readFileSync('src/components/guest/GuestLocaleProvider.tsx', 'utf8');
    for (const forbidden of ['roomLocale', 'hostLocale', 'ownerLocale', 'room:', 'slug:', 'eventId']) {
      expect(source, `provider must not accept ${forbidden}`).not.toContain(forbidden);
    }
  });
});

describe('(5)(6) manual switching, immediately and without leaving the room', () => {
  it('switches English → 한국어 in place', async () => {
    browserPrefers(['en-US']);
    render(
      <GuestLocaleProvider>
        <GuestLanguageSwitcher />
        <Probe />
      </GuestLocaleProvider>,
    );
    expect((await screen.findByTestId('probe')).textContent).toBe(guestT('en', 'guest.search.action'));
    fireEvent.click(screen.getByRole('button', { name: '한국어' }));
    expect(screen.getByTestId('probe').textContent).toBe(guestT('ko', 'guest.search.action'));
  });

  it('switches 한국어 → English in place', async () => {
    browserPrefers(['ko-KR']);
    render(
      <GuestLocaleProvider>
        <GuestLanguageSwitcher />
        <Probe />
      </GuestLocaleProvider>,
    );
    expect((await screen.findByTestId('probe')).textContent).toBe(guestT('ko', 'guest.search.action'));
    fireEvent.click(screen.getByRole('button', { name: 'English' }));
    expect(screen.getByTestId('probe').textContent).toBe(guestT('en', 'guest.search.action'));
  });

  it('offers each language by its OWN name and no flag', () => {
    render(
      <GuestLocaleProvider>
        <GuestLanguageSwitcher />
      </GuestLocaleProvider>,
    );
    expect(screen.getByRole('button', { name: '한국어' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'English' })).toBeTruthy();
    // A flag names a country, not a language — none is RENDERED, and none is coded.
    // (The component's own comment explains why, so the scan reads code, not prose.)
    const rendered = document.body.innerHTML;
    expect(rendered).not.toMatch(/🇰🇷|🇺🇸|🇬🇧|🏴|🇯🇵|🇨🇳/u);
    const source = readFileSync('src/components/guest/GuestLanguageSwitcher.tsx', 'utf8');
    const codeOnly = source.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    expect(codeOnly).not.toMatch(/🇰🇷|🇺🇸|🇬🇧|flag/i);
  });

  it('marks the active language for assistive technology, and keeps both operable', async () => {
    browserPrefers(['ko-KR']);
    render(
      <GuestLocaleProvider>
        <GuestLanguageSwitcher />
      </GuestLocaleProvider>,
    );
    const korean = await screen.findByRole('button', { name: '한국어' });
    const english = screen.getByRole('button', { name: 'English' });
    expect(korean.getAttribute('aria-pressed')).toBe('true');
    expect(english.getAttribute('aria-pressed')).toBe('false');
    // A mis-tap must always be recoverable — neither option is ever disabled.
    expect(korean.hasAttribute('disabled')).toBe(false);
    expect(english.hasAttribute('disabled')).toBe(false);
  });

  it('switching does not navigate, reload, or unmount the room', () => {
    const assign = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { ...window.location, assign, reload: vi.fn(), href: 'http://localhost/r/joy' },
      configurable: true,
    });
    render(
      <GuestLocaleProvider>
        <GuestLanguageSwitcher />
        <Probe />
      </GuestLocaleProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: '한국어' }));
    expect(assign).not.toHaveBeenCalled();
    expect((window.location.reload as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
    // The same mounted subtree is still there, now in Korean.
    expect(screen.getByTestId('probe').textContent).toBe(guestT('ko', 'guest.search.action'));
  });
});

describe('(7)(8) persistence — the choice outlives the page', () => {
  it('a manual choice beats the browser default on the NEXT mount (reload)', async () => {
    browserPrefers(['ko-KR']);
    const first = render(
      <GuestLocaleProvider>
        <GuestLanguageSwitcher />
        <Probe />
      </GuestLocaleProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'English' }));
    expect(screen.getByTestId('probe').textContent).toBe(guestT('en', 'guest.search.action'));
    first.unmount();

    // Reload: a brand-new mount, same browser (still Korean-first), same storage.
    render(
      <GuestLocaleProvider>
        <Probe />
      </GuestLocaleProvider>,
    );
    expect((await screen.findByTestId('probe')).textContent).toBe(guestT('en', 'guest.search.action'));
  });

  it('the same holds in the other direction (English browser, Korean choice)', async () => {
    browserPrefers(['en-US']);
    const first = render(
      <GuestLocaleProvider>
        <GuestLanguageSwitcher />
        <Probe />
      </GuestLocaleProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: '한국어' }));
    first.unmount();
    render(
      <GuestLocaleProvider>
        <Probe />
      </GuestLocaleProvider>,
    );
    expect((await screen.findByTestId('probe')).textContent).toBe(guestT('ko', 'guest.search.action'));
  });

  it('persists to browser storage ONLY — localStorage plus a first-paint cookie mirror', () => {
    render(
      <GuestLocaleProvider>
        <GuestLanguageSwitcher />
      </GuestLocaleProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: '한국어' }));
    expect(window.localStorage.getItem(GUEST_LOCALE_STORAGE_KEY)).toBe('ko');
    expect(document.cookie).toContain(`${GUEST_LOCALE_COOKIE}=ko`);
  });

  it('never posts the choice to the server', () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    render(
      <GuestLocaleProvider>
        <GuestLanguageSwitcher />
      </GuestLocaleProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: '한국어' }));
    fireEvent.click(screen.getByRole('button', { name: 'English' }));
    // A Guest's language is not room, host, or account state.
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('survives storage being unavailable (private mode) without throwing', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    expect(() => {
      render(
        <GuestLocaleProvider>
          <GuestLanguageSwitcher />
          <Probe />
        </GuestLocaleProvider>,
      );
      fireEvent.click(screen.getByRole('button', { name: '한국어' }));
    }).not.toThrow();
    expect(screen.getByTestId('probe').textContent).toBe(guestT('ko', 'guest.search.action'));
    setItem.mockRestore();
  });

  it('sets <html lang> so screen readers and browser translation agree', async () => {
    browserPrefers(['ko-KR']);
    render(
      <GuestLocaleProvider>
        <GuestLanguageSwitcher />
      </GuestLocaleProvider>,
    );
    await screen.findByRole('button', { name: '한국어' });
    expect(document.documentElement.lang).toBe('ko');
    fireEvent.click(screen.getByRole('button', { name: 'English' }));
    expect(document.documentElement.lang).toBe('en');
  });
});

describe('(12) critical Guest flows render in BOTH languages', () => {
  const renderIn = (locale: GuestLocale, ui: React.ReactElement) => {
    window.localStorage.setItem(GUEST_LOCALE_STORAGE_KEY, locale);
    return render(<GuestLocaleProvider initialLocale={locale}>{ui}</GuestLocaleProvider>);
  };

  it('the legal footer is localized on the Guest surface', () => {
    for (const locale of ['en', 'ko'] as const) {
      cleanup();
      const { container } = renderIn(locale, <GuestLegalLinks showContact />);
      expect(container.querySelector('a[href="/privacy"]')?.textContent).toBe(
        guestT(locale, 'guest.legal.privacy'),
      );
      expect(container.querySelector('a[href="/terms"]')?.textContent).toBe(
        guestT(locale, 'guest.legal.terms'),
      );
    }
  });

  it('the queue board renders its primary labels in each language', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          playing: { id: 'p1', title: 'Song', guestName: 'Alex', videoKind: null },
          waiting: [{ id: 'w1', title: 'Next', guestName: 'Sam', videoKind: null }],
          waitingCount: 1,
        }),
      })),
    );
    for (const locale of ['en', 'ko'] as const) {
      cleanup();
      const { container } = renderIn(locale, <QueueBoard slug="joy" eventId="e1" pollMs={100000} />);
      const board = await screen.findByLabelText(guestT(locale, 'guest.queue.a11y'));
      expect(within(board).getByText(guestT(locale, 'guest.queue.up_next'))).toBeTruthy();
      // The pluralized count reads correctly for exactly one waiting song.
      expect(container.textContent).toContain(guestT(locale, 'guest.queue.count', { count: 1 }));
    }
  });

  it('English and Korean actually differ across every primary Guest action', () => {
    const PRIMARY = [
      'guest.request.cta',
      'guest.search.action',
      'guest.stage.ready_action',
      'guest.dock.cancel_request',
      'guest.dock.request_again',
      'guest.queue.now_singing',
      'guest.consent.agree',
      'guest.legal.privacy',
    ] as const;
    for (const key of PRIMARY) {
      const en = guestT('en', key);
      const ko = guestT('ko', key);
      expect(en, key).toBeTruthy();
      expect(ko, key).toBeTruthy();
      expect(en, key).not.toBe(ko);
    }
  });
});

// ── (14) responsive contract ────────────────────────────────────────────────────────────
//
// jsdom has no layout engine, so real pixel wrapping at 320/375/390/430 belongs to the
// browser gates. What IS verifiable here is that the shipped stylesheet does not solve
// English width by shrinking text or by hiding the control — the two regressions that would
// make the switcher unusable on a narrow phone.
describe('(14) narrow-phone layout rules for the Guest language control', () => {
  const css = readFileSync('src/app/globals.css', 'utf8');
  const block = css.slice(css.indexOf('.guest-lang'), css.indexOf('/* ── Structural type'));

  it('the brand row wraps instead of squeezing the wordmark or the switcher', () => {
    const brandHead = css.slice(css.indexOf('.brand-head {'), css.indexOf('.brand-tag {'));
    expect(brandHead).toContain('flex-wrap: wrap');
  });

  it('the switcher keeps a real 44px touch target', () => {
    expect(block).toContain('min-height: 44px');
  });

  it('it never shrinks its own labels to fit', () => {
    expect(block).not.toMatch(/font-size:\s*0\.[0-5]\d*rem/);
    expect(block).not.toContain('transform: scale');
    expect(block).not.toContain('zoom:');
  });

  it('it is never hidden at any width', () => {
    expect(block).not.toMatch(/display:\s*none/);
    expect(block).not.toMatch(/visibility:\s*hidden/);
    const narrow = css.slice(css.indexOf('@media (max-width: 360px)'));
    expect(narrow.slice(0, 400)).not.toMatch(/\.guest-lang[^{]*\{[^}]*display:\s*none/);
  });

  it('its labels never wrap mid-word into an unreadable stack', () => {
    expect(block).toContain('white-space: nowrap');
  });

  it('is reachable by keyboard with a visible focus ring', () => {
    expect(block).toContain(':focus-visible');
  });

  it('the Guest headline and body text WRAP instead of spilling at 320px', () => {
    // Measured in Chromium and WebKit at 320/375/390/430: without this, WebKit let the
    // longest Guest headline overflow its flex column rather than wrap. `keep-all` is the
    // correct Korean rule (never split a word mid-token); `anywhere` is the narrow-phone
    // escape hatch. English is the wider language here, so it needs both too.
    const perfTitle = css.slice(css.indexOf('.perf-title {'), css.indexOf('.perf-title.big'));
    expect(perfTitle).toContain('word-break: keep-all');
    expect(perfTitle).toContain('overflow-wrap: anywhere');
  });

  it('English width is never solved by shrinking Guest text', () => {
    // The whole stylesheet: no Guest rule may reach for a scale/zoom hack.
    const guestBlock = css.slice(css.indexOf('/* BUILD 26G'), css.indexOf('/* ── Structural type'));
    expect(guestBlock).not.toContain('transform: scale');
    expect(guestBlock).not.toContain('zoom:');
  });
});
