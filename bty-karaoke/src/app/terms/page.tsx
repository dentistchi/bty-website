import type { Metadata } from 'next';
import Ext from '@/components/legal/Ext';
import LegalLinks from '@/components/legal/LegalLinks';
import {
  OPERATOR_LONG,
  PRODUCT_NAME,
  CONTACT_EMAIL,
  LEGAL_EFFECTIVE_DATE,
  LEGAL_LINKS,
} from '@/lib/legal';

export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: `Terms of Service · 이용약관 — ${PRODUCT_NAME}`,
  description: `Terms of Service for ${PRODUCT_NAME}, a private-event karaoke web app powered by YouTube API Services.`,
};

export default function TermsPage() {
  return (
    <main className="legal">
      <nav className="legal-lang" aria-label="Language">
        <a href="#en">English</a>
        <span aria-hidden>·</span>
        <a href="#ko">한국어</a>
      </nav>

      {/* ── English ─────────────────────────────────────────────────────────── */}
      <article id="en" lang="en">
        <h1>Terms of Service</h1>
        <p className="legal-date">
          Effective date: {LEGAL_EFFECTIVE_DATE}. Operated by {OPERATOR_LONG} (“BTY,” “we,” “us”).
        </p>

        <h2>1. Acceptance of terms</h2>
        <p>
          By using {PRODUCT_NAME} you agree to these Terms and to our{' '}
          <a href={LEGAL_LINKS.privacy}>Privacy Policy</a>. If you do not agree, do not use the
          service.
        </p>

        <h2>2. What {PRODUCT_NAME} is</h2>
        <p>
          {PRODUCT_NAME} is a private-event karaoke web application. Guests search publicly available
          YouTube videos, add them to a shared queue, and the event host manages playback. It is
          provided for casual, private-event entertainment.
        </p>

        <h2>3. Private-event and guest use</h2>
        <p>
          {PRODUCT_NAME} is intended for guests at a hosted event. You may enter a display name (a
          nickname is fine) and submit song requests for that event.
        </p>

        <h2>4. YouTube-powered search and playback</h2>
        <p>
          Search and playback are powered by <Ext href={LEGAL_LINKS.youtubeApiTerms}>YouTube API
          Services</Ext>. Videos are searched through YouTube and played on YouTube; {PRODUCT_NAME}{' '}
          does not download or re-host YouTube videos.
        </p>

        <h2>5. YouTube Terms of Service</h2>
        <p>
          Your use of YouTube-powered features is <strong>also subject to the{' '}
          <Ext href={LEGAL_LINKS.youtubeTerms}>YouTube Terms of Service</Ext></strong> and the{' '}
          <Ext href={LEGAL_LINKS.googlePrivacy}>Google Privacy Policy</Ext>. YouTube videos remain
          hosted and controlled by YouTube and their respective rights holders.
        </p>

        <h2>6. Guest names and song requests</h2>
        <p>
          You are responsible for the display name and content you submit. Requests are visible to
          others at the same event. Do not impersonate others or submit content you have no right to
          submit.
        </p>

        <h2>7. Event host and administrator responsibilities</h2>
        <p>
          Event hosts control the queue, playback order, and may remove requests or end an event.
          Hosts are responsible for running their event appropriately for their audience.
        </p>

        <h2>8. Prohibited misuse</h2>
        <ul>
          <li>Unlawful, abusive, harassing, hateful, or infringing content.</li>
          <li>Content intended to disrupt an event or other guests.</li>
          <li>Attempting to bypass security, overload the service, or misuse the YouTube API through
            the service.</li>
        </ul>

        <h2>9. Intellectual property and third-party content</h2>
        <p>
          YouTube videos and other third-party content belong to their respective owners.{' '}
          {PRODUCT_NAME} claims no ownership of that content and does not grant you any rights to it
          beyond what YouTube provides.
        </p>

        <h2>10. Availability and changes</h2>
        <p>
          The service is provided “as is” and “as available.” We may change, suspend, or discontinue
          features at any time, including because of YouTube API limits or quota.
        </p>

        <h2>11. Removal of requests or event access</h2>
        <p>
          We or an event host may remove a request or restrict access that violates these Terms, is
          disruptive, or is required by YouTube/Google policy.
        </p>

        <h2>12. Disclaimer</h2>
        <p>
          {PRODUCT_NAME} does not guarantee that any YouTube video remains available, embeddable,
          playable, accurate, or suitable for a particular performance. Search results and
          recommendations are provided for convenience without warranty.
        </p>

        <h2>13. Limitation of liability</h2>
        <p>
          To the extent permitted by applicable law, {OPERATOR_LONG} is not liable for indirect or
          incidental damages arising from use of this casual, private-event service, or for the
          availability or content of third-party services such as YouTube.
        </p>

        <h2>14. Privacy</h2>
        <p>
          Our handling of your information is described in the{' '}
          <a href={LEGAL_LINKS.privacy}>{PRODUCT_NAME} Privacy Policy</a>.
        </p>

        <h2>15. Changes to these terms</h2>
        <p>
          We may update these Terms; the effective date above will change, and material changes will
          require guests to accept again before using search and request features.
        </p>

        <h2>16. Contact</h2>
        <p>
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> ({OPERATOR_LONG}).
        </p>
      </article>

      <hr className="legal-sep" />

      {/* ── 한국어 ───────────────────────────────────────────────────────────── */}
      <article id="ko" lang="ko">
        <h1>이용약관</h1>
        <p className="legal-date">
          시행일: {LEGAL_EFFECTIVE_DATE}. 운영: {OPERATOR_LONG}(이하 “BTY”).
        </p>

        <h2>1. 약관의 동의</h2>
        <p>
          {PRODUCT_NAME}을(를) 이용하면 본 약관과 <a href={LEGAL_LINKS.privacy}>개인정보처리방침</a>에
          동의하는 것입니다. 동의하지 않으면 서비스를 이용하지 마세요.
        </p>

        <h2>2. 서비스 소개</h2>
        <p>
          {PRODUCT_NAME}은(는) 프라이빗 행사용 노래방 웹 서비스입니다. 참가자는 공개 YouTube 영상을
          검색해 공용 대기열에 신청하고, 진행자가 재생을 관리합니다. 사적 행사의 오락 목적으로
          제공됩니다.
        </p>

        <h2>3. 프라이빗 행사·게스트 이용</h2>
        <p>
          {PRODUCT_NAME}은(는) 행사 참가자를 위한 서비스입니다. 표시 이름(닉네임 가능)을 입력하고 해당
          행사에 신청곡을 제출할 수 있습니다.
        </p>

        <h2>4. YouTube 기반 검색·재생</h2>
        <p>
          검색·재생은 <Ext href={LEGAL_LINKS.youtubeApiTerms}>YouTube API 서비스</Ext>로 제공됩니다.
          영상은 YouTube에서 검색되고 YouTube에서 재생되며, {PRODUCT_NAME}은(는) 영상을
          다운로드·재호스팅하지 않습니다.
        </p>

        <h2>5. YouTube 이용약관</h2>
        <p>
          YouTube 기반 기능 이용에는 <strong><Ext href={LEGAL_LINKS.youtubeTerms}>YouTube
          이용약관</Ext>이 함께 적용</strong>되며, <Ext href={LEGAL_LINKS.googlePrivacy}>Google
          개인정보처리방침</Ext>도 적용됩니다. YouTube 영상은 YouTube 및 각 권리자가 호스팅·관리합니다.
        </p>

        <h2>6. 표시 이름·신청곡</h2>
        <p>
          제출하는 표시 이름과 콘텐츠에 대한 책임은 이용자에게 있습니다. 신청은 같은 행사의 다른
          참가자에게 보입니다. 타인을 사칭하거나 제출 권한이 없는 콘텐츠를 제출하지 마세요.
        </p>

        <h2>7. 진행자·관리자의 책임</h2>
        <p>
          진행자는 대기열·재생 순서를 관리하고 신청을 삭제하거나 이벤트를 종료할 수 있습니다. 행사를
          청중에 맞게 적절히 운영할 책임은 진행자에게 있습니다.
        </p>

        <h2>8. 금지되는 오용</h2>
        <ul>
          <li>불법·폭력적·괴롭힘·혐오·침해 콘텐츠.</li>
          <li>행사나 다른 참가자를 방해하려는 콘텐츠.</li>
          <li>보안 우회, 서비스 과부하, 서비스를 통한 YouTube API 오용 시도.</li>
        </ul>

        <h2>9. 지식재산·제3자 콘텐츠</h2>
        <p>
          YouTube 영상 등 제3자 콘텐츠는 각 소유자에게 귀속됩니다. {PRODUCT_NAME}은(는) 해당 콘텐츠에
          대한 권리를 주장하지 않으며 YouTube가 제공하는 범위를 넘는 권리를 부여하지 않습니다.
        </p>

        <h2>10. 제공·변경</h2>
        <p>
          서비스는 “있는 그대로” 제공됩니다. YouTube API 한도·쿼터 등을 이유로 기능을 변경·중단할 수
          있습니다.
        </p>

        <h2>11. 신청·접근의 제한</h2>
        <p>
          본 약관을 위반하거나 방해가 되거나 YouTube·Google 정책상 필요한 경우, 당사 또는 진행자가 신청을
          삭제하거나 접근을 제한할 수 있습니다.
        </p>

        <h2>12. 면책</h2>
        <p>
          {PRODUCT_NAME}은(는) 특정 YouTube 영상이 계속 이용 가능·임베드 가능·재생 가능·정확·특정 공연에
          적합함을 보장하지 않습니다. 검색 결과·추천은 보증 없이 편의를 위해 제공됩니다.
        </p>

        <h2>13. 책임의 제한</h2>
        <p>
          관련 법이 허용하는 범위에서, {OPERATOR_LONG}은(는) 본 사적 행사 서비스 이용으로 인한 간접·부수적
          손해나 YouTube 등 제3자 서비스의 제공·콘텐츠에 대해 책임지지 않습니다.
        </p>

        <h2>14. 개인정보</h2>
        <p>
          정보 처리는 <a href={LEGAL_LINKS.privacy}>{PRODUCT_NAME} 개인정보처리방침</a>에 따릅니다.
        </p>

        <h2>15. 약관의 변경</h2>
        <p>
          본 약관은 변경될 수 있으며 상단 시행일이 갱신됩니다. 중요한 변경 시 검색·신청 기능 이용 전에
          동의를 다시 요청합니다.
        </p>

        <h2>16. 문의</h2>
        <p>
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> ({OPERATOR_LONG}).
        </p>
      </article>

      <LegalLinks showContact />
    </main>
  );
}
