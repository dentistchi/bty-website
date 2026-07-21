import { cookies } from 'next/headers';
import { getPublicRoomBySlug } from '@/lib/rooms.server';
import { PRODUCT_NAME } from '@/lib/brand';
import { HOST_COOKIE } from '@/lib/host-web-session.server';
import { csrfTokenOrNull, CSRF_FIELD_NAME } from '@/lib/host-csrf.server';
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

  return (
    <main>
      {hostToken && hostCsrf && (
        <div className="row host-admin-signout" style={{ justifyContent: 'flex-end' }}>
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
