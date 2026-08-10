import type { Metadata } from 'next';
import LegalLinks from '@/components/legal/LegalLinks';
import {
  OPERATOR_LONG,
  PRODUCT_NAME,
  APP_NAME,
  CONTACT_EMAIL,
  SUPPORT_RESPONSE_TARGET,
  LEGAL_LINKS,
} from '@/lib/legal';

export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: `Support · 고객지원 — ${APP_NAME}`,
  description: `How to get help with ${APP_NAME}: contact, account deletion, sign-in and norebang questions.`,
};

/**
 * Public support page (BUILD 26J-R2).
 *
 * App Store Connect REQUIRES a Support URL, and BUILD 26J's audit found `/support`
 * returning 404 — the only support channel was an email address buried in the middle of
 * the privacy policy. This is that page: public, unauthenticated, static, and reachable
 * without a session, because a customer needing help is frequently a customer who cannot
 * sign in.
 *
 * It deliberately answers the questions an App Review reviewer and a real user actually
 * arrive with — how do I reach a human, and how do I delete my account — rather than
 * being a decorative contact card.
 */
export default function SupportPage() {
  const mailto = `mailto:${CONTACT_EMAIL}`;

  return (
    <main className="legal">
      <nav className="legal-lang" aria-label="Language">
        <a href="#en">English</a>
        <span aria-hidden>·</span>
        <a href="#ko">한국어</a>
      </nav>

      {/* ── English ─────────────────────────────────────────────────────────── */}
      <article id="en" lang="en">
        <h1>Support</h1>
        <p className="legal-date">
          {APP_NAME} is operated by {OPERATOR_LONG}. The iOS app is published as {APP_NAME}; the
          web service is {PRODUCT_NAME}. They are the same service.
        </p>

        <h2>Contact us</h2>
        <p>
          Email <a href={mailto}>{CONTACT_EMAIL}</a>. This address is monitored by the operator and
          is the correct place for every question below — support, privacy, and account deletion.
          We aim to reply within {SUPPORT_RESPONSE_TARGET}.
        </p>
        <p>
          Please include the norebang name or link if your question is about a specific room, and
          tell us whether you signed in with Apple or with Google. Never send us your password — we
          never ask for it and never need it.
        </p>

        <h2>Delete your account</h2>
        <p>
          You can delete your account yourself, from inside the app, at any time — you do not need
          to contact us first:
        </p>
        <ol>
          <li>Sign in and open the account screen.</li>
          <li>Tap <strong>Delete Account</strong>.</li>
          <li>Read the consequences, re-authenticate with your sign-in provider, and confirm.</li>
        </ol>
        <p>
          Deletion is immediate and cannot be undone. Exactly what is deleted, anonymized and
          retained is described in{' '}
          <a href={`${LEGAL_LINKS.privacy}#en`}>section 12a of our Privacy Policy</a>. If you cannot
          reach the screen — for example because you can no longer sign in — email us at{' '}
          <a href={mailto}>{CONTACT_EMAIL}</a> and we will handle it for you.
        </p>

        <h2>Common questions</h2>
        <ul>
          <li>
            <strong>I can’t sign in.</strong> {APP_NAME} signs you in with Apple or Google; it never
            stores a password. If sign-in fails repeatedly, email us and say which provider you used
            and what the screen showed.
          </li>
          <li>
            <strong>Guests can’t join my norebang.</strong> Guests join by scanning the norebang’s QR
            code or opening its link. A norebang that has been closed or retired cannot be reopened.
          </li>
          <li>
            <strong>A song won’t play.</strong> Playback is handed off to YouTube. If a video is
            unavailable, region-restricted, or blocked from embedding, it cannot be played.
          </li>
          <li>
            <strong>Questions about your data.</strong> See the{' '}
            <a href={LEGAL_LINKS.privacy}>Privacy Policy</a> and the{' '}
            <a href={LEGAL_LINKS.terms}>Terms of Service</a>, or email us.
          </li>
        </ul>
      </article>

      <hr />

      {/* ── 한국어 ──────────────────────────────────────────────────────────── */}
      <article id="ko" lang="ko">
        <h1>고객지원</h1>
        <p className="legal-date">
          {APP_NAME}은(는) {OPERATOR_LONG}이(가) 운영합니다. iOS 앱은 {APP_NAME}, 웹 서비스는{' '}
          {PRODUCT_NAME}이며 동일한 서비스입니다.
        </p>

        <h2>문의</h2>
        <p>
          <a href={mailto}>{CONTACT_EMAIL}</a>로 이메일 주세요. 운영자가 직접 확인하며, 아래의 모든
          문의(지원·개인정보·계정 삭제)를 같은 주소로 보내시면 됩니다. {SUPPORT_RESPONSE_TARGET} 이내
          답변을 목표로 합니다.
        </p>
        <p>
          특정 방에 대한 문의라면 노래방 이름이나 링크를, 그리고 Apple 로그인인지 Google 로그인인지
          함께 알려주세요. 비밀번호는 절대 보내지 마세요 — 요청하지 않으며 필요하지도 않습니다.
        </p>

        <h2>계정 삭제</h2>
        <p>앱 안에서 언제든 직접 삭제할 수 있으며, 먼저 문의하실 필요는 없습니다:</p>
        <ol>
          <li>로그인 후 계정 화면을 엽니다.</li>
          <li><strong>계정 삭제</strong>를 누릅니다.</li>
          <li>안내 내용을 확인하고, 로그인 제공자로 재인증한 뒤 확정합니다.</li>
        </ol>
        <p>
          삭제는 즉시 적용되며 되돌릴 수 없습니다. 무엇이 삭제·익명화·보관되는지는{' '}
          <a href={`${LEGAL_LINKS.privacy}#ko`}>개인정보처리방침 12a항</a>에 정리되어 있습니다.
          로그인이 되지 않는 등 화면에 접근할 수 없는 경우{' '}
          <a href={mailto}>{CONTACT_EMAIL}</a>로 연락 주시면 대신 처리해 드립니다.
        </p>

        <h2>자주 묻는 질문</h2>
        <ul>
          <li>
            <strong>로그인이 되지 않습니다.</strong> {APP_NAME}은(는) Apple 또는 Google 로그인을
            사용하며 비밀번호를 저장하지 않습니다. 반복해서 실패하면 사용한 제공자와 화면에 표시된
            내용을 알려주세요.
          </li>
          <li>
            <strong>게스트가 입장하지 못합니다.</strong> 게스트는 노래방 QR을 스캔하거나 링크로
            입장합니다. 종료되었거나 폐지된 노래방은 다시 열 수 없습니다.
          </li>
          <li>
            <strong>노래가 재생되지 않습니다.</strong> 재생은 YouTube로 넘겨집니다. 영상이
            비공개·지역 제한·임베드 차단 상태라면 재생할 수 없습니다.
          </li>
          <li>
            <strong>내 데이터에 대한 문의.</strong>{' '}
            <a href={LEGAL_LINKS.privacy}>개인정보처리방침</a>과{' '}
            <a href={LEGAL_LINKS.terms}>이용약관</a>을 참고하시거나 이메일로 문의해 주세요.
          </li>
        </ul>
      </article>

      <LegalLinks showContact />
    </main>
  );
}
