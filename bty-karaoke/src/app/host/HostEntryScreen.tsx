// The single-URL browser Host entry, rendered at the canonical site root `/`.
//
// Server-rendered from canonical truth: the Host session cookie resolves the
// account, and rooms come ONLY from session → account → ACTIVE membership →
// workspace owns Room. The branch is chosen by the pure resolveHostEntry():
//
//   signed out        → Google login entry
//   exactly one room  → auto-enter via the account-bound admin-session bridge
//   two or more rooms → My Norebang chooser (explicit selection)
//   zero rooms        → honest empty state (connect a room; never auto-create)
//
// Loading this screen performs pure reads and creates ZERO Events. Auto-enter is a
// redirect to the GET bridge — it never mints a Room cookie here and never uses
// Manager authentication.

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { authorizeHost, listHostRooms, publicAccount } from '@/lib/host-auth.server';
import { csrfTokenOrNull, CSRF_FIELD_NAME } from '@/lib/host-csrf.server';
import { googleWebConfigured } from '@/lib/google-oauth.server';
import { HOST_COOKIE } from '@/lib/host-web-session.server';
import { resolveHostEntry } from '@/domain/host-entry';
import { PRODUCT_NAME, PRODUCT_TAGLINE_KO } from '@/lib/brand';
import LegalLinks from '@/components/legal/LegalLinks';

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

function BrandHead() {
  return (
    <div className="brand-head">
      <span className="brand">{PRODUCT_NAME}</span>
      <span className="brand-tag">{PRODUCT_TAGLINE_KO}</span>
    </div>
  );
}

export default async function HostEntryScreen({ notice }: { notice?: string }) {
  const message = notice ? NOTICES[notice] ?? null : null;

  const token = (await cookies()).get(HOST_COOKIE)?.value ?? null;
  const account = await authorizeHost(token);        // pure read
  const rooms = account ? await listHostRooms(account.id) : [];   // pure read, zero Events

  const decision = resolveHostEntry({
    authenticated: account != null,
    roomSlugs: rooms.map((r) => r.slug),
  });

  // ---------------------------------------------------------------- signed out
  if (decision.kind === 'signed_out') {
    const googleReady = googleWebConfigured();
    return (
      <main className="host-shell">
        <BrandHead />
        <div className="card hero">
          <h1>호스트로 로그인하세요</h1>
          <p className="muted">내 노래방을 관리하려면 로그인이 필요합니다.</p>

          {message && <p className="host-notice" role="status">{message}</p>}

          {googleReady ? (
            <a className="host-btn host-btn-primary" href="/host/auth/google">
              Google로 계속하기
            </a>
          ) : (
            <div className="host-unavailable" role="status">
              <b>Google 로그인 준비 중</b>
              <span className="muted">아직 설정이 완료되지 않아 지금은 사용할 수 없습니다.</span>
            </div>
          )}
        </div>
        <LegalLinks showContact />
      </main>
    );
  }

  // -------------------------------------------------- single room → auto-enter
  // Hand off to the existing account-bound admin-session bridge. No Room cookie is
  // minted here, no Manager auth, no Event mutation — the bridge derives everything
  // server-side from the Host session.
  if (decision.kind === 'auto_enter') {
    redirect(`/host/rooms/${encodeURIComponent(decision.slug)}/enter`);
  }

  // ------------------------------------------------------------- authenticated
  const me = publicAccount(account!);
  const csrf = await csrfTokenOrNull(token!);   // null when the CSRF secret is unconfigured

  return (
    <main className="host-shell">
      <BrandHead />

      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1>My Norebang</h1>
        <form action="/host/logout" method="post">
          <input type="hidden" name={CSRF_FIELD_NAME} value={csrf ?? ''} />
          <button className="host-btn host-btn-ghost" type="submit">로그아웃</button>
        </form>
      </div>
      <p className="muted">{me.displayName ?? me.email ?? '로그인됨'}</p>

      {decision.kind === 'empty' ? (
        <div className="card hero" data-host-no-room>
          <h2>노래방을 연결하세요</h2>
          <p className="muted">기존 BTY Norebang을 이 계정에 한 번만 연결합니다.</p>
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
            {/* Explicit selection (2+ rooms): protected POST issues the account-bound
                Room cookie, then redirects into Admin. Entering never creates an Event. */}
            <form action={`/api/host/rooms/${encodeURIComponent(room.slug)}/admin-session`} method="post">
              <input type="hidden" name={CSRF_FIELD_NAME} value={csrf ?? ''} />
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
