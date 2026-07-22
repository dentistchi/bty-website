// Room Settings V1 — the authenticated owner's Settings screen (Room Settings).
//
// GET /host/rooms/{slug}/settings
//   Host session cookie → account → ACTIVE membership → workspace owns {slug} →
//   render the display-name + guest-welcome editor pre-filled with current values.
//
// Authorization is derived SERVER-SIDE and identity-first. A signed-out visitor is
// sent to the root login. An authenticated NON-owner (or an unknown Room) is sent
// to the root too — the SAME redirect for both, so this page is never a Room-
// existence oracle. Reading this page performs pure reads and creates ZERO Events.

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { authorizeHost, accountHasRoomAccess } from '@/lib/host-auth.server';
import { csrfTokenOrNull, CSRF_FIELD_NAME } from '@/lib/host-csrf.server';
import { HOST_COOKIE } from '@/lib/host-web-session.server';
import { getPublicRoomBySlug } from '@/lib/rooms.server';
import { PRODUCT_NAME, PRODUCT_TAGLINE_KO } from '@/lib/brand';
import LegalLinks from '@/components/legal/LegalLinks';
import RoomSettingsForm from './RoomSettingsForm';
import LogoControls from './LogoControls';
import { normalizeTheme } from '@/domain/branding';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const NOTICES: Record<string, { kind: 'ok' | 'err'; text: string }> = {
  saved: { kind: 'ok', text: '변경사항을 저장했어요.' },
  bad_name: { kind: 'err', text: '노래방 이름을 입력해 주세요.' },
  bad_welcome: { kind: 'err', text: '환영 문구가 너무 길어요. (최대 160자)' },
  logo_saved: { kind: 'ok', text: '로고를 저장했어요.' },
  logo_removed: { kind: 'ok', text: '로고를 제거했어요.' },
  logo_bad: { kind: 'err', text: '이미지를 읽을 수 없어요. PNG · JPEG · WebP 파일을 올려 주세요.' },
  logo_format: { kind: 'err', text: '지원하지 않는 형식이에요. PNG · JPEG · WebP만 가능해요.' },
  logo_too_large: { kind: 'err', text: '이미지가 너무 커요. (최대 2MB · 4096px · 419만 픽셀)' },
  logo_failed: { kind: 'err', text: '로고를 저장하지 못했어요. 다시 시도해 주세요.' },
};

export default async function RoomSettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ notice?: string }>;
}) {
  const { slug } = await params;
  const { notice } = await searchParams;

  const token = (await cookies()).get(HOST_COOKIE)?.value ?? null;
  const account = await authorizeHost(token);
  if (!account) redirect('/'); // identity first, always

  const room = await getPublicRoomBySlug(slug);
  // Unknown Room and unauthorized Room BOTH fall back to the root — no signal about
  // which Rooms exist or who owns them, and no dead end.
  if (!room || !(await accountHasRoomAccess(account.id, room.id))) redirect('/');

  const csrf = await csrfTokenOrNull(token!); // null when the CSRF secret is unconfigured
  const message = notice ? NOTICES[notice] ?? null : null;

  return (
    <main className="host-shell">
      <div className="brand-head">
        <span className="brand">{PRODUCT_NAME}</span>
        <span className="brand-tag">{PRODUCT_TAGLINE_KO}</span>
      </div>

      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1>노래방 설정</h1>
        {/* Back into this Room's Admin — the slug is fixed and never editable here. */}
        <a className="host-btn host-btn-ghost" href={`/r/${encodeURIComponent(room.slug)}/admin`}>
          관리자로 돌아가기
        </a>
      </div>

      {message && (
        <p className="host-notice" role={message.kind === 'ok' ? 'status' : 'alert'}>
          {message.text}
        </p>
      )}

      {csrf ? (
        <>
          {/* 브랜딩 — logo + theme. Preview swatch reflects the theme via data-theme. */}
          <div className="card hero" data-theme={normalizeTheme(room.branding_theme)} data-room-branding={room.slug}>
            <h2>브랜딩</h2>
            <label className="settings-label">노래방 로고</label>
            <LogoControls
              slug={room.slug}
              csrf={csrf}
              csrfField={CSRF_FIELD_NAME}
              currentLogoUrl={room.logo_object_key ? `/api/public/rooms/${encodeURIComponent(room.slug)}/logo?v=${room.logo_version ?? ''}` : null}
            />
          </div>

          {/* 노래방 정보 — name, welcome, and the theme picker (one explicit Save). */}
          <div className="card hero" data-room-settings={room.slug}>
            <h2>노래방 정보</h2>
            <RoomSettingsForm
              slug={room.slug}
              csrf={csrf}
              csrfField={CSRF_FIELD_NAME}
              initialName={room.display_name}
              initialWelcome={room.guest_welcome_message ?? ''}
              initialTheme={room.branding_theme}
            />
          </div>
        </>
      ) : (
        <div className="card hero">
          <div className="host-unavailable" role="status">
            <b>준비 중</b>
            <span className="muted">아직 설정이 완료되지 않아 지금은 저장할 수 없습니다.</span>
          </div>
        </div>
      )}

      <LegalLinks showContact />
    </main>
  );
}
