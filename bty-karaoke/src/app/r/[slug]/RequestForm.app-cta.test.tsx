// @vitest-environment jsdom
//
// BUILD 26H — the Guest-facing promise, rendered.
//
//   Scan a valid room QR → "Open in the app" is available IMMEDIATELY.
//   No name. No search. No song. No request. No network call to make it appear.
//
// These mount the REAL RequestForm, because the defect being fixed was never visible in a
// pure-function test: the CTA rendered, it was simply disabled until a request succeeded.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { screen, cleanup, within } from '@testing-library/react';
import { renderGuest } from '@/components/guest/guest-test-render';
import { roomNavIdentifier } from '@/domain/guest-handoff';
import { CANONICAL_APP_LINK_ORIGIN } from '@/domain/app-link';
import { guestT } from '@/domain/guest-messages';
import RequestForm from './RequestForm';

/** Every network call the component makes, so "no fetch to enable the CTA" is provable. */
let fetchCalls: string[] = [];

beforeEach(() => {
  fetchCalls = [];
  window.localStorage.clear();
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      fetchCalls.push(String(input));
      return { ok: true, status: 200, json: async () => ({ items: [] }) } as Response;
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const appCta = () => document.querySelector('.app-cta') as HTMLElement | null;
const appLink = () => appCta()?.querySelector('a.app-cta-action') as HTMLAnchorElement | null;
const appDisabled = () => appCta()?.querySelector('button.app-cta-action') as HTMLButtonElement | null;

describe('H1/H2/H3/H4 — the CTA is live on arrival, with nothing entered', () => {
  it('renders an ENABLED app link on first paint of a live room', () => {
    renderGuest(<RequestForm slug="bty-home" roomOpen eventId="evt-1" />, 'en');
    // Nothing has been typed, searched, selected, or submitted.
    expect((screen.getByLabelText(guestT('en', 'guest.name.label')) as HTMLInputElement).value).toBe('');
    const link = appLink();
    expect(link, 'the app CTA must be a real link, not the disabled placeholder').toBeTruthy();
    expect(appDisabled()).toBeNull();
    expect(link!.getAttribute('href')).toBe(
      `${CANONICAL_APP_LINK_ORIGIN}/app/join/${roomNavIdentifier('bty-home')}`,
    );
  });

  it('needs NO network call to become available', () => {
    renderGuest(<RequestForm slug="bty-home" roomOpen eventId="evt-1" />, 'en');
    expect(appLink()).toBeTruthy();
    // The link is derived from the slug this page already has — nothing is minted.
    expect(fetchCalls.filter((u) => u.includes('guest-app-handoffs'))).toEqual([]);
  });

  it('H5 — carries the correct room, and only the room', () => {
    renderGuest(<RequestForm slug="chi-norebang-xqjbyszq" roomOpen eventId="evt-9" />, 'en');
    const href = appLink()!.getAttribute('href')!;
    expect(href).toContain('rnav1-chi-norebang-xqjbyszq');
    // No guest, song, request, event, or locale rides along in the URL.
    for (const forbidden of ['guest', 'name=', 'song', 'video', 'request', 'evt-9', 'locale', 'lang']) {
      expect(href, forbidden).not.toContain(forbidden);
    }
  });
});

describe('H8/H11 — no current live event means no room-nav CTA', () => {
  it('falls back to the informational (disabled) state when no event is live', () => {
    renderGuest(<RequestForm slug="bty-home" roomOpen eventId={null} />, 'en');
    expect(appLink()).toBeNull();
    expect(appDisabled(), 'must stay the honest informational state').toBeTruthy();
    expect(appDisabled()!.disabled).toBe(true);
  });
});

describe('H20/H21 — both languages get the same capability', () => {
  for (const locale of ['en', 'ko'] as const) {
    it(`${locale} Guest gets an identical, enabled app link`, () => {
      cleanup();
      renderGuest(<RequestForm slug="bty-home" roomOpen eventId="evt-1" />, locale);
      const link = appLink();
      expect(link).toBeTruthy();
      // H22 — the URL is byte-identical across languages: Web locale is NOT handoff authority.
      expect(link!.getAttribute('href')).toBe(
        `${CANONICAL_APP_LINK_ORIGIN}/app/join/${roomNavIdentifier('bty-home')}`,
      );
    });
  }

  it('H22 — the two languages differ in COPY but never in the link', () => {
    renderGuest(<RequestForm slug="bty-home" roomOpen eventId="evt-1" />, 'en');
    const enHref = appLink()!.getAttribute('href');
    const enLabel = appLink()!.textContent;
    cleanup();
    renderGuest(<RequestForm slug="bty-home" roomOpen eventId="evt-1" />, 'ko');
    const koHref = appLink()!.getAttribute('href');
    const koLabel = appLink()!.textContent;
    expect(koHref).toBe(enHref);
    expect(koLabel).not.toBe(enLabel); // localized, per BUILD 26G
  });
});

describe('H27 — the CTA keeps valid accessibility semantics', () => {
  it('is a labelled region with a real link and supporting text', () => {
    renderGuest(<RequestForm slug="bty-home" roomOpen eventId="evt-1" />, 'en');
    const region = screen.getByRole('region', { name: guestT('en', 'guest.app_entry.label') });
    expect(region).toBeTruthy();
    expect(within(region).getByRole('link')).toBeTruthy();
    expect(region.textContent).toContain(guestT('en', 'guest.app_entry.supporting'));
  });

  it('the Korean region label is the Korean one', () => {
    renderGuest(<RequestForm slug="bty-home" roomOpen eventId="evt-1" />, 'ko');
    expect(screen.getByRole('region', { name: guestT('ko', 'guest.app_entry.label') })).toBeTruthy();
  });
});

describe('H18/H19/H30 — Continue on Web is untouched', () => {
  it('the full request surface still renders alongside the app CTA', () => {
    renderGuest(<RequestForm slug="bty-home" roomOpen eventId="evt-1" />, 'en');
    // Name, search, and the search action are all present and usable.
    expect(screen.getByLabelText(guestT('en', 'guest.name.label'))).toBeTruthy();
    expect(screen.getByLabelText(guestT('en', 'guest.search.prompt'))).toBeTruthy();
    expect(screen.getByRole('button', { name: guestT('en', 'guest.search.action') })).toBeTruthy();
  });

  it('H30 — the app CTA never blocks or overlays the web flow', () => {
    renderGuest(<RequestForm slug="bty-home" roomOpen eventId="evt-1" />, 'en');
    const cta = appCta()!;
    // It is a normal in-flow region, not a modal/dialog that could trap a Guest without the app.
    expect(cta.getAttribute('role')).toBe('region');
    expect(cta.closest('[role="dialog"]')).toBeNull();
    expect(cta.closest('[aria-modal="true"]')).toBeNull();
  });
});

describe('H16 — the request-backed link still wins when one exists', () => {
  it('a stored Universal Link from a real handoff takes precedence over room navigation', () => {
    // BUILD 19C persists the minted link per room+event; that path must not regress.
    const realLink = `${CANONICAL_APP_LINK_ORIGIN}/app/join/${'Z'.repeat(32)}`;
    window.localStorage.setItem(
      'bty:appurl:bty-home:evt-1',
      JSON.stringify({ url: realLink, handoffId: 'real-id' }),
    );
    renderGuest(<RequestForm slug="bty-home" roomOpen eventId="evt-1" />, 'en');
    expect(appLink()!.getAttribute('href')).toBe(realLink);
  });
});
