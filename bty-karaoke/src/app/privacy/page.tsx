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
  title: `Privacy Policy · 개인정보처리방침 — ${PRODUCT_NAME}`,
  description: `Privacy Policy for ${PRODUCT_NAME}, a private-event karaoke web app that uses YouTube API Services for public video search and playback handoff.`,
};

export default function PrivacyPage() {
  return (
    <main className="legal">
      <nav className="legal-lang" aria-label="Language">
        <a href="#en">English</a>
        <span aria-hidden>·</span>
        <a href="#ko">한국어</a>
      </nav>

      {/* ── English (immediately accessible to reviewers) ───────────────────── */}
      <article id="en" lang="en">
        <h1>Privacy Policy</h1>
        <p className="legal-date">
          Effective date: {LEGAL_EFFECTIVE_DATE}. Operated by {OPERATOR_LONG} (“BTY,” “we,” “us”).
        </p>

        <h2>1. Who operates {PRODUCT_NAME}</h2>
        <p>
          {PRODUCT_NAME} is a private-event karaoke web application operated by {OPERATOR_LONG}. It
          lets guests at a hosted event search for publicly available YouTube videos and add them to
          a shared song queue. Contact: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>

        <h2>2. Scope</h2>
        <p>
          This policy covers the public {PRODUCT_NAME} web service. It does not cover YouTube, Google,
          or any third-party website you open from our service; those are governed by their own
          policies.
        </p>

        <h2>3. Information you provide</h2>
        <ul>
          <li>A display name you enter for the event (you may use a nickname).</li>
          <li>Song search terms you type.</li>
          <li>Your chosen performance style (MR / karaoke / original).</li>
          <li>The video you select, or a YouTube link/ID you paste, to add a song request.</li>
        </ul>

        <h2>4. Information created through use of the service</h2>
        <ul>
          <li>A song request record: your display name, the selected YouTube video ID, video title,
            channel name, thumbnail URL, the room and event it belongs to, a queue position, a
            “ready” signal, and start/complete/removed status and timestamps.</li>
          <li>A room- and event-scoped identifier for the request (a request ID).</li>
        </ul>
        <p>
          We do not use analytics, advertising, or third-party tracking services, and we do not sell
          personal information.
        </p>

        <h2>5. YouTube API Services data</h2>
        <p>
          {PRODUCT_NAME} uses <Ext href={LEGAL_LINKS.youtubeApiTerms}>YouTube API Services</Ext>. When
          you search, we send your search terms to the YouTube Data API on the server and receive
          public video metadata (video ID, title, channel name, thumbnail). We may store the selected
          video’s ID and related public metadata as part of your song request. We do{' '}
          <strong>not</strong> download, re-host, or modify YouTube video content; playback is handed
          off to YouTube (the video opens on YouTube). By using these features you are also agreeing
          to the <Ext href={LEGAL_LINKS.youtubeTerms}>YouTube Terms of Service</Ext>. Google’s
          handling of your data is described in the{' '}
          <Ext href={LEGAL_LINKS.googlePrivacy}>Google Privacy Policy</Ext>.
        </p>
        <p>
          <strong>No Google sign-in.</strong> {PRODUCT_NAME} does not use Google OAuth or Google
          sign-in, does not access your private Google or YouTube account, does not read your
          subscriptions/history/playlists, and never uploads, deletes, or modifies anything in a
          YouTube account. We do not collect Google passwords or credentials. You can review or manage
          which apps have access to your Google Account at any time on the{' '}
          <Ext href={LEGAL_LINKS.googlePermissions}>Google security &amp; permissions page</Ext>;
          because we request no Google authorization, {PRODUCT_NAME} does not appear there.
        </p>

        <h2>6. Browser storage and cookies</h2>
        <p>
          To track the songs you personally requested at an event, we store a small record in your
          browser’s <code>localStorage</code> (the request IDs you submitted and a capability token
          that lets only your device cancel your own request, plus your display name). This stays on
          your device, expires after about 12 hours, and is removed if you clear your browser storage.
          {PRODUCT_NAME} does not use advertising or cross-site tracking cookies.
        </p>

        <h2>7. How information is used</h2>
        <ul>
          <li>To run the shared song queue and show you your place in it.</li>
          <li>To let you (and only your device) cancel a request you submitted.</li>
          <li>To search YouTube and hand off playback of the video you chose.</li>
          <li>To let the event host manage the queue and playback order.</li>
        </ul>

        <h2>8. When information is shared</h2>
        <p>
          Your display name and song request are visible to others at the same event (the shared
          queue and the host’s controls). We share data with the processors listed below only to
          operate the service. We do not sell your data or share it for advertising.
        </p>

        <h2>9. Third-party services and processors</h2>
        <ul>
          <li><strong>Google / YouTube (YouTube Data API v3):</strong> server-side video search and
            public metadata; playback handoff to YouTube.</li>
          <li><strong>Cloudflare:</strong> hosting (Cloudflare Workers) and a short-lived search cache
            (Cloudflare KV).</li>
          <li><strong>Supabase:</strong> the managed PostgreSQL database that stores rooms, events, and
            song requests.</li>
        </ul>
        <p>Cloudflare processes standard network request metadata (such as IP address) to deliver and
          protect the service, as is inherent to any website.</p>

        <h2>10. YouTube and Google policies</h2>
        <p>
          Your use of YouTube-powered features is subject to the{' '}
          <Ext href={LEGAL_LINKS.youtubeTerms}>YouTube Terms of Service</Ext> and the{' '}
          <Ext href={LEGAL_LINKS.googlePrivacy}>Google Privacy Policy</Ext>. See also the{' '}
          <a href={LEGAL_LINKS.terms}>{PRODUCT_NAME} Terms of Service</a>.
        </p>

        <h2>11. Retention and deletion</h2>
        <ul>
          <li><strong>Cached YouTube search results</strong> (Cloudflare KV) are kept for at most{' '}
            <strong>1 hour</strong> and then automatically expire and refresh — well within the
            maximum period permitted by YouTube API policy.</li>
          <li><strong>Song request records</strong> (in the database) remain for the event as its
            history; a host may remove or cancel requests, which drops them from the active queue.</li>
          <li><strong>Browser storage</strong> (your request IDs / display name) expires after about
            12 hours and is removed when you clear site data.</li>
          <li>We keep no advertising or analytics profiles.</li>
        </ul>

        <h2>12. Your choices and deletion requests</h2>
        <p>
          You may use a nickname rather than your real name. You can cancel a request you submitted
          from the device that created it, and you can clear your browser storage at any time. To
          request deletion of your display name and song request records, email{' '}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> with enough detail to identify the
          event and request; we will honor reasonable deletion requests manually.
        </p>

        <h2>12a. Host account deletion</h2>
        <p>
          If you sign in as a host with Apple or Google, you can permanently delete your account
          from inside the app at any time (Account &rarr; Delete Account). It is available whether
          or not you have created a norebang. Deletion is immediate and cannot be undone.
        </p>
        <p>What is removed:</p>
        <ul>
          <li>Your email address, display name and time zone are erased from your account record.</li>
          <li>Your Apple and Google sign-in links are deleted, so neither can open the account again.</li>
          <li>All of your sign-in sessions are revoked, and every device, pairing code and
            room-management credential belonging to your norebangs is revoked.</li>
          <li>Your Apple and Google authorizations are withdrawn. If Apple cannot complete the
            withdrawal, the app tells you how to finish it in iOS Settings.</li>
          <li>Saved songs and uploaded norebang logos are deleted. Logo files are removed from
            storage shortly after deletion — normally within 24 hours and at most within 30 days.</li>
        </ul>
        <p>What is kept, and why:</p>
        <ul>
          <li><strong>Your account record is kept as a non-identifying marker</strong> rather than
            being erased outright, so the records below stay linked to something and are not
            silently orphaned. It contains no email, name or sign-in identifier and can no longer
            be signed into.</li>
          <li><strong>Norebangs and events</strong> are retired rather than deleted. Their names are
            replaced with a neutral label, and the web address stays reserved so an old QR code can
            never lead to someone else&rsquo;s norebang.</li>
          <li><strong>Song request and playback history</strong> is kept with display names removed,
            so guests&rsquo; own records of an event remain accurate.</li>
          <li><strong>Free-time usage and pass records</strong> are kept for accounting and to stop
            the daily free allowance being reset by deleting and re-creating an account.</li>
          <li><strong>A one-way fingerprint of your sign-in identifier</strong> is kept for the same
            reason. It cannot be reversed to reveal your Apple or Google identity, is never shared,
            and is used only to recognise a repeat deletion.</li>
          <li><strong>An opaque reference</strong> is kept so any future purchase or refund can be
            honoured. It carries no email or sign-in identity.</li>
          <li><strong>Minimal sign-out records</strong> are kept for up to 90 days to investigate
            abuse, then deleted. The record that a deletion happened is kept permanently and
            contains no personal information.</li>
        </ul>

        <h2>13. Security</h2>
        <p>
          Access to YouTube uses a server-side API key that is never exposed to your browser.
          Administrative access is protected by hashed credentials and short-lived tokens. Data is
          transmitted over HTTPS. No method of storage or transmission is perfectly secure, but we
          take reasonable measures appropriate to a small private-event service.
        </p>

        <h2>14. Children</h2>
        <p>
          {PRODUCT_NAME} is intended for use at hosted events by a general audience and is not directed
          to children. Please do not submit a child’s personal information beyond a display name.
        </p>

        <h2>15. Changes to this policy</h2>
        <p>
          We may update this policy; the effective date above will change and, when the update is
          material, guests will be asked to accept the current version again before using the search
          and request features.
        </p>

        <h2>16. Contact</h2>
        <p>
          Questions or requests: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> ({OPERATOR_LONG}).
        </p>
      </article>

      <hr className="legal-sep" />

      {/* ── 한국어 ───────────────────────────────────────────────────────────── */}
      <article id="ko" lang="ko">
        <h1>개인정보처리방침</h1>
        <p className="legal-date">
          시행일: {LEGAL_EFFECTIVE_DATE}. 운영: {OPERATOR_LONG}(이하 “BTY”).
        </p>

        <h2>1. 운영 주체</h2>
        <p>
          {PRODUCT_NAME}은(는) {OPERATOR_LONG}이(가) 운영하는 프라이빗 행사용 노래방 웹 서비스입니다.
          행사 참가자는 공개된 YouTube 영상을 검색해 공용 대기열에 신청할 수 있습니다. 문의:{' '}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>

        <h2>2. 적용 범위</h2>
        <p>
          본 방침은 공개 {PRODUCT_NAME} 웹 서비스에 적용됩니다. 서비스에서 이동하는 YouTube·Google 등
          외부 사이트에는 각 사업자의 방침이 적용됩니다.
        </p>

        <h2>3. 이용자가 제공하는 정보</h2>
        <ul>
          <li>행사에서 사용할 표시 이름(닉네임 사용 가능).</li>
          <li>입력한 노래 검색어.</li>
          <li>선택한 공연 스타일(MR / 노래방 / 원곡).</li>
          <li>신청을 위해 선택한 영상 또는 붙여넣은 YouTube 링크·ID.</li>
        </ul>

        <h2>4. 이용 과정에서 생성되는 정보</h2>
        <ul>
          <li>신청곡 기록: 표시 이름, 선택한 YouTube 영상 ID·제목·채널명·썸네일 URL, 소속 방/이벤트,
            대기 순번, 준비 신호, 시작·완료·삭제 상태 및 시각.</li>
          <li>방·이벤트 범위의 신청 식별자(요청 ID).</li>
        </ul>
        <p>분석·광고·제3자 추적 도구를 사용하지 않으며, 개인정보를 판매하지 않습니다.</p>

        <h2>5. YouTube API 서비스 데이터</h2>
        <p>
          {PRODUCT_NAME}은(는) <Ext href={LEGAL_LINKS.youtubeApiTerms}>YouTube API 서비스</Ext>를
          이용합니다. 검색 시 서버에서 YouTube Data API로 검색어를 전송하고 공개 영상 메타데이터(영상
          ID·제목·채널명·썸네일)를 받습니다. 선택한 영상의 ID와 공개 메타데이터는 신청곡의 일부로
          저장될 수 있습니다. YouTube 영상 콘텐츠를 다운로드·재호스팅·수정하지 않으며, 재생은
          YouTube로 넘겨집니다. 해당 기능 이용에는{' '}
          <Ext href={LEGAL_LINKS.youtubeTerms}>YouTube 이용약관</Ext>이 함께 적용됩니다. Google의
          데이터 처리는 <Ext href={LEGAL_LINKS.googlePrivacy}>Google 개인정보처리방침</Ext>을 따릅니다.
        </p>
        <p>
          <strong>Google 로그인 없음.</strong> {PRODUCT_NAME}은(는) Google OAuth·로그인을 사용하지
          않고, 이용자의 비공개 Google·YouTube 계정에 접근하지 않으며(구독·기록·재생목록 등 읽지 않음),
          YouTube 계정에 무엇도 업로드·삭제·수정하지 않습니다. Google 비밀번호나 자격 증명을 수집하지
          않습니다. Google 계정 접근 권한은 언제든{' '}
          <Ext href={LEGAL_LINKS.googlePermissions}>Google 보안·권한 페이지</Ext>에서 관리할 수 있으며,
          {PRODUCT_NAME}은(는) 어떤 Google 권한도 요청하지 않으므로 그 목록에 표시되지 않습니다.
        </p>

        <h2>6. 브라우저 저장소·쿠키</h2>
        <p>
          본인이 신청한 곡을 표시하기 위해 브라우저 <code>localStorage</code>에 소량의 정보(신청한 요청
          ID, 본인 기기에서만 신청을 취소할 수 있는 권한 토큰, 표시 이름)를 저장합니다. 이 정보는 기기에
          남고 약 12시간 후 만료되며, 브라우저 저장소를 지우면 삭제됩니다. 광고·교차 사이트 추적 쿠키는
          사용하지 않습니다.
        </p>

        <h2>7. 정보의 이용 목적</h2>
        <ul>
          <li>공용 대기열 운영 및 순번 표시.</li>
          <li>본인 기기에서 신청 취소.</li>
          <li>YouTube 검색 및 재생 넘김.</li>
          <li>행사 진행자의 대기열·재생 순서 관리.</li>
        </ul>

        <h2>8. 정보의 공유</h2>
        <p>
          표시 이름과 신청곡은 같은 행사의 다른 참가자(공용 대기열·진행자 화면)에게 보입니다. 아래
          수탁 처리자에게는 서비스 운영을 위해서만 데이터가 전달됩니다. 데이터를 판매하거나 광고 목적으로
          제공하지 않습니다.
        </p>

        <h2>9. 제3자 서비스·수탁 처리자</h2>
        <ul>
          <li><strong>Google / YouTube (YouTube Data API v3):</strong> 서버 측 영상 검색·공개
            메타데이터, YouTube로의 재생 넘김.</li>
          <li><strong>Cloudflare:</strong> 호스팅(Cloudflare Workers) 및 단기 검색 캐시(Cloudflare KV).</li>
          <li><strong>Supabase:</strong> 방·이벤트·신청곡을 저장하는 관리형 PostgreSQL 데이터베이스.</li>
        </ul>
        <p>Cloudflare는 서비스 제공·보호를 위해 IP 주소 등 일반적인 네트워크 요청 정보를 처리합니다.</p>

        <h2>10. YouTube·Google 정책</h2>
        <p>
          YouTube 기반 기능 이용에는 <Ext href={LEGAL_LINKS.youtubeTerms}>YouTube 이용약관</Ext>과{' '}
          <Ext href={LEGAL_LINKS.googlePrivacy}>Google 개인정보처리방침</Ext>이 적용됩니다.{' '}
          <a href={LEGAL_LINKS.terms}>{PRODUCT_NAME} 이용약관</a>도 참고하세요.
        </p>

        <h2>11. 보관·삭제</h2>
        <ul>
          <li><strong>YouTube 검색 캐시</strong>(Cloudflare KV)는 최대 <strong>1시간</strong> 보관 후
            자동 만료·갱신되며, YouTube API 정책이 허용하는 최대 기간 이내입니다.</li>
          <li><strong>신청곡 기록</strong>(데이터베이스)은 해당 이벤트의 기록으로 남고, 진행자가
            삭제·취소하면 활성 대기열에서 제거됩니다.</li>
          <li><strong>브라우저 저장 정보</strong>는 약 12시간 후 만료되며 사이트 데이터 삭제 시
            제거됩니다.</li>
          <li>광고·분석 프로파일은 보관하지 않습니다.</li>
        </ul>

        <h2>12. 이용자의 선택·삭제 요청</h2>
        <p>
          실명 대신 닉네임을 사용할 수 있습니다. 신청은 이를 만든 기기에서 취소할 수 있고, 브라우저
          저장소는 언제든 지울 수 있습니다. 표시 이름·신청곡 기록의 삭제를 원하시면 이벤트와 신청을
          식별할 수 있는 정보와 함께 <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>로
          요청해 주세요. 합리적인 삭제 요청은 수동으로 처리합니다.
        </p>

        <h2>12a. 호스트 계정 삭제</h2>
        <p>
          Apple 또는 Google로 호스트 로그인을 했다면, 앱 안에서 언제든지 계정을 완전히 삭제할 수
          있습니다(계정 &rarr; 계정 삭제). 노래방을 만들지 않은 상태에서도 사용할 수 있습니다.
          삭제는 즉시 적용되며 되돌릴 수 없습니다.
        </p>
        <p>삭제되는 것:</p>
        <ul>
          <li>계정 기록의 이메일·표시 이름·시간대가 지워집니다.</li>
          <li>Apple·Google 로그인 연결이 삭제되어, 두 방법 모두 이 계정을 다시 열 수 없습니다.</li>
          <li>모든 로그인 세션이 해지되고, 보유한 노래방의 기기·페어링 코드·운영 자격 증명이
            모두 해지됩니다.</li>
          <li>Apple·Google 인증이 철회됩니다. Apple 쪽 철회가 완료되지 못한 경우, 설정에서
            직접 해제하는 방법을 앱이 안내합니다.</li>
          <li>저장한 노래와 업로드한 노래방 로고가 삭제됩니다. 로고 파일은 삭제 직후 저장소에서
            제거되며, 보통 24시간 이내, 최대 30일 이내에 완료됩니다.</li>
        </ul>
        <p>남는 것과 그 이유:</p>
        <ul>
          <li><strong>계정 기록은 식별할 수 없는 표식으로 남습니다.</strong> 완전히 지우지 않는
            이유는 아래 기록들이 연결 대상을 잃고 방치되지 않게 하기 위해서입니다. 이메일·이름·
            로그인 식별자는 남지 않으며 더 이상 로그인할 수 없습니다.</li>
          <li><strong>노래방과 이벤트</strong>는 삭제 대신 종료 처리됩니다. 이름은 중립적인
            표시로 바뀌고, 주소는 예약된 상태로 남아 예전 QR이 다른 사람의 노래방으로 연결되는
            일이 없습니다.</li>
          <li><strong>신청곡·재생 기록</strong>은 표시 이름을 지운 상태로 남습니다. 손님이 가진
            그날의 기록이 어긋나지 않도록 하기 위해서입니다.</li>
          <li><strong>무료 이용 시간과 이용권 기록</strong>은 정산을 위해, 그리고 계정을 지웠다
            다시 만드는 방식으로 매일 무료 시간이 초기화되는 것을 막기 위해 남습니다.</li>
          <li><strong>로그인 식별자의 단방향 지문</strong>도 같은 이유로 남습니다. 되돌려서 Apple·
            Google 신원을 알아낼 수 없고, 외부에 제공하지 않으며, 반복 삭제를 알아보는 데에만
            사용합니다.</li>
          <li><strong>불투명한 참조값</strong>은 향후 결제·환불 처리를 위해 남습니다. 이메일이나
            로그인 신원은 포함하지 않습니다.</li>
          <li><strong>최소한의 로그아웃 기록</strong>은 악용 조사를 위해 최대 90일간 보관 후
            삭제합니다. 삭제가 있었다는 기록 자체는 개인정보 없이 영구 보관됩니다.</li>
        </ul>

        <h2>13. 보안</h2>
        <p>
          YouTube 접근은 브라우저에 노출되지 않는 서버 측 API 키를 사용합니다. 관리 접근은 해시된 자격
          증명과 단기 토큰으로 보호됩니다. 데이터는 HTTPS로 전송됩니다. 완벽히 안전한 방법은 없으나 소규모
          프라이빗 서비스에 적절한 합리적 조치를 취합니다.
        </p>

        <h2>14. 아동</h2>
        <p>
          {PRODUCT_NAME}은(는) 행사에서 일반 이용자를 대상으로 하며 아동을 대상으로 하지 않습니다. 표시
          이름 외 아동의 개인정보를 제출하지 마세요.
        </p>

        <h2>15. 방침 변경</h2>
        <p>
          본 방침은 변경될 수 있으며, 상단 시행일이 갱신됩니다. 중요한 변경 시 검색·신청 기능 이용 전에
          현재 버전에 대한 동의를 다시 요청합니다.
        </p>

        <h2>16. 문의</h2>
        <p>
          문의·요청: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> ({OPERATOR_LONG}).
        </p>
      </article>

      <LegalLinks showContact />
    </main>
  );
}
