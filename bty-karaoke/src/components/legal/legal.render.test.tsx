// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import PrivacyPage from '@/app/privacy/page';
import TermsPage from '@/app/terms/page';
import Home from '@/app/page';
import LegalLinks from './LegalLinks';
import GuestConsentGate from './GuestConsentGate';
import { CONSENT_STORAGE_KEY, LEGAL_VERSION, CONTACT_EMAIL } from '@/lib/legal';

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe('Privacy page — public, bilingual, YouTube + retention + contact', () => {
  it('renders without any room/event/auth context, both languages', () => {
    const { container } = render(<PrivacyPage />);
    expect(screen.getByRole('heading', { level: 1, name: 'Privacy Policy' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1, name: '개인정보처리방침' })).toBeTruthy();
    const text = container.textContent ?? '';
    expect(text).toMatch(/YouTube API Services/); // states BTY uses YouTube API Services
    expect(text).toMatch(/does not use Google OAuth|Google 로그인 없음/);
    expect(text).toMatch(/Retention|보관/);
    expect(text).toMatch(/deletion|삭제/);
    expect(text).toContain(CONTACT_EMAIL); // real contact
  });

  it('links to Google Privacy Policy, YouTube Terms, and BTY Terms — with safe attrs', () => {
    const { container } = render(<PrivacyPage />);
    const gp = container.querySelector('a[href="https://policies.google.com/privacy"]');
    const yt = container.querySelector('a[href="https://www.youtube.com/t/terms"]');
    expect(gp).toBeTruthy();
    expect(yt).toBeTruthy();
    expect(gp?.getAttribute('rel')).toBe('noopener noreferrer');
    expect(gp?.getAttribute('target')).toBe('_blank');
    expect(container.querySelector('a[href="/terms"]')).toBeTruthy();
  });

  it('never exposes secrets', () => {
    const { container } = render(<PrivacyPage />);
    const html = container.innerHTML;
    expect(html).not.toMatch(/AIza/);
    expect(html).not.toMatch(/360772184203/);
  });
});

describe('Terms page — YouTube Terms subjection + link back to Privacy', () => {
  it('states YouTube-powered use is subject to YouTube Terms, links to Privacy', () => {
    const { container } = render(<TermsPage />);
    expect(screen.getByRole('heading', { level: 1, name: 'Terms of Service' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1, name: '이용약관' })).toBeTruthy();
    const text = container.textContent ?? '';
    expect(text).toMatch(/also subject to the\s+YouTube Terms of Service/);
    expect(container.querySelector('a[href="https://www.youtube.com/t/terms"]')).toBeTruthy();
    expect(container.querySelector('a[href="/privacy"]')).toBeTruthy();
  });
});

describe('public links', () => {
  it('LegalLinks renders 개인정보처리방침 + 이용약관 to the exact routes', () => {
    const { container } = render(<LegalLinks />);
    expect(container.querySelector('a[href="/privacy"]')?.textContent).toBe('개인정보처리방침');
    expect(container.querySelector('a[href="/terms"]')?.textContent).toBe('이용약관');
  });
  it('the public home page renders the legal links', () => {
    const { container } = render(<Home />);
    expect(container.querySelector('a[href="/privacy"]')).toBeTruthy();
    expect(container.querySelector('a[href="/terms"]')).toBeTruthy();
  });
});

describe('guest first-use consent', () => {
  const CHILD = 'SEARCH_AND_REQUEST_FLOW';

  it('checkbox unchecked; cannot continue into the flow before consent', async () => {
    render(
      <GuestConsentGate>
        <div>{CHILD}</div>
      </GuestConsentGate>,
    );
    const box = (await screen.findByRole('checkbox')) as HTMLInputElement;
    expect(box.checked).toBe(false);
    const cont = screen.getByRole('button', { name: /Agree/ }) as HTMLButtonElement;
    expect(cont.disabled).toBe(true);
    expect(screen.queryByText(CHILD)).toBeNull(); // flow is gated
    // The consent statement links to Privacy, Terms, and YouTube Terms (focusable).
    expect(screen.getAllByRole('link', { name: /개인정보처리방침|Privacy Policy/ }).length).toBeGreaterThan(0);
  });

  it('checking then continuing enables the flow and stores the version', async () => {
    render(
      <GuestConsentGate>
        <div>{CHILD}</div>
      </GuestConsentGate>,
    );
    fireEvent.click(await screen.findByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: /Agree/ }));
    await waitFor(() => expect(screen.getByText(CHILD)).toBeTruthy());
    expect(window.localStorage.getItem(CONSENT_STORAGE_KEY)).toBe(LEGAL_VERSION);
  });

  it('accepted current version persists across reload (no re-prompt)', async () => {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, LEGAL_VERSION);
    render(
      <GuestConsentGate>
        <div>{CHILD}</div>
      </GuestConsentGate>,
    );
    await waitFor(() => expect(screen.getByText(CHILD)).toBeTruthy());
    expect(screen.queryByRole('checkbox')).toBeNull();
  });

  it('an OLD stored version re-prompts (material change)', async () => {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, '2000-01-01');
    render(
      <GuestConsentGate>
        <div>{CHILD}</div>
      </GuestConsentGate>,
    );
    expect(await screen.findByRole('checkbox')).toBeTruthy();
    expect(screen.queryByText(CHILD)).toBeNull();
  });

  it('the consent UI exposes no tokens/credentials', async () => {
    const { container } = render(
      <GuestConsentGate>
        <div>{CHILD}</div>
      </GuestConsentGate>,
    );
    await screen.findByRole('checkbox');
    const html = container.innerHTML;
    expect(html).not.toMatch(/AIza|360772184203|passcode|deviceToken|Bearer/i);
  });
});
