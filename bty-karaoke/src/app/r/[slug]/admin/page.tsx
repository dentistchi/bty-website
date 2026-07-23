import { cookies } from 'next/headers';
import { getPublicRoomBySlug } from '@/lib/rooms.server';
import { PRODUCT_NAME } from '@/lib/brand';
import { HOST_COOKIE } from '@/lib/host-web-session.server';
import { csrfTokenOrNull, CSRF_FIELD_NAME } from '@/lib/host-csrf.server';
import { normalizeTheme } from '@/domain/branding';
import HostTimezoneCapture from '@/components/host/HostTimezoneCapture';
import AdminConsole from './AdminConsole';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// The Admin phone route renders only a shell. All authority checks happen
// client-side against the server; no credential ever lands in the URL or the
// server-rendered HTML.
export default async function AdminPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const room = await getPublicRoomBySlug(slug);

  if (!room) {
    return (
      <main>
        <div className="brand-head">
          <span className="brand">{PRODUCT_NAME}</span>
          <span className="brand-tag">Admin</span>
        </div>
        <div className="card">
          <div className="display-sm">Room not found</div>
          <p className="lead">No room exists for “{slug}”.</p>
        </div>
      </main>
    );
  }

  // A Host who auto-entered from the root never passes through the My Norebang
  // hub, so surface Sign Out here too. Rendered ONLY when a Host web session is
  // present (DJ/manager-paired admins have no bty_host cookie and see nothing new).
  // The button posts to the existing CSRF-protected /host/logout; it changes no
  // Admin behaviour and touches no Event.
  const hostToken = (await cookies()).get(HOST_COOKIE)?.value ?? null;
  const hostCsrf = hostToken ? await csrfTokenOrNull(hostToken) : null;

  const logoUrl = room.logo_object_key
    ? `/api/public/rooms/${encodeURIComponent(room.slug)}/logo?v=${room.logo_version ?? ''}`
    : null;

  return (
    <main data-theme={normalizeTheme(room.branding_theme)}>
      {logoUrl && (
        <div className="row admin-room-identity" style={{ gap: '0.6rem', alignItems: 'center' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="room-logo room-logo-sm" src={logoUrl} alt={`${room.display_name} 로고`} width={40} height={40} />
        </div>
      )}
      {/* One-time IANA timezone capture — only on the authenticated Host shell. */}
      {hostToken && <HostTimezoneCapture />}
      {hostToken && hostCsrf && (
        <div className="row host-admin-signout" style={{ justifyContent: 'flex-end', gap: '0.5rem' }}>
          {/* Room Settings V1 — an authenticated owner reaches their Settings screen
              from Admin. Rendered ONLY with a Host session (DJ/manager-paired admins
              have no bty_host cookie); the page itself re-checks ownership. */}
          {/* Room-limit policy correction — a single-Room Host who auto-entered can
              open the My Norebang hub explicitly (?view=rooms never auto-enters) to add
              or switch Rooms. */}
          <a className="host-btn host-btn-ghost" href="/?view=rooms">
            내 노래방 관리
          </a>
          <a
            className="host-btn host-btn-ghost"
            href={`/host/rooms/${encodeURIComponent(room.slug)}/settings`}
          >
            노래방 설정
          </a>
          {/* Host Plan Foundation V1 — reachable for a single-Room Host who
              auto-entered and never passes through the My Norebang hub. */}
          <a className="host-btn host-btn-ghost" href="/host/plan">
            플랜
          </a>
          <form action="/host/logout" method="post">
            <input type="hidden" name={CSRF_FIELD_NAME} value={hostCsrf} />
            <button className="host-btn host-btn-ghost" type="submit">로그아웃</button>
          </form>
        </div>
      )}
      <AdminConsole slug={room.slug} displayName={room.display_name} />
    </main>
  );
}
