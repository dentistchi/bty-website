import { getPublicRoomBySlug } from '@/lib/rooms.server';
import { PRODUCT_NAME, PRODUCT_TAGLINE_KO } from '@/lib/brand';
import RequestForm from './RequestForm';
import QueueBoard from './QueueBoard';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function RoomPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const room = await getPublicRoomBySlug(slug);

  if (!room) {
    return (
      <main>
        <h1>Room not found</h1>
        <p className="muted">No room exists for “{slug}”.</p>
      </main>
    );
  }

  return (
    <main>
      <div className="brand-head">
        <span className="brand">{PRODUCT_NAME}</span>
        <span className="brand-tag">{PRODUCT_TAGLINE_KO}</span>
      </div>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1>{room.display_name}</h1>
        <span className="tag">{room.status === 'open' ? '열림' : '닫힘'}</span>
      </div>
      <p className="muted">노래를 검색해 신청하고, 내 차례가 되면 직접 시작하세요.</p>

      <RequestForm slug={room.slug} roomOpen={room.status === 'open'} />

      {/* Live full-queue view (canonical /display resolver, my songs highlighted). */}
      <QueueBoard slug={room.slug} />
    </main>
  );
}
