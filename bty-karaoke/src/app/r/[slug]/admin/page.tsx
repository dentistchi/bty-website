import { getPublicRoomBySlug } from '@/lib/rooms.server';
import { PRODUCT_NAME } from '@/lib/brand';
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

  return (
    <main>
      <AdminConsole slug={room.slug} displayName={room.display_name} />
    </main>
  );
}
