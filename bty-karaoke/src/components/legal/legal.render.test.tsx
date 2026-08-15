// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import PrivacyPage from '@/app/privacy/page';
import TermsPage from '@/app/terms/page';
import LegalLinks from './LegalLinks';
import GuestConsentGate from './GuestConsentGate';
import { CONSENT_STORAGE_KEY, LEGAL_VERSION, CONTACT_EMAIL } from '@/lib/legal';

// The root entry reads the Host cookie; with none present it renders the signed-out
// Host login screen, which still carries the public legal links.
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined }) }));
import HostEntryScreen from '@/app/host/HostEntryScreen';

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
    expect(text).toMatch(/Retention|보관/);
    expect(text).toMatch(/deletion|삭제/);
    expect(text).toContain(CONTACT_EMAIL); // real contact
  });

  // BUILD 26J. This test used to assert `/does not use Google OAuth|Google 로그인 없음/`,
  // pinning a claim that had become FALSE: the product ships Google Sign-In on both web
  // (/host/auth/google) and iOS (GoogleSignIn SDK). A test that encodes a false disclosure
  // as contract makes the disclosure harder to fix than it was to write — the same failure
  // BUILD 26E hit. What is pinned now is the distinction that is actually true and actually
  // matters to a user: we authenticate with Google, and we ask for nothing on YouTube.
  it('states Google Sign-In is authentication only, with no YouTube authorization — both languages', () => {
    const { container } = render(<PrivacyPage />);
    const text = container.textContent ?? '';

    // The false claim must never return, in either language.
    expect(text).not.toMatch(/does not use Google OAuth/);
    expect(text).not.toMatch(/Google 로그인 없음/);
    expect(text).not.toMatch(/does not appear there/);
    expect(text).not.toMatch(/어떤 Google 권한도 요청하지 않으므로/);

    // Google Sign-In is disclosed as authentication.
    expect(text).toMatch(/uses Google\s+Sign-In for authentication/);
    expect(text).toMatch(/인증을 위해\s+Google 로그인을 사용합니다/);

    // …and the YouTube boundary is stated, not implied.
    expect(text).toMatch(/not.{0,40}request authorization to access or\s+manage your YouTube account/s);
    expect(text).toMatch(/YouTube 계정에 접근하거나 이를 관리하기 위한 권한은/);

    // The connected-apps entry is explained rather than denied.
    expect(text).toMatch(/may appear among the apps connected to your\s+Google Account/);
    expect(text).toMatch(/Google 계정에 연결된 앱 목록/);
    expect(text).toMatch(/does not mean the app has access to your YouTube/);
    expect(text).toMatch(/채널 관리 권한에 접근한다는 의미가\s+아닙니다/);
  });

  // The scope sentence had to name the iOS app: BUILD 26J submits an App Store binary, and a
  // policy scoped to "the web service" is the wrong document to hand a reviewer.
  it('scopes itself to the iOS app as well as the web service — both languages', () => {
    const { container } = render(<PrivacyPage />);
    const text = container.textContent ?? '';
    expect(text).toMatch(/web service.{0,30}and the BTY Norebang iOS\s+app/s);
    expect(text).toMatch(/BTY Norebang iOS 앱/);
  });

  // BUILD 26T-R1B-R5. The App Privacy disclosure filed with Apple declares Email Address, Name,
  // User ID, Purchase History, Search History, Other User Content and Product Interaction. Before
  // this section existed, the policy's COLLECTION sections described the guest web flow only, and
  // host-account data appeared solely in §12a (deletion) — it said what is erased without ever
  // saying what is collected. Pinning §4a keeps the two documents from drifting apart again.
  it('discloses host-account collection, not only host-account deletion — both languages', () => {
    const { container } = render(<PrivacyPage />);
    const text = container.textContent ?? '';

    // Every data type the ASC disclosure names must be findable in the COLLECTION copy.
    expect(text).toMatch(/Host account information/);
    expect(text).toMatch(/호스트 계정 정보/);
    expect(text).toMatch(/Email address.{0,80}Apple or Google sign-in/s);
    expect(text).toMatch(/이메일 주소.{0,60}Apple 또는 Google 로그인/s);
    expect(text).toMatch(/Display name/);
    expect(text).toMatch(/Account identifiers/);
    expect(text).toMatch(/Time zone/);
    expect(text).toMatch(/시간대/);
    expect(text).toMatch(/Saved songs/);
    expect(text).toMatch(/Purchase and pass records/);
    expect(text).toMatch(/구매·이용권 기록/);

    // Payment data is measured as NEVER reaching us — Apple handles it. Stated, not implied.
    expect(text).toMatch(/never receive or store your card, bank\s+or payment details/s);
    expect(text).toMatch(/결제 수단 정보는 전달받지도,\s+저장하지도 않습니다/s);

    // The anti-abuse identifier: the claim that matters is that the RAW IP is not retained.
    expect(text).toMatch(/pseudonymous anti-abuse identifier/);
    expect(text).toMatch(/IP address itself is never\s+stored in our database or logs/s);
    expect(text).toMatch(/IP 주소 자체는 데이터베이스나 로그에 저장하지 않습니다/);

    // …and it must NOT be dressed up as location, which is the misreading it invites.
    expect(text).toMatch(/not.{0,40}used to identify you, to build a\s+profile, or to determine your location/s);
    expect(text).toMatch(/It is not location data and is not derived from location services/);
    expect(text).toMatch(/위치 정보가\s+아니며/s);

    // Absences that must stay true: declaring any of these would contradict the measured app.
    expect(text).toMatch(/do not collect location, camera, microphone, photo, contact, health or advertising data/);
    expect(text).toMatch(/위치·카메라·마이크·사진·연락처·건강·광고 정보를 수집하지 않으며/);
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
  it('the public root entry (signed out) renders the legal links', async () => {
    const ui = await HostEntryScreen({ notice: undefined });
    const { container } = render(ui);
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
