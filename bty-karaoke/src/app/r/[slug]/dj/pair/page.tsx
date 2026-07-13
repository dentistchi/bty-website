import { getPublicRoomBySlug } from '@/lib/rooms.server';
import { PRODUCT_NAME } from '@/lib/brand';
import PairClient from './PairClient';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// The pairing confirmation screen. The one-time token is read client-side from
// the URL and never rendered; the server shell only supplies the room name.
export default async function PairPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const room = await getPublicRoomBySlug(slug);

  if (!room) {
    return (
      <main>
        <div className="brand-head">
          <span className="brand">{PRODUCT_NAME}</span>
          <span className="brand-tag">DJ</span>
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
      <div className="brand-head">
        <span className="brand">{PRODUCT_NAME}</span>
        <span className="brand-tag">DJ</span>
      </div>
      <PairClient slug={room.slug} displayName={room.display_name} />
    </main>
  );
}
