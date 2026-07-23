// The single-URL browser Host entry, rendered at the canonical site root `/`.
//
// Server-rendered from canonical truth: the Host session cookie resolves the
// account, and rooms come ONLY from session → account → ACTIVE membership →
// workspace owns Room. The branch is chosen by the pure resolveHostEntry():
//
//   signed out        → Google login entry
//   exactly one room  → auto-enter via the account-bound admin-session bridge
//   two or more rooms → My Norebang chooser (explicit selection)
//   zero rooms        → first-room onboarding (create a Room; never auto-create)
//
// Loading this screen performs pure reads and creates ZERO Events. Auto-enter is a
// redirect to the GET bridge — it never mints a Room cookie here and never uses
// Manager authentication.

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { authorizeHost, listHostRooms, publicAccount } from '@/lib/host-auth.server';
import { resolveNorebangHostEntitlements } from '@/lib/host-plan.server';
import { csrfTokenOrNull, CSRF_FIELD_NAME } from '@/lib/host-csrf.server';
import { googleWebConfigured } from '@/lib/google-oauth.server';
import { HOST_COOKIE } from '@/lib/host-web-session.server';
import { resolveHostEntry } from '@/domain/host-entry';
import { PRODUCT_NAME, PRODUCT_TAGLINE_KO } from '@/lib/brand';
import LegalLinks from '@/components/legal/LegalLinks';
import HostTimezoneCapture from '@/components/host/HostTimezoneCapture';
import FirstRoomForm from './FirstRoomForm';

const NOTICES: Record<string, string> = {
  google_unconfigured: 'Google 로그인이 아직 설정되지 않았습니다.',
  state_mismatch: '로그인 요청이 만료되었거나 올바르지 않습니다. 다시 시도해 주세요.',
  invalid_callback: '로그인 응답이 올바르지 않습니다. 다시 시도해 주세요.',
  expired: '로그인 요청이 만료되었습니다. 다시 시도해 주세요.',
  exchange_failed: '로그인을 완료하지 못했습니다. 다시 시도해 주세요.',
  verification_failed: '로그인을 확인하지 못했습니다. 다시 시도해 주세요.',
  cancelled: '로그인이 취소되었습니다.',
  signed_out: '로그아웃되었습니다.',
  bad_name: '노래방 이름을 입력해 주세요.',
  room_conflict: '같은 요청이 다른 이름으로 이미 처리되었습니다. 새로 시도해 주세요.',
  room_blocked: '노래방을 만들 수 없습니다. 잠시 후 다시 시도해 주세요.',
};

function BrandHead() {
  return (
    <div className="brand-head">
      <span className="brand">{PRODUCT_NAME}</span>
      <span className="brand-tag">{PRODUCT_TAGLINE_KO}</span>
    </div>
  );
}

export default async function HostEntryScreen({ notice, view }: { notice?: string; view?: string }) {
  const message = notice ? NOTICES[notice] ?? null : null;
  // The Host EXPLICITLY opened the hub (the "My Norebang" action, /?view=rooms) — a
  // single-Room Host must then see the chooser instead of auto-entering their one Room.
  const explicitHub = view === 'rooms';

  const token = (await cookies()).get(HOST_COOKIE)?.value ?? null;
  const account = await authorizeHost(token);        // pure read
  const rooms = account ? await listHostRooms(account.id) : [];   // pure read, zero Events
  // Plan is READ-only here — shown as a chip only. Room count is NOT plan-bounded.
  const plan = account ? (await resolveNorebangHostEntitlements(account.id)).planCode : 'FREE';

  const decision = resolveHostEntry({
    authenticated: account != null,
    roomSlugs: rooms.map((r) => r.slug),
    explicitHub,
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
  // Server-issued per-render idempotency key: a resubmit of THIS rendered form reuses it
  // (the additional-Room create replays instead of duplicating); a fresh load mints a new
  // one. Purely a request token — never a credential, never persisted.
  const idempotencyKey = crypto.randomUUID();

  return (
    <main className="host-shell">
      <BrandHead />
      {/* One-time IANA timezone capture (Daily FREE Karaoke Minutes) — authenticated shell. */}
      <HostTimezoneCapture />

      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div className="row" style={{ gap: '0.5rem', alignItems: 'center' }}>
          <h1>My Norebang</h1>
          {/* Current plan (read-only display; no upgrade CTA in V1). */}
          <span className="pill" data-host-plan={plan}>{plan}</span>
        </div>
        <div className="row" style={{ gap: '0.5rem' }}>
          {/* Host Plan Foundation V1 — the Plan screen entry from the hub. */}
          <a className="host-btn host-btn-ghost" href="/host/plan">플랜</a>
          <form action="/host/logout" method="post">
            <input type="hidden" name={CSRF_FIELD_NAME} value={csrf ?? ''} />
            <button className="host-btn host-btn-ghost" type="submit">로그아웃</button>
          </form>
        </div>
      </div>
      <p className="muted">{me.displayName ?? me.email ?? '로그인됨'}</p>

      {decision.kind === 'empty' ? (
        // Zero owned Rooms → first-room onboarding. The Host supplies only a name;
        // the slug, ownership, and Admin entry are all derived server-side. This
        // never sends a zero-Room Host to an empty hub and shows no Manager passcode.
        <div className="card hero" data-host-no-room>
          <h2>노래방을 만드세요</h2>
          <p className="muted">이 공간의 이름을 지어 주세요. 표시 이름은 나중에 바꿀 수 있어요.</p>
          {message && <p className="host-notice" role="status">{message}</p>}
          {csrf ? (
            <FirstRoomForm csrf={csrf} csrfField={CSRF_FIELD_NAME} idempotencyKey={idempotencyKey} />
          ) : (
            <div className="host-unavailable" role="status">
              <b>준비 중</b>
              <span className="muted">아직 설정이 완료되지 않아 지금은 만들 수 없습니다.</span>
            </div>
          )}
        </div>
      ) : (
        <>
          {rooms.map((room) => (
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
          ))}

          {/* Room count is not a plan boundary — any Host may add another Norebang.
              Reuse the first-Room form (same endpoint) with a server-issued idempotency
              key so a resubmit replays instead of duplicating. No limit copy, no CTA. */}
          <div className="card hero" data-host-add-room>
            <h2>노래방 추가 만들기</h2>
            <p className="muted">Create another Norebang · 이 공간의 이름을 지어 주세요.</p>
            {message && <p className="host-notice" role="status">{message}</p>}
            {csrf ? (
              <FirstRoomForm
                csrf={csrf}
                csrfField={CSRF_FIELD_NAME}
                idempotencyKey={idempotencyKey}
                submitLabel="노래방 추가 만들기"
                busyLabel="만드는 중…"
              />
            ) : (
              <div className="host-unavailable" role="status">
                <b>준비 중</b>
                <span className="muted">아직 설정이 완료되지 않아 지금은 만들 수 없습니다.</span>
              </div>
            )}
          </div>
        </>
      )}

      <LegalLinks showContact />
    </main>
  );
}
