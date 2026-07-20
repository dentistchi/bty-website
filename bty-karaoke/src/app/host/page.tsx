// Responsive Host web entry (Android-browser access). Mobile-first.
//
// Server-rendered from canonical truth: the Host session cookie resolves the
// account, and My Norebang lists ONLY Rooms reachable through
//   session -> account -> ACTIVE membership -> workspace owns Room.
// Loading this page performs pure reads and creates ZERO Events.

import { cookies } from 'next/headers';
import { authorizeHost, listHostRooms, publicAccount } from '@/lib/host-auth.server';
import { csrfTokenOrNull, CSRF_FIELD_NAME } from '@/lib/host-csrf.server';
import { googleWebConfigured } from '@/lib/google-oauth.server';
import { HOST_COOKIE } from '@/lib/host-web-session.server';
import { PRODUCT_NAME, PRODUCT_TAGLINE_KO } from '@/lib/brand';
import LegalLinks from '@/components/legal/LegalLinks';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const NOTICES: Record<string, string> = {
  google_unconfigured: 'Google 로그인이 아직 설정되지 않았습니다.',
  state_mismatch: '로그인 요청이 만료되었거나 올바르지 않습니다. 다시 시도해 주세요.',
  invalid_callback: '로그인 응답이 올바르지 않습니다. 다시 시도해 주세요.',
  expired: '로그인 요청이 만료되었습니다. 다시 시도해 주세요.',
  exchange_failed: '로그인을 완료하지 못했습니다. 다시 시도해 주세요.',
  verification_failed: '로그인을 확인하지 못했습니다. 다시 시도해 주세요.',
  cancelled: '로그인이 취소되었습니다.',
  signed_out: '로그아웃되었습니다.',
};

export default async function HostPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  const { notice } = await searchParams;
  const message = notice ? NOTICES[notice] ?? null : null;

  const token = (await cookies()).get(HOST_COOKIE)?.value ?? null;
  const account = await authorizeHost(token);        // pure read
  const googleReady = googleWebConfigured();

  // ---------------------------------------------------------------- signed out
  if (!account) {
    return (
      <main className="host-shell">
        <div className="brand-head">
          <span className="brand">{PRODUCT_NAME}</span>
          <span className="brand-tag">{PRODUCT_TAGLINE_KO}</span>
        </div>
        <div className="card hero">
          <h1>호스트로 로그인하세요</h1>
          <p className="muted">내 노래방을 관리하려면 로그인이 필요합니다.</p>

          {message && <p className="host-notice" role="status">{message}</p>}

          {googleReady ? (
            <a className="host-btn host-btn-primary" href="/host/auth/google">
              Google로 계속하기
            </a>
          ) : (
            // Honest unavailable state — never a control that looks functional.
            <div className="host-unavailable" role="status">
              <b>Google 로그인 준비 중</b>
              <span className="muted">
                아직 설정이 완료되지 않아 지금은 사용할 수 없습니다.
              </span>
            </div>
          )}
        </div>
        <LegalLinks showContact />
      </main>
    );
  }

  // ------------------------------------------------------------- authenticated
  const rooms = await listHostRooms(account.id);     // pure read, zero Events
  const me = publicAccount(account);
  // Session-bound CSRF token for every state-changing form on this page.
  const csrf = await csrfTokenOrNull(token!);   // null when the CSRF secret is unconfigured

  return (
    <main className="host-shell">
      <div className="brand-head">
        <span className="brand">{PRODUCT_NAME}</span>
        <span className="brand-tag">{PRODUCT_TAGLINE_KO}</span>
      </div>

      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1>My Norebang</h1>
        <form action="/host/logout" method="post">
          <input type="hidden" name={CSRF_FIELD_NAME} value={csrf ?? ""} />
          <button className="host-btn host-btn-ghost" type="submit">로그아웃</button>
        </form>
      </div>
      <p className="muted">{me.displayName ?? me.email ?? '로그인됨'}</p>

      {rooms.length === 0 ? (
        <div className="card hero" data-host-no-room>
          <h2>노래방을 연결하세요</h2>
          <p className="muted">
            기존 BTY Norebang을 이 계정에 한 번만 연결합니다.
          </p>
          <a className="host-btn host-btn-primary" href="/host/connect">
            내 노래방 연결하기
          </a>
        </div>
      ) : (
        rooms.map((room) => (
          <div className="card" key={room.slug} data-host-room={room.slug}>
            <h2>{room.displayName}</h2>
            {room.hasActiveEvent ? (
              <p className="muted">
                진행 중 · 대기열 {room.queueCount}곡
                {room.activeEvent?.startsAt
                  ? ` · ${new Date(room.activeEvent.startsAt).toLocaleTimeString('ko-KR', {
                      hour: 'numeric',
                      minute: '2-digit',
                    })} 시작`
                  : ''}
              </p>
            ) : (
              <p className="muted">진행 중인 노래방이 없어요</p>
            )}
            {/* Protected POST: issues the account-bound Room cookie, then redirects
                into Admin. A GET must never mutate or issue a credential. Entering
                NEVER creates an Event — starting one stays an explicit action
                inside the Admin experience. */}
            <form action={`/api/host/rooms/${encodeURIComponent(room.slug)}/admin-session`} method="post">
              <input type="hidden" name={CSRF_FIELD_NAME} value={csrf ?? ""} />
              <button className="host-btn host-btn-primary" type="submit">
                {room.hasActiveEvent ? '노래방으로 들어가기' : '새 노래방 시작'}
              </button>
            </form>
          </div>
        ))
      )}

      <LegalLinks showContact />
    </main>
  );
}
