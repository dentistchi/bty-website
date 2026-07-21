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

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const NOTICES: Record<string, { kind: 'ok' | 'err'; text: string }> = {
  saved: { kind: 'ok', text: '변경사항을 저장했어요.' },
  bad_name: { kind: 'err', text: '노래방 이름을 입력해 주세요.' },
  bad_welcome: { kind: 'err', text: '환영 문구가 너무 길어요. (최대 160자)' },
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

      <div className="card hero" data-room-settings={room.slug}>
        {message && (
          <p className="host-notice" role={message.kind === 'ok' ? 'status' : 'alert'}>
            {message.text}
          </p>
        )}
        {csrf ? (
          <RoomSettingsForm
            slug={room.slug}
            csrf={csrf}
            csrfField={CSRF_FIELD_NAME}
            initialName={room.display_name}
            initialWelcome={room.guest_welcome_message ?? ''}
          />
        ) : (
          <div className="host-unavailable" role="status">
            <b>준비 중</b>
            <span className="muted">아직 설정이 완료되지 않아 지금은 저장할 수 없습니다.</span>
          </div>
        )}
      </div>

      <LegalLinks showContact />
    </main>
  );
}
