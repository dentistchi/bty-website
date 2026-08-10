// @vitest-environment jsdom
//
// BUILD 26J-R2 — the public Support page.
//
// App Store Connect REQUIRES a Support URL. BUILD 26J's audit found `/support` returning
// 404, with the only support channel an email address buried mid-way through the privacy
// policy. These tests exist so that gap cannot silently reopen: each one fails on a
// specific way the page could stop being a usable support surface.
//
// The 404 case is covered structurally — the route file must exist and the component must
// render without any room/event/auth context. A page that throws, or that Next cannot
// resolve as a route, is indistinguishable from a 404 to a customer and to a reviewer.

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import SupportPage from './page';
import LegalLinks from '@/components/legal/LegalLinks';
import { CONTACT_EMAIL, APP_NAME, PRODUCT_NAME, SUPPORT_RESPONSE_TARGET, LEGAL_LINKS } from '@/lib/legal';

afterEach(cleanup);

describe('/support — reachable', () => {
  it('the route file exists, so the URL cannot 404', () => {
    expect(existsSync(join(process.cwd(), 'src/app/support/page.tsx'))).toBe(true);
    expect(LEGAL_LINKS.support).toBe('/support');
  });

  it('renders with no room, event, session or auth context', () => {
    // A customer who needs support often CANNOT sign in. If this page ever required a
    // session it would be useless exactly when it is needed.
    const { container } = render(<SupportPage />);
    expect(screen.getByRole('heading', { level: 1, name: 'Support' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1, name: '고객지원' })).toBeTruthy();
    expect((container.textContent ?? '').length).toBeGreaterThan(400);
  });

  it('is linked from the shared public footer, in both places it is rendered', () => {
    const { container } = render(<LegalLinks />);
    expect(container.querySelector('a[href="/support"]')).toBeTruthy();
  });
});

describe('/support — contact information', () => {
  it('publishes a real, actionable contact address in BOTH languages', () => {
    const { container } = render(<SupportPage />);
    const text = container.textContent ?? '';
    // Present as text…
    const occurrences = text.split(CONTACT_EMAIL).length - 1;
    expect(occurrences).toBeGreaterThanOrEqual(2); // EN + KO sections
    // …and actionable as a mailto link, not merely printed.
    const mailtos = container.querySelectorAll(`a[href="mailto:${CONTACT_EMAIL}"]`);
    expect(mailtos.length).toBeGreaterThanOrEqual(2);
  });

  it('states a reply-time commitment rather than promising nothing', () => {
    const { container } = render(<SupportPage />);
    expect(container.textContent ?? '').toContain(SUPPORT_RESPONSE_TARGET);
  });

  it('tells users how to delete their account, and links the retention detail', () => {
    // The most common App Review support question, and the one BUILD 26E/26I made true.
    const { container } = render(<SupportPage />);
    const text = container.textContent ?? '';
    expect(text).toMatch(/Delete Account/);
    expect(text).toMatch(/계정 삭제/);
    expect(text).toMatch(/section 12a of our Privacy Policy/);
    expect(text).toMatch(/개인정보처리방침 12a항/);
    expect(container.querySelector('a[href="/privacy#en"]')).toBeTruthy();
    expect(container.querySelector('a[href="/privacy#ko"]')).toBeTruthy();
  });

  it('keeps privacy and terms reachable from the support page itself', () => {
    const { container } = render(<SupportPage />);
    expect(container.querySelector('a[href="/privacy"]')).toBeTruthy();
    expect(container.querySelector('a[href="/terms"]')).toBeTruthy();
  });
});

describe('/support — branding', () => {
  it('uses the customer-facing app name and never the retired "Admin" name', () => {
    const { container } = render(<SupportPage />);
    const text = container.textContent ?? '';
    expect(APP_NAME).toBe('BTY Norebang');
    expect(text).toContain(APP_NAME);
    // The single most visible piece of stale branding: the app used to install as
    // "BTY Norebang Admin". It must never appear on a customer-facing page.
    expect(text).not.toContain('BTY Norebang Admin');
    expect(text).not.toMatch(/Admin/);
  });

  it('names the web service too, so the two names are not mistaken for two products', () => {
    const { container } = render(<SupportPage />);
    expect(container.textContent ?? '').toContain(PRODUCT_NAME);
  });
});

describe('/support — no development leakage', () => {
  it('contains no staging, localhost or private-network references', () => {
    const { container } = render(<SupportPage />);
    const html = container.innerHTML.toLowerCase();
    for (const bad of ['localhost', '127.0.0.1', 'staging', '192.168.', ':3002', ':3001', 'ngrok', '.local']) {
      expect(html).not.toContain(bad);
    }
  });

  it('exposes no secret, key or internal identifier', () => {
    const { container } = render(<SupportPage />);
    const html = container.innerHTML;
    expect(html).not.toMatch(/360772184203/); // Google project number
    expect(html).not.toMatch(/workers\.dev/); // internal API origin
    expect(html).not.toMatch(/eyJ[A-Za-z0-9_-]{10,}/); // any JWT-shaped material
    expect(html).not.toMatch(/service_role|SUPABASE|apikey/i);
  });

  it('every external link carries the safe attributes', () => {
    const { container } = render(<SupportPage />);
    for (const a of Array.from(container.querySelectorAll('a[target="_blank"]'))) {
      expect(a.getAttribute('rel')).toBe('noopener noreferrer');
    }
  });
});
