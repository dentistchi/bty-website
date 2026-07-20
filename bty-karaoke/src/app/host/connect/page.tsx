// One-time Room connection for the web Host (Android-browser path).
// The Manager passcode is shown ONLY after authenticated Host entry, and is posted
// to the existing canonical claim endpoint. Claiming never creates an Event.

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { authorizeHost, listHostRooms } from '@/lib/host-auth.server';
import { csrfTokenFor, CSRF_FIELD_NAME } from '@/lib/host-csrf.server';
import { HOST_COOKIE } from '@/lib/host-web-session.server';
import { PRODUCT_NAME, PRODUCT_TAGLINE_KO } from '@/lib/brand';
import LegalLinks from '@/components/legal/LegalLinks';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const NOTICES: Record<string, string> = {
  bad_passcode: '비밀번호가 올바르지 않습니다.',
  already_claimed: '이 노래방은 이미 다른 계정에 연결되어 있어요.',
  failed: '연결하지 못했습니다. 다시 시도해 주세요.',
};

export default async function HostConnectPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  const { notice } = await searchParams;
  const token = (await cookies()).get(HOST_COOKIE)?.value ?? null;
  const account = await authorizeHost(token);
  if (!account) redirect('/host');                    // identity first, always
  const csrf = await csrfTokenFor(token!);

  // Already connected → nothing to do here.
  const rooms = await listHostRooms(account.id);      // pure read, zero Events
  if (rooms.length > 0) redirect('/host');

  return (
    <main className="host-shell">
      <div className="brand-head">
        <span className="brand">{PRODUCT_NAME}</span>
        <span className="brand-tag">{PRODUCT_TAGLINE_KO}</span>
      </div>
      <div className="card hero">
        <h1>노래방을 연결하세요</h1>
        <p className="muted">기존 BTY Norebang을 이 계정에 한 번만 연결합니다.</p>
        {notice && <p className="host-notice" role="status">{NOTICES[notice] ?? NOTICES.failed}</p>}

        {/* SameSite=Lax means a cross-site POST carries no session cookie, which is
            the CSRF guard for this state-changing form. */}
        <form action="/host/connect/submit" method="post" className="host-form">
          <input type="hidden" name={CSRF_FIELD_NAME} value={csrf} />
          <label htmlFor="passcode">매니저 비밀번호</label>
          <input id="passcode" name="passcode" type="password" autoComplete="current-password" required />
          <button className="host-btn host-btn-primary" type="submit">내 노래방 연결하기</button>
        </form>
      </div>
      <LegalLinks showContact />
    </main>
  );
}
